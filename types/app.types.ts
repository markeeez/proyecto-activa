/**
 * TIPOS DE LA APLICACIÓN
 *
 * Tipos compuestos usados en la UI, que combinan o extienden
 * los tipos de la base de datos con datos calculados o joined.
 */

import type {
    Exercise,
    Food,
    NutritionLogItem,
    WorkoutSessionExercise,
    WorkoutSet,
} from './database.types';

// ─── Nutrición ────────────────────────────────────────────────────────────────

/** Alimento enriquecido con la cantidad consumida (para mostrar en el log) */
export interface AlimentoEnLog extends NutritionLogItem {
  food: Food;
}

/** Línea copiada para pegar en otra comida (macros por 100 g). */
export interface LineaCopiadaNutricion {
  foodId: string;
  gramos: number;
  food: { calorias: number; proteinas: number; carbohidratos: number; grasas: number };
}

/** Comida del día (fila nutrition_log_meals + items) */
export interface ComidaConAlimentos {
  mealId: string;
  nombre: string;
  orden: number;
  isDefault: boolean;
  items: AlimentoEnLog[];
  totalCalorias: number;
  totalProteinas: number;
  totalCarbos: number;
  totalGrasas: number;
}

/** Resumen del día de nutrición */
export interface ResumenDiarioNutricion {
  fecha: string;
  /** Siempre presente tras cargar (se crea el log al entrar al día) */
  logId: string;
  totalCalorias: number;
  totalProteinas: number;
  totalCarbos: number;
  totalGrasas: number;
  comidas: ComidaConAlimentos[];
}

// ─── Entrenamiento ────────────────────────────────────────────────────────────

/** Ejercicio enriquecido con sus series (para mostrar en sesión) */
export interface EjercicioEnSesion extends WorkoutSessionExercise {
  exercise: Exercise;
  sets: WorkoutSet[];
}

/** Sesión activa con todos sus ejercicios y series */
export interface SesionCompleta {
  id: string;
  nombre: string | null;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  notas: string | null;
  ejercicios: EjercicioEnSesion[];
  estaActiva: boolean; // hora_fin === null
}

// ─── IA ───────────────────────────────────────────────────────────────────────

/** Mensaje para mostrar en el chat */
export interface MensajeChat {
  id: string;
  rol: 'user' | 'assistant';
  contenido: string;
  created_at: string;
}

// ─── Estado de carga ──────────────────────────────────────────────────────────

export type EstadoCarga = 'idle' | 'cargando' | 'exito' | 'error';

export interface EstadoAsync<T> {
  datos: T | null;
  estado: EstadoCarga;
  error: string | null;
}
