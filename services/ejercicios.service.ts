/**
 * SERVICIO DE EJERCICIOS
 *
 * Búsqueda en tabla local `exercises` (Supabase).
 */

import {
  normalizarTexto,
  nombreContieneTodasLasPalabras,
  palabrasBusqueda,
  sanitizarFragmentoIlike,
  elegirAnclajeBusqueda,
} from '@/lib/texto';
import { supabase } from '@/lib/supabase';
import type { CategoriaEjercicio, Exercise } from '@/types/database.types';

export type ModoListaEjercicios = 'general' | 'favoritos' | 'creados';

export type BuscarEjerciciosParams = {
  texto?: string;
  musculoPrimario?: string | null;
  equipamiento?: string | null;
  limite?: number;
  /** Filtro combinado con músculo/equipamiento */
  modoLista?: ModoListaEjercicios;
  userId?: string | null;
  /** Ids favoritos del usuario; vacío = sin resultados en modo favoritos */
  idsFavoritos?: string[];
};

const SUPABASE_PAGE_SIZE = 1000;

function norm(s: string | null | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

async function obtenerPorPaginas<T>(
  buildQuery: () => any,
  maxRows: number,
  contextoError: string,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;

  while (out.length < maxRows) {
    const remaining = maxRows - out.length;
    const pageSize = Math.min(SUPABASE_PAGE_SIZE, remaining);
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery().range(from, to);

    if (error) {
      console.error(contextoError, error.message);
      return out;
    }

    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return out;
}

/** Palabras de búsqueda normalizadas (sin comodines) para AND en cliente. */
function tokensNormBusqueda(texto: string): string[] {
  return palabrasBusqueda(normalizarTexto(texto))
    .map(sanitizarFragmentoIlike)
    .filter((w) => w.length > 0);
}

function aplicarIlikeNombreAnd(q: any, palabras: string[]): any {
  let out = q;
  for (const w of palabras) {
    const s = sanitizarFragmentoIlike(w);
    if (!s) continue;
    out = out.ilike('nombre', `%${s}%`);
  }
  return out;
}

export const ejerciciosService = {
  async buscarEjercicios(params: BuscarEjerciciosParams): Promise<Exercise[]> {
    const limite = params.limite ?? 100;
    const texto = norm(params.texto);
    const musculo = norm(params.musculoPrimario);
    const equip = norm(params.equipamiento);
    const modoLista = params.modoLista ?? 'general';
    const userId = params.userId ?? null;

    // PERF-04: "creados" — el usuario tiene pocos ejercicios personalizados (<50 típico).
    // Traemos todos de una vez con columnas específicas y filtramos en cliente.
    // Así el límite se aplica DESPUÉS del filtrado (antes se aplicaba antes, dando
    // menos resultados de los esperados si había filtro de equipamiento).
    if (modoLista === 'creados') {
      if (!userId) {
        console.warn('[ejerciciosService] buscarEjercicios modo creados sin userId');
        return [];
      }
      const { data, error } = await supabase
        .from('exercises')
        .select('id, nombre, descripcion, musculo_primario, musculos_secundarios, equipamiento, categoria, tracking_mode, foto_url, dificultad, is_custom, created_by, api_source, api_id, created_at')
        .eq('is_custom', true)
        .eq('created_by', userId)
        .order('nombre');

      if (error) {
        console.error('[ejerciciosService.buscarEjercicios] creados', error.message);
        return [];
      }

      let result = (data ?? []) as Exercise[];

      if (musculo) result = result.filter((e) => e.musculo_primario === musculo);
      if (equip) result = result.filter((e) => (e.equipamiento ?? '').trim() === equip);
      if (texto) {
        const tokens = palabrasBusqueda(normalizarTexto(texto)).filter((t) => t.length > 0);
        if (tokens.length > 0) {
          result = result.filter((e) => {
            const n = normalizarTexto(e.nombre);
            return tokens.every((t) => n.includes(t));
          });
        }
      }

      return result.slice(0, limite);
    }

    let q = supabase.from('exercises').select('*');

    if (modoLista === 'general') {
      q = q.eq('is_custom', false);
    }

    if (modoLista === 'favoritos') {
      if (!userId) return [];
      let ids = params.idsFavoritos;
      if (ids === undefined) {
        ids = await this.obtenerEjerciciosFavoritos(userId);
      }
      if (ids.length === 0) return [];
      q = q.in('id', ids);
    }

    if (musculo) {
      q = q.eq('musculo_primario', musculo);
    }

    if (equip) {
      q = q.eq('equipamiento', equip);
    }

    let rows: Exercise[];

    if (!texto) {
      rows = await obtenerPorPaginas<Exercise>(
        () => q.order('nombre'),
        limite,
        '[ejerciciosService.buscarEjercicios]',
      );
    } else {
      const palabrasNorm = tokensNormBusqueda(texto);
      const palabrasSplit = palabrasBusqueda(texto);
      const palabrasRaw = palabrasSplit.map(sanitizarFragmentoIlike).filter((w) => w.length > 0);

      if (palabrasNorm.length === 0) {
        rows = await obtenerPorPaginas<Exercise>(
          () => q.order('nombre'),
          limite,
          '[ejerciciosService.buscarEjercicios]',
        );
      } else {
        const busquedaRawEquivNorm =
          palabrasRaw.length === palabrasNorm.length &&
          palabrasRaw.every(
            (_, i) => sanitizarFragmentoIlike(normalizarTexto(palabrasSplit[i] ?? '')) === palabrasNorm[i],
          );

        const ancla = elegirAnclajeBusqueda(palabrasNorm);
        const anclaSafe = ancla ? sanitizarFragmentoIlike(ancla) : '';
        const limiteAncla = Math.min(Math.max(limite * 12, 120), 2000);

        const ejecutar = async (words: string[], maxRows: number) => {
          let qq = supabase.from('exercises').select('*');
          if (modoLista === 'general') {
            qq = qq.eq('is_custom', false);
          }
          if (modoLista === 'favoritos') {
            if (!userId) return [];
            let ids = params.idsFavoritos;
            if (ids === undefined) ids = await this.obtenerEjerciciosFavoritos(userId);
            if (ids.length === 0) return [];
            qq = qq.in('id', ids);
          }
          if (musculo) qq = qq.eq('musculo_primario', musculo);
          if (equip) qq = qq.eq('equipamiento', equip);
          qq = aplicarIlikeNombreAnd(qq, words);
          return obtenerPorPaginas<Exercise>(
            () => qq.order('nombre'),
            maxRows,
            '[ejerciciosService.buscarEjercicios]',
          );
        };

        const [rNorm, rRaw, rAncla] = await Promise.all([
          ejecutar(palabrasNorm, limite),
          !busquedaRawEquivNorm && palabrasRaw.length > 0 ? ejecutar(palabrasRaw, limite) : Promise.resolve([] as Exercise[]),
          anclaSafe ? ejecutar([anclaSafe], limiteAncla) : Promise.resolve([] as Exercise[]),
        ]);

        const porId = new Map<string, Exercise>();
        for (const ex of [...rNorm, ...rRaw, ...rAncla]) {
          porId.set(ex.id, ex);
        }

        rows = [...porId.values()].filter((ex) => nombreContieneTodasLasPalabras(ex.nombre, palabrasNorm));
        rows.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        rows = rows.slice(0, limite);
      }
    }

    return rows;
  },

  async obtenerEjerciciosFavoritos(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('user_favorite_exercises')
      .select('exercise_id')
      .eq('user_id', userId);

    if (error) {
      console.error('[ejerciciosService.obtenerEjerciciosFavoritos]', error.message);
      return [];
    }
    return (data ?? []).map((r: { exercise_id: string }) => r.exercise_id);
  },

  async toggleFavoritoEjercicio(userId: string, exerciseId: string): Promise<void> {
    const { data: existing } = await supabase
      .from('user_favorite_exercises')
      .select('exercise_id')
      .eq('user_id', userId)
      .eq('exercise_id', exerciseId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('user_favorite_exercises')
        .delete()
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId);
      if (error) console.error('[toggleFavoritoEjercicio] delete', error.message);
      return;
    }

    const { error } = await supabase.from('user_favorite_exercises').insert({
      user_id: userId,
      exercise_id: exerciseId,
    });
    if (error) console.error('[toggleFavoritoEjercicio] insert', error.message);
  },

  async obtenerMusculosDisponibles(): Promise<string[]> {
    const data = await obtenerPorPaginas<{ musculo_primario?: string }>(
      () =>
        supabase
          .from('exercises')
          .select('musculo_primario')
          .not('musculo_primario', 'is', null)
          .order('musculo_primario'),
      5000,
      '[ejerciciosService.obtenerMusculosDisponibles]',
    );

    const set = new Set<string>();
    for (const row of data ?? []) {
      const m = String((row as { musculo_primario?: string }).musculo_primario ?? '').trim();
      if (m) set.add(m);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  },

  async obtenerEquipamientoDisponible(): Promise<string[]> {
    const data = await obtenerPorPaginas<{ equipamiento?: string | null }>(
      () =>
        supabase
          .from('exercises')
          .select('equipamiento')
          .not('equipamiento', 'is', null)
          .order('equipamiento'),
      5000,
      '[ejerciciosService.obtenerEquipamientoDisponible]',
    );

    const set = new Set<string>();
    for (const row of data ?? []) {
      const e = String((row as { equipamiento?: string | null }).equipamiento ?? '').trim();
      if (e) set.add(e);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  },

  /**
   * Valores distintos para chips de filtro (muestra acotada; suficiente para catálogo local).
   */
  async obtenerOpcionesFiltros(): Promise<{ musculos: string[]; equipamientos: string[] }> {
    const data = await obtenerPorPaginas<{ musculo_primario?: string; equipamiento?: string | null }>(
      () => supabase.from('exercises').select('musculo_primario, equipamiento').order('nombre'),
      5000,
      '[ejerciciosService.obtenerOpcionesFiltros]',
    );

    const musculos = new Set<string>();
    const equipamientos = new Set<string>();

    for (const row of data ?? []) {
      const m = (row as { musculo_primario?: string }).musculo_primario?.trim();
      if (m) musculos.add(m);
      const e = (row as { equipamiento?: string | null }).equipamiento?.trim();
      if (e) equipamientos.add(e);
    }

    return {
      musculos: [...musculos].sort((a, b) => a.localeCompare(b, 'es')),
      equipamientos: [...equipamientos].sort((a, b) => a.localeCompare(b, 'es')),
    };
  },

  async filtrarPorMusculo(musculo: string): Promise<Exercise[]> {
    return this.buscarEjercicios({ musculoPrimario: musculo });
  },

  async obtenerEjercicio(id: string): Promise<Exercise | null> {
    const { data, error } = await supabase.from('exercises').select('*').eq('id', id).maybeSingle();

    if (error) {
      console.error('[ejerciciosService.obtenerEjercicio]', error.message);
      return null;
    }
    return data as Exercise | null;
  },

  async obtenerHistorialEjercicio(userId: string, exerciseId: string) {
    void userId;
    void exerciseId;
    return [];
  },

  async crearEjercicioPersonalizado(
    userId: string,
    datos: {
      nombre: string;
      musculo_primario: string;
      musculos_secundarios?: string[];
      categoria?: CategoriaEjercicio;
      descripcion?: string | null;
    },
  ): Promise<Exercise | null> {
    const { data, error } = await supabase
      .from('exercises')
      .insert({
        nombre: datos.nombre.trim(),
        musculo_primario: datos.musculo_primario.trim(),
        musculos_secundarios: datos.musculos_secundarios ?? [],
        categoria: datos.categoria ?? 'fuerza',
        tracking_mode: datos.categoria === 'cardio' ? 'cardio_time' : 'strength',
        descripcion: datos.descripcion ?? null,
        is_custom: true,
        created_by: userId,
        api_source: null,
        api_id: null,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[ejerciciosService.crearEjercicioPersonalizado]', error.message);
      return null;
    }
    return data as Exercise;
  },
};
