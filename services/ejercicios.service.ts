/**
 * SERVICIO DE EJERCICIOS
 *
 * Búsqueda en tabla local `exercises` (Supabase).
 */

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

function norm(s: string | null | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

export const ejerciciosService = {
  async buscarEjercicios(params: BuscarEjerciciosParams): Promise<Exercise[]> {
    const limite = params.limite ?? 100;
    const texto = norm(params.texto);
    const musculo = norm(params.musculoPrimario);
    const equip = norm(params.equipamiento);
    const modoLista = params.modoLista ?? 'general';
    const userId = params.userId ?? null;

    let q = supabase.from('exercises').select('*');

    if (modoLista === 'creados') {
      if (!userId) return [];
      q = q.eq('is_custom', true).eq('created_by', userId);
    } else if (modoLista === 'favoritos') {
      if (!userId) return [];
      let ids = params.idsFavoritos;
      if (ids === undefined) {
        ids = await this.obtenerEjerciciosFavoritos(userId);
      }
      if (ids.length === 0) return [];
      q = q.in('id', ids);
    }

    if (texto) {
      q = q.ilike('nombre', `%${texto}%`);
    }
    if (musculo) {
      q = q.eq('musculo_primario', musculo);
    }

    q = q.order('nombre').limit(limite);

    const { data, error } = await q;

    if (error) {
      console.error('[ejerciciosService.buscarEjercicios]', error.message);
      return [];
    }

    let rows = (data ?? []) as Exercise[];

    if (equip) {
      rows = rows.filter((r) => (r.equipamiento ?? '').trim() === equip);
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
    const { data, error } = await supabase
      .from('exercises')
      .select('musculo_primario')
      .not('musculo_primario', 'is', null)
      .order('musculo_primario');

    if (error) {
      console.error('[ejerciciosService.obtenerMusculosDisponibles]', error.message);
      return [];
    }

    const set = new Set<string>();
    for (const row of data ?? []) {
      const m = String((row as { musculo_primario?: string }).musculo_primario ?? '').trim();
      if (m) set.add(m);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  },

  async obtenerEquipamientoDisponible(): Promise<string[]> {
    const { data, error } = await supabase
      .from('exercises')
      .select('equipamiento')
      .not('equipamiento', 'is', null)
      .order('equipamiento');

    if (error) {
      console.error('[ejerciciosService.obtenerEquipamientoDisponible]', error.message);
      return [];
    }

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
    const { data, error } = await supabase
      .from('exercises')
      .select('musculo_primario, equipamiento')
      .limit(4000);

    if (error) {
      console.error('[ejerciciosService.obtenerOpcionesFiltros]', error.message);
      return { musculos: [], equipamientos: [] };
    }

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
