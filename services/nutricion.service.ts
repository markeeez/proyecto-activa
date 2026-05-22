/**
 * SERVICIO DE NUTRICIÓN
 *
 * Comidas por día en nutrition_log_meals (nombre, orden, is_default).
 * Las 4 predeterminadas se insertan al crear el día; no se usa meal_types en la app.
 */

import { COMIDAS_PREDETERMINADAS } from '@/constants/comidasPredeterminadas';
import { esDiaPasadoVsHoy } from '@/lib/fechaNutricion';
import { supabase } from '@/lib/supabase';
import { alimentosService } from '@/services/alimentos.service';
import type {
  ComidaConAlimentos,
  LineaCopiadaNutricion,
  ResumenDiarioNutricion,
  UltimaComidaAnteriorNutricion,
} from '@/types/app.types';
import type { NutritionLog, UserGoal } from '@/types/database.types';
import { logger } from '@/lib/logger';

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


/**
 * PERF-05: Une filas duplicadas del mismo slot predeterminado en un solo meal.
 * Delega en el RPC `consolidar_duplicados_slots` que ejecuta todo en una
 * transacción SQL atómica (antes: 4 queries secuenciales sin transacción).
 */
async function consolidarDuplicadosSlotsPredeterminadosLog(logId: string): Promise<void> {
  const { error } = await supabase.rpc('consolidar_duplicados_slots', {
    p_log_id: logId,
  });
  if (error) {
    logger.warn('[nutricionService] consolidar: rpc', error.message);
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
    if (!row || typeof row.id !== 'string' || !row.id) {
      throw new Error('[nutricionService] asegurar_log_diario no devolvió un log válido (id ausente)');
    }

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

  /**
   * Resumen ligero de un mes para el calendario: solo total de calorías por fecha.
   * NO crea logs (a diferencia de obtenerResumenDiaNutricion). Días sin log → ausentes
   * del Map → el consumidor los pinta como `sinDatos`.
   *
   * Hace 2 round-trips:
   *   1) nutrition_logs (id, fecha) en el rango.
   *   2) nutrition_log_meals + nutrition_log_items (calorias_calculadas) por log_id.
   *
   * Esto es mucho más barato que llamar 30 veces a obtenerResumenDiaNutricion
   * (que hace RPC + joins con foods).
   */
  async obtenerResumenMes(
    userId: string,
    desdeIso: string,
    hastaIso: string,
  ): Promise<Map<string, number>> {
    const totalesPorFecha = new Map<string, number>();

    const { data: logs, error: errLogs } = await supabase
      .from('nutrition_logs')
      .select('id, fecha')
      .eq('user_id', userId)
      .gte('fecha', desdeIso)
      .lte('fecha', hastaIso);
    if (errLogs) throw errLogs;
    if (!logs?.length) return totalesPorFecha;

    const logIds = (logs as { id: string; fecha: string }[]).map((l) => l.id);
    const fechaPorLogId = new Map<string, string>(
      (logs as { id: string; fecha: string }[]).map((l) => [l.id, l.fecha]),
    );

    const { data: meals, error: errMeals } = await supabase
      .from('nutrition_log_meals')
      .select('log_id, nutrition_log_items(calorias_calculadas)')
      .in('log_id', logIds);
    if (errMeals) throw errMeals;

    (meals ?? []).forEach((m: any) => {
      const items = (m.nutrition_log_items ?? []) as { calorias_calculadas: number | null }[];
      const subtotal = items.reduce((acc, it) => acc + Number(it.calorias_calculadas ?? 0), 0);
      const fecha = fechaPorLogId.get(m.log_id);
      if (!fecha) return;
      totalesPorFecha.set(fecha, (totalesPorFecha.get(fecha) ?? 0) + subtotal);
    });

    return totalesPorFecha;
  },

  async obtenerUltimaComidaAnterior(
    userId: string,
    fecha: string,
    nombreComida: string,
  ): Promise<UltimaComidaAnteriorNutricion | null> {
    const nombreObjetivo = normalizarNombre(nombreComida);
    if (!nombreObjetivo) return null;

    const { data: logs, error: errLogs } = await supabase
      .from('nutrition_logs')
      .select('id, fecha')
      .eq('user_id', userId)
      .lt('fecha', fecha)
      .order('fecha', { ascending: false })
      .limit(60);
    if (errLogs) throw errLogs;
    if (!logs?.length) return null;

    const logRows = logs as { id: string; fecha: string }[];
    const logIds = logRows.map((log) => log.id);
    const fechaPorLogId = new Map(logRows.map((log) => [log.id, log.fecha]));
    const ordenLogId = new Map(logRows.map((log, index) => [log.id, index]));

    const { data: meals, error: errMeals } = await supabase
      .from('nutrition_log_meals')
      .select(`
        id,
        log_id,
        nombre,
        orden,
        is_default,
        nutrition_log_items (
          food_id,
          gramos,
          calorias_calculadas,
          proteinas_calculadas,
          carbos_calculados,
          grasas_calculadas
        )
      `)
      .in('log_id', logIds);
    if (errMeals) throw errMeals;

    const candidatas = ((meals ?? []) as any[])
      .filter((meal) => {
        const items = meal.nutrition_log_items ?? [];
        return items.length > 0 && normalizarNombre(resolverNombreComida(meal)) === nombreObjetivo;
      })
      .sort((a, b) => {
        const posA = ordenLogId.get(a.log_id) ?? Number.MAX_SAFE_INTEGER;
        const posB = ordenLogId.get(b.log_id) ?? Number.MAX_SAFE_INTEGER;
        if (posA !== posB) return posA - posB;
        return Number(a.orden ?? 999) - Number(b.orden ?? 999);
      });

    const meal = candidatas[0];
    if (!meal) return null;

    const lineas: LineaCopiadaNutricion[] = (meal.nutrition_log_items ?? [])
      .map((item: any) => {
        const gramos = Number(item.gramos ?? 0);
        const factor = gramos > 0 ? gramos / 100 : 1;
        return {
          foodId: item.food_id,
          gramos,
          food: {
            calorias: Number(item.calorias_calculadas ?? 0) / factor,
            proteinas: Number(item.proteinas_calculadas ?? 0) / factor,
            carbohidratos: Number(item.carbos_calculados ?? 0) / factor,
            grasas: Number(item.grasas_calculadas ?? 0) / factor,
          },
        };
      })
      .filter((linea: LineaCopiadaNutricion) => linea.foodId && linea.gramos > 0);

    if (!lineas.length) return null;

    return {
      fecha: fechaPorLogId.get(meal.log_id) ?? '',
      nombre: resolverNombreComida(meal),
      lineas,
    };
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
