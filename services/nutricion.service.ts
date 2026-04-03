/**
 * SERVICIO DE NUTRICIÓN
 *
 * Gestiona nutrition_logs, nutrition_log_meals, nutrition_log_items,
 * meal_types y user_goals.
 */

import { supabase } from '@/lib/supabase';
import { alimentosService } from '@/services/alimentos.service';
import type { UserGoal, NutritionLog, MealType } from '@/types/database.types';
import type { ResumenDiarioNutricion } from '@/types/app.types';

function normalizarExcluidos(log: NutritionLog | null | undefined): string[] {
  const raw = log?.excluded_meal_type_ids;
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

async function persistirMealTypeExcluidoEnLog(logId: string, mealTypeId: string) {
  const { data: row, error } = await supabase
    .from('nutrition_logs')
    .select('excluded_meal_type_ids')
    .eq('id', logId)
    .single();
  if (error) throw error;

  const cur = normalizarExcluidos(row as NutritionLog);
  if (cur.includes(mealTypeId)) return;

  const next = [...cur, mealTypeId];
  const { error: upErr } = await supabase
    .from('nutrition_logs')
    .update({ excluded_meal_type_ids: next })
    .eq('id', logId);
  if (upErr) throw upErr;
}

export const nutricionService = {
  // ─── Objetivos ─────────────────────────────────────────────────────────────

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
    userId: string,
    datos: Omit<UserGoal, 'id' | 'user_id' | 'created_at'>
  ) {
    // TODO: implementar
    // INSERT INTO user_goals
  },

  async actualizarObjetivos(
    userId: string,
    datos: Partial<Omit<UserGoal, 'id' | 'user_id' | 'created_at'>>
  ) {
    // TODO: implementar
    // UPDATE user_goals SET ... WHERE user_id = userId (el más reciente)
  },

  // ─── Tipos de comida ───────────────────────────────────────────────────────

  /**
   * Obtiene los tipos de comida del usuario (predeterminados + personalizados).
   * Los predeterminados tienen user_id = null y is_default = true.
   */
  async obtenerTiposComida(userId: string): Promise<MealType[]> {
    const { data, error } = await supabase
      .from('meal_types')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order('orden', { ascending: true });

    if (error) throw error;
    return (data ?? []) as MealType[];
  },

  // ─── Log diario ────────────────────────────────────────────────────────────

  /**
   * Obtiene o crea el log del día. Solo puede haber uno por usuario/día.
   * @returns El log con todas sus comidas y alimentos (joined)
   */
  async obtenerOCrearLogDiario(
    userId: string,
    fecha: string
  ): Promise<ResumenDiarioNutricion | null> {
    const { data: logExistente, error: errorLog } = await supabase
      .from('nutrition_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('fecha', fecha)
      .maybeSingle();

    if (errorLog) throw errorLog;

    let log = logExistente as NutritionLog | null;
    if (!log) {
      const { data: logCreado, error: errorCrearLog } = await supabase
        .from('nutrition_logs')
        .insert({ user_id: userId, fecha })
        .select('*')
        .single();

      if (errorCrearLog) throw errorCrearLog;
      log = logCreado as NutritionLog;
    }

    const mealTypes = await this.obtenerTiposComida(userId);
    const excluidosSet = new Set(normalizarExcluidos(log));

    const { data: mealsExistentes, error: errorMealsExistentes } = await supabase
      .from('nutrition_log_meals')
      .select('id, meal_type_id')
      .eq('log_id', log.id);

    if (errorMealsExistentes) throw errorMealsExistentes;

    const mealTypeIdsExistentes = new Set((mealsExistentes ?? []).map((m) => m.meal_type_id));
    const mealsFaltantes = mealTypes
      .filter((mt) => !mealTypeIdsExistentes.has(mt.id) && !excluidosSet.has(mt.id))
      .map((mt) => ({ log_id: log.id, meal_type_id: mt.id }));

    if (mealsFaltantes.length > 0) {
      const { error: errorCrearMeals } = await supabase
        .from('nutrition_log_meals')
        .insert(mealsFaltantes);
      if (errorCrearMeals) throw errorCrearMeals;
    }

    const { data: mealsConItems, error: errorMealsConItems } = await supabase
      .from('nutrition_log_meals')
      .select(`
        id,
        meal_type_id,
        meal_types (*),
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
      .eq('log_id', log.id);

    if (errorMealsConItems) throw errorMealsConItems;

    const comidas = (mealsConItems ?? []).map((meal: any) => {
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

      return {
        mealId: meal.id,
        mealType: meal.meal_types,
        items,
        totalCalorias: items.reduce((acc: number, it: any) => acc + it.calorias_calculadas, 0),
        totalProteinas: items.reduce((acc: number, it: any) => acc + it.proteinas_calculadas, 0),
        totalCarbos: items.reduce((acc: number, it: any) => acc + it.carbos_calculados, 0),
        totalGrasas: items.reduce((acc: number, it: any) => acc + it.grasas_calculadas, 0),
      };
    });

    comidas.sort((a: any, b: any) => (a.mealType?.orden ?? 999) - (b.mealType?.orden ?? 999));

    return {
      fecha,
      logId: log.id,
      totalCalorias: comidas.reduce((acc: number, c: any) => acc + c.totalCalorias, 0),
      totalProteinas: comidas.reduce((acc: number, c: any) => acc + c.totalProteinas, 0),
      totalCarbos: comidas.reduce((acc: number, c: any) => acc + c.totalCarbos, 0),
      totalGrasas: comidas.reduce((acc: number, c: any) => acc + c.totalGrasas, 0),
      comidas,
    };
  },

  // ─── Alimentos en log ──────────────────────────────────────────────────────

  /**
   * Añade un alimento a una comida del log.
   * Calcula automáticamente los macros según los gramos.
   */
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

  /** Quita la sección del día y evita que se regenere vacía al recargar. */
  async eliminarComidaDelLog(logId: string, mealId: string) {
    const { data: meal, error: errMeal } = await supabase
      .from('nutrition_log_meals')
      .select('meal_type_id')
      .eq('id', mealId)
      .eq('log_id', logId)
      .maybeSingle();
    if (errMeal) throw errMeal;
    if (!meal) {
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

    await persistirMealTypeExcluidoEnLog(logId, meal.meal_type_id as string);
  },

  async crearTipoComidaPersonalizado(userId: string, logId: string, nombre: string): Promise<MealType> {
    const trimmed = nombre.trim();
    if (!trimmed) throw new Error('Nombre vacío');

    const types = await this.obtenerTiposComida(userId);
    const maxOrden = types.length ? Math.max(...types.map((t) => t.orden)) : 0;

    const { data: mt, error } = await supabase
      .from('meal_types')
      .insert({
        nombre: trimmed,
        orden: maxOrden + 1,
        is_default: false,
        user_id: userId,
      })
      .select('*')
      .single();

    if (error) throw error;
    const row = mt as MealType;

    const { error: e2 } = await supabase.from('nutrition_log_meals').insert({
      log_id: logId,
      meal_type_id: row.id,
    });
    if (e2) throw e2;

    return row;
  },

  async pegarAlimentosEnComida(
    mealId: string,
    copias: {
      foodId: string;
      gramos: number;
      food: { calorias: number; proteinas: number; carbohidratos: number; grasas: number };
    }[],
  ) {
    for (const c of copias) {
      await this.añadirAlimentoAComida({
        mealId,
        foodId: c.foodId,
        gramos: c.gramos,
        food: c.food,
      });
    }
  },

  async actualizarGramosAlimento(itemId: string, nuevosGramos: number) {
    // TODO: implementar (recalcular macros + actualizar)
  },
};
