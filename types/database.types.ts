/**
 * TIPOS DE BASE DE DATOS
 *
 * Representación TypeScript del esquema de Supabase.
 * Estos tipos se pueden generar automáticamente con:
 *   npx supabase gen types typescript --project-id <id> > types/database.types.ts
 *
 * Por ahora están definidos manualmente según el esquema documentado.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type Plan = 'free' | 'plus' | 'premium';

export type Objetivo =
  | 'perder_peso'
  | 'mantener'
  | 'ganar_masa'
  | 'mejorar_rendimiento';

export type CategoriaEjercicio =
  | 'fuerza'
  | 'cardio'
  | 'flexibilidad'
  | 'otro';

export type TipoSerie =
  | 'normal'
  | 'top_set'
  | 'drop_set'
  | 'calentamiento';

export type TipoPeso = 'kg' | 'bodyweight' | 'assisted';

export type ContextoIA =
  | 'general'
  | 'nutrition_log'
  | 'workout_session'
  | 'food'
  | 'exercise';

export type RolMensaje = 'user' | 'assistant';

// ─── Tablas ───────────────────────────────────────────────────────────────────

export interface Profile {
  id: string; // uuid = auth.users.id
  username: string;
  nombre: string;
  apellidos: string | null;
  plan: Plan;
  email_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserGoal {
  id: string;
  user_id: string;
  objetivo: Objetivo;
  calorias_objetivo: number;
  proteinas_objetivo: number;
  carbos_objetivo: number;
  grasas_objetivo: number;
  created_at: string;
}

export interface UserBodyMetric {
  id: string;
  user_id: string;
  peso_kg: number | null;
  altura_cm: number | null;
  grasa_corporal: number | null;
  fecha: string; // date ISO
  created_at: string;
}

/** Curado local vs referencia genérica vs producto preparado/marca */
export type FoodTier = 'master' | 'reference' | 'brand';

/** Origen canónico del registro (para badges y ranking) */
export type FoodSourceKind =
  | 'builtin'
  | 'fatsecret'
  | 'usda_foundation'
  | 'usda_sr_legacy'
  | 'usda_fndds'
  | 'openfoodfacts'
  | 'custom'
  | string;

export interface Food {
  id: string;
  nombre: string;
  api_source: string | null;
  api_id: string | null;
  calorias: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
  fibra: number | null;
  azucar: number | null;
  is_custom: boolean;
  created_by: string | null;
  created_at: string;
  /** Jerarquía de presentación (maestro > referencia > marca) */
  food_tier?: FoodTier | null;
  /** Fuente semántica (USDA Foundation, FNDDS, curado, etc.) */
  source_kind?: FoodSourceKind | null;
  /** Alimento base “oficial” o curado (badge de verificación) */
  verified_basic?: boolean | null;
}

export interface MealType {
  id: string;
  nombre: string;
  orden: number;
  is_default: boolean;
  user_id: string | null;
  created_at: string;
}

export interface NutritionLog {
  id: string;
  user_id: string;
  fecha: string; // date ISO
  created_at: string;
  /** meal_types.id excluidos de este día (no recrear fila en nutrition_log_meals) */
  excluded_meal_type_ids?: string[] | null;
}

export interface NutritionLogMeal {
  id: string;
  log_id: string;
  meal_type_id: string;
  created_at: string;
}

export interface NutritionLogItem {
  id: string;
  meal_id: string;
  food_id: string;
  gramos: number;
  calorias_calculadas: number;
  proteinas_calculadas: number;
  carbos_calculados: number;
  grasas_calculadas: number;
}

export interface Exercise {
  id: string;
  nombre: string;
  api_source: string | null;
  api_id: string | null;
  musculo_primario: string;
  musculos_secundarios: string[];
  categoria: CategoriaEjercicio;
  descripcion: string | null;
  is_custom: boolean;
  created_by: string | null;
  created_at: string;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  nombre: string | null;
  fecha: string; // date ISO
  hora_inicio: string | null; // time HH:MM
  hora_fin: string | null;
  notas: string | null;
  created_at: string;
}

export interface WorkoutSessionExercise {
  id: string;
  session_id: string;
  exercise_id: string;
  orden: number;
  notas: string | null;
}

export interface WorkoutSet {
  id: string;
  session_exercise_id: string;
  numero_serie: number;
  tipo_serie: TipoSerie;
  repeticiones: number | null;
  peso_kg: number | null;
  tipo_peso: TipoPeso;
  duracion_seg: number | null;
  descanso_seg: number | null;
  completada: boolean;
}

export interface PlanLimit {
  id: string;
  plan: Plan;
  acceso_ia: boolean;
  ai_mensajes_mes: number;
  ai_mensajes_historial: number;
  updated_at: string;
}

export interface AIUsage {
  id: string;
  user_id: string;
  mensajes_mes_actual: number;
  reset_fecha: string;
  updated_at: string;
}

export interface AIChatSession {
  id: string;
  user_id: string;
  contexto_tipo: ContextoIA;
  contexto_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIChatMessage {
  id: string;
  session_id: string;
  rol: RolMensaje;
  contenido: string;
  created_at: string;
}

export interface AINotes {
  id: string;
  user_id: string;
  contexto_tipo: Exclude<ContextoIA, 'general'>;
  contexto_id: string;
  contenido: string;
  created_at: string;
}
