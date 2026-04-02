/**
 * SERVICIO DE ENTRENAMIENTO
 *
 * Gestiona workout_sessions, workout_session_exercises y workout_sets.
 */

import { supabase } from '@/lib/supabase';
import type {
  WorkoutSession,
  WorkoutSet,
} from '@/types/database.types';
import type { SesionCompleta } from '@/types/app.types';

export const entrenamientoService = {
  // ─── Sesiones ──────────────────────────────────────────────────────────────

  async obtenerSesionesDia(userId: string, fecha: string): Promise<WorkoutSession[]> {
    // TODO: implementar
    // SELECT * FROM workout_sessions WHERE user_id = userId AND fecha = fecha
    // ORDER BY created_at
    return [];
  },

  async obtenerSesion(sessionId: string): Promise<SesionCompleta | null> {
    // TODO: implementar
    // SELECT sesion + ejercicios + series (todo joined)
    return null;
  },

  async crearSesion(
    userId: string,
    datos: Pick<WorkoutSession, 'nombre' | 'notas'>
  ): Promise<WorkoutSession | null> {
    // TODO: implementar
    // INSERT INTO workout_sessions {
    //   user_id, nombre, notas,
    //   fecha: hoy,
    //   hora_inicio: ahora
    // }
    return null;
  },

  async finalizarSesion(sessionId: string) {
    // TODO: implementar
    // UPDATE workout_sessions SET hora_fin = ahora WHERE id = sessionId
  },

  // ─── Ejercicios en sesión ──────────────────────────────────────────────────

  async añadirEjercicio(sessionId: string, exerciseId: string) {
    // TODO: implementar
    // 1. Obtener el orden máximo actual
    // 2. INSERT INTO workout_session_exercises { session_id, exercise_id, orden: max+1 }
  },

  async eliminarEjercicioDeSesion(sessionExerciseId: string) {
    // TODO: implementar (elimina también sus series en cascada)
    // DELETE FROM workout_session_exercises WHERE id = sessionExerciseId
  },

  // ─── Series ────────────────────────────────────────────────────────────────

  async añadirSerie(
    sessionExerciseId: string,
    datos: Pick<WorkoutSet, 'tipo_serie' | 'repeticiones' | 'peso_kg' | 'tipo_peso' | 'duracion_seg' | 'descanso_seg'>
  ) {
    // TODO: implementar
    // 1. Obtener numero_serie máximo para ese ejercicio
    // 2. INSERT INTO workout_sets { session_exercise_id, numero_serie: max+1, ...datos }
  },

  async actualizarSerie(
    setId: string,
    datos: Partial<WorkoutSet>
  ) {
    // TODO: implementar
    // UPDATE workout_sets SET { ...datos } WHERE id = setId
  },

  async marcarSerieCompletada(setId: string, completada: boolean) {
    // TODO: implementar
    // UPDATE workout_sets SET completada = completada WHERE id = setId
  },

  async eliminarSerie(setId: string) {
    // TODO: implementar
    // DELETE FROM workout_sets WHERE id = setId
  },

  // ─── Historial ─────────────────────────────────────────────────────────────

  async obtenerHistorialSesiones(userId: string, limite = 20): Promise<WorkoutSession[]> {
    // TODO: implementar
    // SELECT * FROM workout_sessions WHERE user_id = userId
    // ORDER BY fecha DESC, created_at DESC LIMIT limite
    return [];
  },
};
