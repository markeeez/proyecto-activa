/**
 * HOOK: useEntrenamiento
 *
 * Gestiona las sesiones de entrenamiento del día y la sesión activa.
 *
 * Retorna:
 *   - sesionesHoy: WorkoutSession[]
 *   - sesionActiva: SesionCompleta | null
 *   - cargando: boolean
 *   - crearSesion: (datos) => Promise<void>
 *   - finalizarSesion: (id) => Promise<void>
 *   - añadirEjercicio: (sessionId, exerciseId) => Promise<void>
 *   - registrarSerie: (sessionExerciseId, datos) => Promise<void>
 *
 * TODO: implementar con entrenamientoService
 * TODO: polling o subscripción realtime para series durante sesión activa
 */

import type { WorkoutSession } from '@/types/database.types';
import type { SesionCompleta } from '@/types/app.types';

export function useEntrenamiento() {
  // TODO: implementar

  return {
    sesionesHoy: [] as WorkoutSession[],
    sesionActiva: null as SesionCompleta | null,
    cargando: false,
    crearSesion: async (_datos: Pick<WorkoutSession, 'nombre' | 'notas'>) => {},
    finalizarSesion: async (_id: string) => {},
    añadirEjercicio: async (_sessionId: string, _exerciseId: string) => {},
    registrarSerie: async (_sessionExerciseId: string, _datos: any) => {},
  };
}
