/**
 * SERVICIO DE EJERCICIOS
 *
 * Búsqueda de ejercicios con estrategia de caché (igual que alimentos).
 * Gestiona también ejercicios personalizados del usuario.
 */

import { supabase } from '@/lib/supabase';
import type { Exercise } from '@/types/database.types';

export const ejerciciosService = {
  /**
   * Busca ejercicios por nombre. Aplica estrategia de caché.
   */
  async buscarEjercicio(query: string): Promise<Exercise[]> {
    // TODO: implementar (mismo patrón que alimentosService.buscarAlimento)
    return [];
  },

  /**
   * Filtra ejercicios por músculo primario.
   */
  async filtrarPorMusculo(musculo: string): Promise<Exercise[]> {
    // TODO: implementar
    // SELECT * FROM exercises WHERE musculo_primario = musculo OR musculo IN musculos_secundarios
    return [];
  },

  /**
   * Obtiene un ejercicio por su ID.
   */
  async obtenerEjercicio(id: string): Promise<Exercise | null> {
    // TODO: implementar
    return null;
  },

  /**
   * Obtiene el historial de series del usuario para un ejercicio concreto.
   * Útil para mostrar la progresión en DetalleEjercicio.
   */
  async obtenerHistorialEjercicio(userId: string, exerciseId: string) {
    // TODO: implementar
    // SELECT ws.* FROM workout_sets ws
    // JOIN workout_session_exercises wse ON ws.session_exercise_id = wse.id
    // JOIN workout_sessions wsess ON wse.session_id = wsess.id
    // WHERE wsess.user_id = userId AND wse.exercise_id = exerciseId
    // ORDER BY wsess.fecha DESC
    return [];
  },

  async crearEjercicioPersonalizado(
    userId: string,
    datos: Omit<Exercise, 'id' | 'api_source' | 'api_id' | 'is_custom' | 'created_by' | 'created_at'>
  ) {
    // TODO: implementar
    // INSERT INTO exercises { ...datos, is_custom: true, created_by: userId }
  },
};
