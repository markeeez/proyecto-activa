/**
 * SERVICIO DE NUTRICIÓN
 *
 * Comidas por día en nutrition_log_meals (nombre, orden, is_default).
 * Las 4 predeterminadas se insertan al crear el día; no se usa meal_types en la app.
 */

import {
  COMIDAS_PREDETERMINADAS,
  type ComidaDefaultDef,
} from '@/constants/comidasPredeterminadas';
import { esDiaPasadoVsHoy } from '@/lib/fechaNutricion';
import { supabase } from '@/lib/supabase';
import { alimentosService } from '@/services/alimentos.service';
import type { ComidaConAlimentos, ResumenDiarioNutricion } from '@/types/app.types';
import type { NutritionLog, UserGoal } from '@/types/database.types';

function normalizarNombre(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Nombre legible aunque en BD venga null (migración / filas viejas). */
function resolverNombreComida(meal: {
  nombre?: string | null;
  orden?: number | null;
  is_default?: boolean | null;
}): string {
  const raw = meal.nombre?.trim();
  if (raw) return raw;
  if (meal.is_default) {
    const def = COMIDAS_PREDETERMINADAS.find((d) => d.orden === Number(meal.orden));
    if (def) return def.nombre;
  }
  return 'Comida';
}

function filaPareceSlotPredeterminado(
  r: { nombre: string | null; orden: number; is_default: boolean },
  def: ComidaDefaultDef,
): boolean {
  if (Number(r.orden) !== def.orden) return false;
  if (r.is_default) return true;
  const n = normalizarNombre(r.nombre ?? '');
  if (!n || n === normalizarNombre('Comida')) return true;
  return n === normalizarNombre(def.nombre);
}

type FilaMealWork = {
  id: string;
  nombre: string | null;
  orden: number;
  is_default: boolean;
  itemCount: number;
};

/**
 * Une filas duplicadas del mismo slot predeterminado (mismo orden 1–4) en un solo meal
 * y mueve ítems al que se conserva. Idempotente.
 */
async function consolidarDuplicadosSlotsPredeterminadosLog(logId: string): Promise<void> {
  const { data: rows, error } = await supabase
    .from('nutrition_log_meals')
    .select(`id, nombre, orden, is_default, nutrition_log_items (id)`)
    .eq('log_id', logId);

  if (error) {
    console.warn('[nutricionService] consolidar: lectura', error.message);
    return;
  }

  let work: FilaMealWork[] = (rows ?? []).map((r: any) => ({
    id: r.id as string,
    nombre: (r.nombre as string | null) ?? null,
    orden: Number(r.orden ?? 0),
    is_default: Boolean(r.is_default),
    itemCount: (r.nutrition_log_items ?? []).length,
  }));

  for (const def of COMIDAS_PREDETERMINADAS) {
    const candidates = work.filter((r) =>
      filaPareceSlotPredeterminado(
        { nombre: r.nombre, orden: r.orden, is_default: r.is_default },
        def,
      ),
    );
    if (candidates.length <= 1) continue;

    const sorted = [...candidates].sort(
      (a, b) => b.itemCount - a.itemCount || a.id.localeCompare(b.id),
    );
    const keeper = sorted[0];
    const losers = sorted.slice(1);

    for (const loser of losers) {
      if (loser.itemCount > 0) {
        const { error: uErr } = await supabase
          .from('nutrition_log_items')
          .update({ meal_id: keeper.id })
          .eq('meal_id', loser.id);
        if (uErr) {
          console.warn('[nutricionService] consolidar: mover items', uErr.message);
          continue;
        }
      }
      const { error: dErr } = await supabase.from('nutrition_log_meals').delete().eq('id', loser.id);
      if (dErr) {
        console.warn('[nutricionService] consolidar: borrar meal', dErr.message);
        continue;
      }
      work = work.filter((r) => r.id !== loser.id);
      keeper.itemCount += loser.itemCount;
    }

    const { error: patchErr } = await supabase
      .from('nutrition_log_meals')
      .update({
        nombre: def.nombre,
        orden: def.orden,
        is_default: true,
      })
      .eq('id', keeper.id);
    if (patchErr) console.warn('[nutricionService] consolidar: normalizar keeper', patchErr.message);

    const ki = work.findIndex((x) => x.id === keeper.id);
    if (ki >= 0) {
      work[ki] = {
        ...work[ki],
        nombre: def.nombre,
        orden: def.orden,
        is_default: true,
        itemCount: keeper.itemCount,
      };
    }
  }
}

function totalesDesdeItems(items: ComidaConAlimentos['items']) {
  return {
    totalCalorias: items.reduce((acc, it) => acc + it.calorias_calculadas, 0),
    totalProteinas: items.reduce((acc, it) => acc + it.proteinas_calculadas, 0),
    totalCarbos: items.reduce((acc, it) => acc + it.carbos_calculados, 0),
    totalGrasas: items.reduce((acc, it) => acc + it.grasas_calculadas, 0),
  };
}

function mapMealRow(meal: any): ComidaConAlimentos {
  const items = (meal.nutrition_log_items ?? []).map((item: any) => ({
    id: item.id,
    meal_id: item.meal_id,
    food_id: item.food_id,
    gramos: Number(item.gramos ?? 0),
    calorias_calculadas: Number(item.calorias_calculadas ?? 0),
    proteinas_calculadas: Number(item.proteinas_calculadas ?? 0),
    carbos_calculados: Number(item.carbos_calculados ?? 0),
    grasas_calculadas: Number(item.grasas_calculadas ?? 0),
    food: item.foods,
  }));

  const t = totalesDesdeItems(items);
  return {
    mealId: meal.id,
    nombre: resolverNombreComida(meal),
    orden: Number(meal.orden ?? 999),
    isDefault: Boolean(meal.is_default),
    items,
    ...t,
  };
}

function resumenDesdeComidas(fecha: string, logId: string, comidas: ComidaConAlimentos[]): ResumenDiarioNutricion {
  return {
    fecha,
    logId,
    totalCalorias: comidas.reduce((a, c) => a + c.totalCalorias, 0),
    totalProteinas: comidas.reduce((a, c) => a + c.totalProteinas, 0),
    totalCarbos: comidas.reduce((a, c) => a + c.totalCarbos, 0),
    totalGrasas: comidas.reduce((a, c) => a + c.totalGrasas, 0),
    comidas,
  };
}

export const nutricionService = {
  async obtenerLogSiExiste(userId: string, fecha: string): Promise<NutritionLog | null> {
    const { data, error } = await supabase
      .from('nutrition_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('fecha', fecha)
      .maybeSingle();
    if (error) throw error;
    return (data as NutritionLog | null) ?? null;
  },

  async obtenerObjetivos(userId: string): Promise<UserGoal | null> {
    const { data, error } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as UserGoal | null;
  },

  async crearObjetivos(
    _userId: string,
    _datos: Omit<UserGoal, 'id' | 'user_id' | 'created_at'>,
  ) {},

  async actualizarObjetivos(
    _userId: string,
    _datos: Partial<Omit<UserGoal, 'id' | 'user_id' | 'created_at'>>,
  ) {},

  async asegurarLogDiario(userId: string, fecha: string): Promise<NutritionLog> {
    // INSERT ... ON CONFLICT (user_id, fecha) DO UPDATE SET user_id = user_id
    // Operación atómica: no hay ventana de tiempo entre el SELECT y el INSERT,
    // así que dos llamadas simultáneas nunca provocan el error 23505.
    const { data, error } = await supabase
      .from('nutrition_logs')
      .upsert(
        { user_id: userId, fecha },
        { onConflict: 'user_id,fecha', ignoreDuplicates: false },
      )
      .select('*')
      .single();
    if (error) throw error;
    return data as NutritionLog;
  },

  /**
   * Si el log no tiene filas de comida, inserta las 4 predeterminadas.
   * En días pasados no se crean (vista solo comidas con ítems; el usuario añade comida custom si hace falta).
   * Devuelve true si insertó las comidas, false si ya existían (o es día pasado).
   */
  async asegurarComidasPredeterminadasSiVacias(logId: string, fecha: string): Promise<boolean> {
    if (esDiaPasadoVsHoy(fecha)) return false;

    const { count, error: cErr } = await supabase
      .from('nutrition_log_meals')
      .select('*', { count: 'exact', head: true })
      .eq('log_id', logId);
    if (cErr) throw cErr;
    if ((count ?? 0) > 0) return false;

    const rows = COMIDAS_PREDETERMINADAS.map((d) => ({
      log_id: logId,
      nombre: d.nombre,
      orden: d.orden,
      is_default: true,
      meal_type_id: null as string | null,
    }));

    const { error } = await supabase.from('nutrition_log_meals').insert(rows);
    if (error) throw error;
    return true;
  },

  /**
   * Carga el día: un único round-trip a la RPC asegurar_log_diario que crea el log
   * y, si es hoy/futuro y está vacío, inserta las 4 comidas predeterminadas.
   * En días pasados solo filas reales; vista = comidas con al menos un ítem.
   * La deduplicación solo se ejecuta cuando la RPC acaba de insertar las predeterminadas.
   */
  async obtenerResumenDiaNutricion(userId: string, fecha: string): Promise<ResumenDiarioNutricion | null> {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('asegurar_log_diario', {
      p_user_id: userId,
      p_fecha: fecha,
    });
    if (rpcErr) throw rpcErr;

    // La función devuelve RETURNS jsonb → data es el objeto directamente (no array)
    const row = rpcData as any;
    if (!row) throw new Error('[nutricionService] asegurar_log_diario no devolvió filas');

    const logId: string = row.id;
    const insertoPredeterminadas: boolean = row.inserto_predeterminadas ?? false;

    if (insertoPredeterminadas) {
      await consolidarDuplicadosSlotsPredeterminadosLog(logId);
    }

    const { data: mealsConItems, error } = await supabase
      .from('nutrition_log_meals')
      .select(`
        id,
        log_id,
        nombre,
        orden,
        is_default,
        meal_type_id,
        nutrition_log_items (
          id,
          meal_id,
          food_id,
          gramos,
          calorias_calculadas,
          proteinas_calculadas,
          carbos_calculados,
          grasas_calculadas,
          foods (*)
        )
      `)
      .eq('log_id', logId);

    if (error) throw error;

    let comidas = (mealsConItems ?? []).map((m: any) => mapMealRow(m));
    comidas.sort((a, b) => a.orden - b.orden);

    if (esDiaPasadoVsHoy(fecha)) {
      comidas = comidas.filter((c) => c.items.length > 0);
    }

    return resumenDesdeComidas(fecha, logId, comidas);
  },

  async actualizarOrdenComidas(logId: string, mealIdsEnOrden: string[]): Promise<void> {
    // RPC: actualiza todos los órdenes en una sola transacción atómica.
    // Antes: N UPDATEs paralelos sin transacción → orden parcial si uno fallaba.
    const { error } = await supabase.rpc('actualizar_orden_comidas', {
      p_log_id: logId,
      p_meal_ids: mealIdsEnOrden,
    });
    if (error) throw error;
  },

  async añadirAlimentoAComida(datos: {
    mealId: string;
    foodId: string;
    gramos: number;
    food: { calorias: number; proteinas: number; carbohidratos: number; grasas: number };
  }) {
    const factor = datos.gramos / 100;
    const { error } = await supabase.from('nutrition_log_items').insert({
      meal_id: datos.mealId,
      food_id: datos.foodId,
      gramos: datos.gramos,
      calorias_calculadas: datos.food.calorias * factor,
      proteinas_calculadas: datos.food.proteinas * factor,
      carbos_calculados: datos.food.carbohidratos * factor,
      grasas_calculadas: datos.food.grasas * factor,
    });

    if (error) throw error;
    void alimentosService.registrarSeleccionPopularity(datos.foodId);
  },

  async eliminarAlimentoDeComida(itemId: string) {
    const { data, error } = await supabase
      .from('nutrition_log_items')
      .delete()
      .eq('id', itemId)
      .select('id');
    if (error) throw error;
    if (!data?.length) {
      throw new Error(
        'No se pudo eliminar el alimento del registro (¿existe o tienes permiso?).',
      );
    }
  },

  async vaciarComida(mealId: string) {
    const { error } = await supabase.from('nutrition_log_items').delete().eq('meal_id', mealId);
    if (error) throw error;
  },

  async eliminarComidaDelLog(logId: string, mealId: string) {
    const { data: row, error: errMeal } = await supabase
      .from('nutrition_log_meals')
      .select('id')
      .eq('id', mealId)
      .eq('log_id', logId)
      .maybeSingle();
    if (errMeal) throw errMeal;
    if (!row) {
      throw new Error('La comida no existe en este día o ya fue eliminada.');
    }

    const { error: e1 } = await supabase.from('nutrition_log_items').delete().eq('meal_id', mealId);
    if (e1) throw e1;

    const { data: borrada, error: e2 } = await supabase
      .from('nutrition_log_meals')
      .delete()
      .eq('id', mealId)
      .eq('log_id', logId)
      .select('id');
    if (e2) throw e2;
    if (!borrada?.length) {
      throw new Error('No se pudo eliminar la comida del registro (revisa permisos RLS).');
    }
  },

  /** Crea el log del día si no existe y devuelve el id de la nueva fila nutrition_log_meals. */
  async crearComidaPersonalizada(userId: string, fecha: string, nombre: string): Promise<string> {
    const trimmed = nombre.trim();
    if (!trimmed) throw new Error('Nombre vacío');

    const log = await this.asegurarLogDiario(userId, fecha);

    const { data: ultima, error: e0 } = await supabase
      .from('nutrition_log_meals')
      .select('orden')
      .eq('log_id', log.id)
      .order('orden', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (e0) throw e0;

    const nextOrden = ultima?.orden != null ? Number(ultima.orden) + 1 : 1;

    const { data: creada, error: e1 } = await supabase
      .from('nutrition_log_meals')
      .insert({
        log_id: log.id,
        nombre: trimmed,
        orden: nextOrden,
        is_default: false,
        meal_type_id: null,
      })
      .select('id')
      .single();
    if (e1) throw e1;
    return (creada as { id: string }).id;
  },

  async pegarAlimentosEnComida(
    mealId: string,
    copias: {
      foodId: string;
      gramos: number;
      food: { calorias: number; proteinas: number; carbohidratos: number; grasas: number };
    }[],
  ) {
    if (!copias.length) return;

    // Batch INSERT: un único round-trip en vez de N secuenciales.
    const rows = copias.map((c) => {
      const factor = c.gramos / 100;
      return {
        meal_id: mealId,
        food_id: c.foodId,
        gramos: c.gramos,
        calorias_calculadas: c.food.calorias * factor,
        proteinas_calculadas: c.food.proteinas * factor,
        carbos_calculados: c.food.carbohidratos * factor,
        grasas_calculadas: c.food.grasas * factor,
      };
    });

    const { error } = await supabase.from('nutrition_log_items').insert(rows);
    if (error) throw error;

    // Registrar popularidad en paralelo, sin bloquear.
    void Promise.all(copias.map((c) => alimentosService.registrarSeleccionPopularity(c.foodId)));
  },

  async actualizarGramosAlimento(_itemId: string, _nuevosGramos: number) {},
};
