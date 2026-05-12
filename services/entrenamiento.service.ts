/**
 * SERVICIO DE ENTRENAMIENTO
 *
 * Gestiona workout_sessions, workout_session_exercises y workout_sets.
 */

import { supabase } from '@/lib/supabase';
import type {
  TrackingMode,
  TipoPeso,
  TipoSerie,
  WorkoutSession,
  WorkoutSet,
} from '@/types/database.types';
import type { TipoSeriePlantillaDb } from '@/lib/entrenamientoSerie';
import type { RecordBaseline, RecordEvent, RecordType, RecordUsuario } from '@/lib/entrenamientoRecords';
import { fechaIsoDesdeDate } from '@/lib/fechaNutricion';
import type { SesionCompleta } from '@/types/app.types';

/** Listado de rutinas con nombres de ejercicios (plantilla). */
export type RutinaListaVista = {
  id: string;
  nombre: string;
  ejercicios: string[];
};

/** Detalle completo de una rutina (plantilla) para pantalla de detalle / edición. */
export type DetalleRutinaSet = {
  numero_serie: number;
  tipo_serie: TipoSeriePlantillaDb;
  reps: number | null;
  rir: number | null;
  peso_kg: number | null;
  tipo_peso: TipoPeso;
  duracion_seg?: number | null;
  distancia_km?: number | null;
};

export type DetalleRutinaEjercicio = {
  id: string;
  exercise_id: string;
  orden: number;
  notas: string | null;
  exercises: { nombre: string; musculo_primario: string; foto_url: string | null; tracking_mode: TrackingMode };
  routine_sets: DetalleRutinaSet[];
};

export type DetalleRutina = {
  id: string;
  nombre: string;
  routine_exercises: DetalleRutinaEjercicio[];
};

type RoutineJoinRow = {
  id: string;
  nombre: string;
  routine_exercises?: {
    orden: number;
    /** PostgREST puede devolver objeto o array de 1 elemento según tipos generados. */
    exercises: { nombre: string } | { nombre: string }[] | null;
  }[] | null;
};

function mapRoutineJoin(row: RoutineJoinRow): RutinaListaVista {
  const lines = (row.routine_exercises ?? [])
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((re) => {
      const ex = re.exercises;
      const one = Array.isArray(ex) ? ex[0] : ex;
      return one?.nombre?.trim() ?? '';
    })
    .filter((n) => n.length > 0);
  return { id: row.id, nombre: row.nombre, ejercicios: lines };
}

/** Borrador al guardar rutina desde la pantalla Crear rutina */
export type BorradorSerieRutina = {
  numero_serie: number;
  tipo_serie: TipoSeriePlantillaDb;
  repeticiones: number | null;
  peso_kg: number | null;
  tipo_peso: TipoPeso;
  duracion_seg?: number | null;
  distancia_km?: number | null;
};

export type BorradorEjercicioRutina = {
  exercise_id: string;
  orden: number;
  sets: BorradorSerieRutina[];
};

/** Ejercicio + series al cargar una rutina como plantilla de entreno */
export type EjercicioBorrador = {
  exercise_id: string;
  orden: number;
  nombre: string;
  musculo_primario: string;
  tracking_mode: TrackingMode;
  sets: {
    numero_serie: number;
    tipo_serie: TipoSeriePlantillaDb;
    repeticiones: number | null;
    peso_kg: number | null;
    tipo_peso: TipoPeso;
    duracion_seg?: number | null;
    distancia_km?: number | null;
  }[];
};

export type EntrenoEjercicioPersistido = {
  exercise_id: string;
  orden: number;
  /** workout_session_exercises.notas */
  notas?: string | null;
  sets: {
    numero_serie: number;
    tipo_serie: TipoSeriePlantillaDb;
    repeticiones: number | null;
    rir?: number | null;
    peso_kg: number | null;
    tipo_peso: TipoPeso;
    duracion_seg?: number | null;
    distancia_km?: number | null;
    descanso_seg?: number | null;
  }[];
};

/** Listado de sesiones en un rango de fechas (calendario). */
export type SesionResumen = {
  id: string;
  nombre: string | null;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
};

export type EntrenoResumen = {
  id: string;
  nombre: string | null;
  rutinaNombre: string | null;
  fecha: string;
  horaInicio: string | null;
  horaFin: string | null;
  ejercicios: {
    ejercicioId: string;
    nombre: string;
    fotoUrl: string | null;
    numSeries: number;
  }[];
  totalEjercicios: number;
  volumenKg: number;
};

export type DetalleSesionSet = {
  id: string;
  numero_serie: number;
  tipo_serie: TipoSerie;
  peso_kg: number | null;
  repeticiones: number | null;
  rir: number | null;
  tipo_peso: TipoPeso;
  duracion_seg: number | null;
  distancia_km: number | null;
  completada: boolean;
  descanso_seg: number | null;
};

export type DetalleSesionEjercicio = {
  id: string;
  exercise_id: string;
  nombre: string;
  musculo_primario: string;
  foto_url: string | null;
  tracking_mode: TrackingMode;
  notas: string | null;
  sets: DetalleSesionSet[];
};

export type DetalleSesion = {
  id: string;
  nombre: string | null;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  ejercicios: DetalleSesionEjercicio[];
};

/** Última sesión completada de una rutina (para precargar entreno y columna Anterior por serie). */
export type UltimaSesionRutina = {
  sessionId: string;
  ejercicios: {
    exercise_id: string;
    orden: number;
    sets: {
      numero_serie: number;
      peso_kg: number | null;
      repeticiones: number | null;
      tipo_peso: string;
      duracion_seg: number | null;
      distancia_km: number | null;
    }[];
  }[];
};

/** Rutina predeterminada para explorar (lista + filtros en cliente). */
export type RutinaExplorar = {
  id: string;
  nombre: string;
  descripcion: string | null;
  dificultad: string | null;
  musculos: string[];
  /** `musculo_primario` por ejercicio (orden de plantilla); necesario para filtros/orden por músculo. */
  musculosPorEjercicio: string[];
  esFavorita: boolean;
};

type SesionSemanaRow = {
  id: string;
  nombre: string | null;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
};

type VolumenSemanaRow = {
  workout_session_exercises: {
    workout_sets: { peso_kg: number | null; repeticiones: number | null; completada: boolean }[] | null;
  }[] | null;
};

type DetalleSesionRow = {
  id: string;
  nombre: string | null;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
    workout_session_exercises: {
    id: string;
    orden: number;
    exercise_id: string;
    notas: string | null;
    exercises:
      | { nombre: string; musculo_primario: string; foto_url: string | null; tracking_mode: TrackingMode | null }
      | { nombre: string; musculo_primario: string; foto_url: string | null; tracking_mode: TrackingMode | null }[]
      | null;
    workout_sets: {
      id: string;
      numero_serie: number;
      tipo_serie: TipoSerie;
      peso_kg: number | null;
      repeticiones: number | null;
      rir: number | null;
      tipo_peso: TipoPeso;
      duracion_seg: number | null;
      distancia_km: number | null;
      completada: boolean;
      descanso_seg: number | null;
    }[] | null;
  }[] | null;
};

type RecordBaselineRpcRow = {
  exercise_id: string;
  record_type: RecordType;
  value: number | string;
};

type RecordEventRpcRow = {
  exercise_id: string;
  workout_set_id: string;
  record_type: RecordType;
  value: number | string;
};

function formatearAnteriorSet(peso_kg: number | null, repeticiones: number | null, tipo_peso: TipoPeso): string {
  const r = repeticiones != null ? String(repeticiones) : '—';
  if (tipo_peso === 'bodyweight') return `BW × ${r}`;
  if (tipo_peso === 'assisted') return `Asist. × ${r}`;
  const p = peso_kg != null ? `${peso_kg}kg` : '—';
  return `${p} × ${r}`;
}

function trackingModeSeguro(value: TrackingMode | string | null | undefined): TrackingMode {
  return value === 'cardio_time' || value === 'cardio_time_distance' ? value : 'strength';
}

function formatearDuracionCardio(seg: number | null | undefined): string {
  if (seg == null || !Number.isFinite(Number(seg)) || Number(seg) <= 0) return '—';
  const total = Math.round(Number(seg));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatearAnteriorCardio(duracionSeg: number | null, distanciaKm: number | null): string {
  const tiempo = formatearDuracionCardio(duracionSeg);
  if (distanciaKm != null && Number.isFinite(Number(distanciaKm)) && Number(distanciaKm) > 0) {
    return `${tiempo} · ${Number(distanciaKm).toLocaleString('es-ES', { maximumFractionDigits: 2 })} km`;
  }
  return tiempo;
}

type RoutineExerciseJoinRow = {
  orden: number;
  exercise_id: string;
  exercises:
    | { nombre: string; musculo_primario: string; tracking_mode: TrackingMode | null }
    | { nombre: string; musculo_primario: string; tracking_mode: TrackingMode | null }[]
    | null;
  routine_sets:
    | {
        numero_serie: number;
        tipo_serie: TipoSeriePlantillaDb;
        reps: number | null;
        peso_kg: number | null;
        tipo_peso: TipoPeso;
        duracion_seg?: number | null;
        distancia_km?: number | null;
      }[]
    | null;
};

/** Fila cruda de join: relaciones anidadas suelen inferirse como objeto o array. */
type AnteriorJoinRowRaw = {
  duracion_seg?: number | null;
  distancia_km?: number | null;
  repeticiones: number | null;
  peso_kg: number | null;
  tipo_peso: TipoPeso;
  workout_session_exercises:
    | {
        exercise_id: string;
        workout_sessions:
          | { user_id: string; fecha: string; created_at: string }
          | { user_id: string; fecha: string; created_at: string }[];
      }
    | {
        exercise_id: string;
        workout_sessions:
          | { user_id: string; fecha: string; created_at: string }
          | { user_id: string; fecha: string; created_at: string }[];
      }[]
    | null;
};

type AnteriorJoinRow = {
  repeticiones: number | null;
  peso_kg: number | null;
  tipo_peso: TipoPeso;
  workout_session_exercises: {
    exercise_id: string;
    workout_sessions: { user_id: string; fecha: string; created_at: string };
  };
};

function normalizarAnteriorJoinRow(r: AnteriorJoinRowRaw): AnteriorJoinRow | null {
  const wseRaw = r.workout_session_exercises;
  const wse = Array.isArray(wseRaw) ? wseRaw[0] : wseRaw;
  if (!wse) return null;
  const sessRaw = wse.workout_sessions;
  const sess = Array.isArray(sessRaw) ? sessRaw[0] : sessRaw;
  if (!sess) return null;
  return {
    repeticiones: r.repeticiones,
    peso_kg: r.peso_kg,
    tipo_peso: r.tipo_peso,
    workout_session_exercises: {
      exercise_id: wse.exercise_id,
      workout_sessions: sess,
    },
  };
}

type RoutineMetaRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  dificultad: string | null;
  is_default: boolean;
  is_public: boolean;
  created_by: string | null;
};

async function obtenerMetaRutina(routineId: string): Promise<RoutineMetaRow | null> {
  const { data, error } = await supabase
    .from('routines')
    .select('id, nombre, descripcion, dificultad, is_default, is_public, created_by')
    .eq('id', routineId)
    .maybeSingle();

  if (error) {
    console.error('[obtenerMetaRutina]', error.message);
    return null;
  }
  return (data as RoutineMetaRow | null) ?? null;
}

async function limpiarRutinaClonada(routineId: string): Promise<void> {
  const { data: reRows, error: reErr } = await supabase.from('routine_exercises').select('id').eq('routine_id', routineId);
  if (reErr) {
    console.error('[limpiarRutinaClonada] routine_exercises select', reErr.message);
  } else {
    const routineExerciseIds = (reRows ?? []).map((row: { id: string }) => row.id);
    if (routineExerciseIds.length > 0) {
      const { error: rsErr } = await supabase.from('routine_sets').delete().in('routine_exercise_id', routineExerciseIds);
      if (rsErr) console.error('[limpiarRutinaClonada] routine_sets delete', rsErr.message);
    }
    const { error: delReErr } = await supabase.from('routine_exercises').delete().eq('routine_id', routineId);
    if (delReErr) console.error('[limpiarRutinaClonada] routine_exercises delete', delReErr.message);
  }

  const { error: delRoutineErr } = await supabase.from('routines').delete().eq('id', routineId);
  if (delRoutineErr) console.error('[limpiarRutinaClonada] routines delete', delRoutineErr.message);
}

async function escribirRutinaEjercicios(routineId: string, ejercicios: BorradorEjercicioRutina[]): Promise<void> {
  // Paso 0 — borrar ejercicios anteriores (cascade borra sus sets)
  const { error: delErr } = await supabase.from('routine_exercises').delete().eq('routine_id', routineId);
  if (delErr) {
    console.error('[escribirRutinaEjercicios] delete', delErr.message);
    throw new Error(delErr.message);
  }

  if (ejercicios.length === 0) return;

  // Paso 1 — batch insert de todos los ejercicios a la vez
  const { data: reRows, error: errRe } = await supabase
    .from('routine_exercises')
    .insert(
      ejercicios.map((ex) => ({
        routine_id: routineId,
        exercise_id: ex.exercise_id,
        orden: ex.orden,
        notas: null,
      })),
    )
    .select('id, exercise_id, orden');

  if (errRe || !reRows?.length) {
    console.error('[escribirRutinaEjercicios] routine_exercises', errRe?.message);
    throw new Error(errRe?.message ?? 'No se pudo guardar la rutina.');
  }

  // Mapear exercise_id+orden → routine_exercise_id recién creado
  const reIdMap = new Map(reRows.map((r: { id: string; exercise_id: string; orden: number }) => [`${r.exercise_id}:${r.orden}`, r.id]));

  // Paso 2 — batch insert de todos los sets a la vez
  const setRows = ejercicios.flatMap((ex) => {
    const reId = reIdMap.get(`${ex.exercise_id}:${ex.orden}`);
    if (!reId) return [];
    return ex.sets.map((set) => ({
      routine_exercise_id: reId,
      numero_serie: set.numero_serie,
      tipo_serie: set.tipo_serie,
      reps: set.repeticiones,
      peso_kg: set.peso_kg,
      tipo_peso: set.tipo_peso,
      duracion_seg: set.duracion_seg ?? null,
      distancia_km: set.distancia_km ?? null,
    }));
  });

  if (setRows.length === 0) return;

  const { error: errSet } = await supabase.from('routine_sets').insert(setRows);
  if (errSet) {
    console.error('[escribirRutinaEjercicios] routine_sets', errSet.message);
    throw new Error(errSet.message);
  }
}

async function clonarRutinaBase(original: RoutineMetaRow, userId: string): Promise<string> {
  const { data: routineRow, error: errRoutine } = await supabase
    .from('routines')
    .insert({
      nombre: original.nombre,
      descripcion: original.descripcion,
      dificultad: original.dificultad,
      created_by: userId,
      is_default: false,
      is_public: false,
    })
    .select('id')
    .single();

  if (errRoutine || !routineRow?.id) {
    console.error('[clonarRutinaBase] routines', errRoutine?.message);
    throw new Error(errRoutine?.message ?? 'No se pudo clonar la rutina.');
  }

  const nuevoRoutineId = routineRow.id as string;

  type CloneExerciseRow = {
    id: string;
    exercise_id: string;
    orden: number;
    notas: string | null;
    routine_sets:
      | {
          numero_serie: number;
          tipo_serie: TipoSeriePlantillaDb;
          reps: number | null;
          peso_kg: number | null;
          tipo_peso: TipoPeso | null;
          duracion_seg: number | null;
          distancia_km: number | null;
        }[]
      | null;
  };

  const { data: exerciseRows, error: exerciseErr } = await supabase
    .from('routine_exercises')
    .select('id, exercise_id, orden, notas, routine_sets ( numero_serie, tipo_serie, reps, peso_kg, tipo_peso, duracion_seg, distancia_km )')
    .eq('routine_id', original.id)
    .order('orden');

  if (exerciseErr) {
    console.error('[clonarRutinaBase] routine_exercises', exerciseErr.message);
    await limpiarRutinaClonada(nuevoRoutineId);
    throw new Error(exerciseErr.message);
  }

  for (const originalEx of (exerciseRows ?? []) as CloneExerciseRow[]) {
    const { data: newReRow, error: newReErr } = await supabase
      .from('routine_exercises')
      .insert({
        routine_id: nuevoRoutineId,
        exercise_id: originalEx.exercise_id,
        orden: originalEx.orden,
        notas: originalEx.notas,
      })
      .select('id')
      .single();

    if (newReErr || !newReRow?.id) {
      console.error('[clonarRutinaBase] clone routine_exercises', newReErr?.message);
      await limpiarRutinaClonada(nuevoRoutineId);
      throw new Error(newReErr?.message ?? 'No se pudo clonar la rutina.');
    }

    const newRoutineExerciseId = newReRow.id as string;
    for (const set of originalEx.routine_sets ?? []) {
      const { error: setErr } = await supabase.from('routine_sets').insert({
        routine_exercise_id: newRoutineExerciseId,
        numero_serie: set.numero_serie,
        tipo_serie: set.tipo_serie,
        reps: set.reps,
        peso_kg: set.peso_kg,
        tipo_peso: set.tipo_peso ?? 'kg',
        duracion_seg: set.duracion_seg ?? null,
        distancia_km: set.distancia_km ?? null,
      });

      if (setErr) {
        console.error('[clonarRutinaBase] clone routine_sets', setErr.message);
        await limpiarRutinaClonada(nuevoRoutineId);
        throw new Error(setErr.message);
      }
    }
  }

  return nuevoRoutineId;
}

export const entrenamientoService = {
  /**
   * Persiste plantilla en routines → routine_exercises → routine_sets (no workout_*).
   */
  async guardarRutinaDesdeBorrador(
    userId: string,
    titulo: string,
    ejercicios: BorradorEjercicioRutina[],
  ): Promise<{ ok: true; routineId: string } | { ok: false; error: string }> {
    const tituloLimpio = titulo.trim();
    if (!tituloLimpio) {
      return { ok: false, error: 'Indica un título para la rutina.' };
    }
    if (!ejercicios.length) {
      return { ok: false, error: 'Añade al menos un ejercicio.' };
    }

    const { data: routineRow, error: errRoutine } = await supabase
      .from('routines')
      .insert({
        nombre: tituloLimpio,
        created_by: userId,
        is_default: false,
        is_public: false,
      })
      .select('id')
      .single();

    if (errRoutine || !routineRow?.id) {
      console.error('[guardarRutinaDesdeBorrador] routines', errRoutine?.message);
      return { ok: false, error: errRoutine?.message ?? 'No se pudo crear la rutina.' };
    }

    const routineId = routineRow.id as string;

    // PERF-03: batch insert — 1 query para ejercicios + 1 query para sets
    // (antes: N ejercicios × M sets = N+1+N*M round-trips)
    const { data: reRows, error: errRe } = await supabase
      .from('routine_exercises')
      .insert(
        ejercicios.map((ex) => ({
          routine_id: routineId,
          exercise_id: ex.exercise_id,
          orden: ex.orden,
          notas: null,
        })),
      )
      .select('id, exercise_id, orden');

    if (errRe || !reRows?.length) {
      console.error('[guardarRutinaDesdeBorrador] routine_exercises', errRe?.message);
      return { ok: false, error: errRe?.message ?? 'Error al guardar ejercicios de la rutina.' };
    }

    const reIdMap = new Map(
      (reRows as { id: string; exercise_id: string; orden: number }[]).map((r) => [
        `${r.exercise_id}:${r.orden}`,
        r.id,
      ]),
    );

    const setRows = ejercicios.flatMap((ex) => {
      const reId = reIdMap.get(`${ex.exercise_id}:${ex.orden}`);
      if (!reId) return [];
      return ex.sets.map((set) => ({
        routine_exercise_id: reId,
        numero_serie: set.numero_serie,
        tipo_serie: set.tipo_serie,
        reps: set.repeticiones,
        peso_kg: set.peso_kg,
        tipo_peso: set.tipo_peso,
        duracion_seg: set.duracion_seg ?? null,
        distancia_km: set.distancia_km ?? null,
      }));
    });

    if (setRows.length > 0) {
      const { error: errSet } = await supabase.from('routine_sets').insert(setRows);
      if (errSet) {
        console.error('[guardarRutinaDesdeBorrador] routine_sets', errSet.message);
        return { ok: false, error: errSet.message };
      }
    }

    return { ok: true, routineId };
  },

  async obtenerMisRutinas(userId: string): Promise<RutinaListaVista[]> {
    const { data, error } = await supabase
      .from('routines')
      .select('id, nombre, routine_exercises ( orden, exercises ( nombre ) )')
      .eq('created_by', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[obtenerMisRutinas]', error.message);
      return [];
    }
    return (data ?? []).map((row) => mapRoutineJoin(row as RoutineJoinRow));
  },

  async obtenerRutinasFavoritas(userId: string): Promise<RutinaListaVista[]> {
    const { data, error } = await supabase
      .from('user_favorite_routines')
      .select('routines ( id, nombre, routine_exercises ( orden, exercises ( nombre ) ) )')
      .eq('user_id', userId);

    if (error) {
      console.error('[obtenerRutinasFavoritas]', error.message);
      return [];
    }

    const out: RutinaListaVista[] = [];
    for (const row of data ?? []) {
      const r = (row as { routines: RoutineJoinRow | RoutineJoinRow[] | null }).routines;
      if (r == null) continue;
      const one = Array.isArray(r) ? r[0] : r;
      if (one?.id) out.push(mapRoutineJoin(one));
    }
    return out;
  },

  async toggleFavoritoRutina(userId: string, routineId: string): Promise<void> {
    const { data: existing } = await supabase
      .from('user_favorite_routines')
      .select('routine_id')
      .eq('user_id', userId)
      .eq('routine_id', routineId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('user_favorite_routines')
        .delete()
        .eq('user_id', userId)
        .eq('routine_id', routineId);
      if (error) console.error('[toggleFavoritoRutina] delete', error.message);
      return;
    }

    const { error } = await supabase.from('user_favorite_routines').insert({
      user_id: userId,
      routine_id: routineId,
    });
    if (error) console.error('[toggleFavoritoRutina] insert', error.message);
  },

  async obtenerRoutineIdsFavoritas(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('user_favorite_routines')
      .select('routine_id')
      .eq('user_id', userId);

    if (error) {
      console.error('[obtenerRoutineIdsFavoritas]', error.message);
      return [];
    }
    return (data ?? []).map((r: { routine_id: string }) => r.routine_id);
  },

  async obtenerDetalleRutina(routineId: string): Promise<DetalleRutina | null> {
    const { data, error } = await supabase
      .from('routines')
      .select(
        `id, nombre,
        routine_exercises (
          id, exercise_id, orden, notas,
          exercises ( nombre, musculo_primario, foto_url, tracking_mode ),
          routine_sets ( numero_serie, tipo_serie, reps, peso_kg, tipo_peso, duracion_seg, distancia_km )
        )`,
      )
      .eq('id', routineId)
      .maybeSingle();

    if (error) {
      console.error('[obtenerDetalleRutina]', error.message);
      return null;
    }
    if (!data) return null;

    const rirPorSet = new Map<string, number | null>();
    const { data: ultimaSesion, error: ultimaSesionError } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('routine_id', routineId)
      .not('hora_fin', 'is', null)
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultimaSesionError) {
      console.error('[obtenerDetalleRutina] ultima sesion', ultimaSesionError.message);
    } else if (ultimaSesion?.id) {
      type UltimaWseRow = {
        orden: number;
        exercise_id: string;
        workout_sets:
          | {
              numero_serie: number;
              rir: number | null;
              completada: boolean;
            }[]
          | null;
      };

      const { data: ultimaWse, error: ultimaWseError } = await supabase
        .from('workout_session_exercises')
        .select('orden, exercise_id, workout_sets ( numero_serie, rir, completada )')
        .eq('session_id', ultimaSesion.id)
        .order('orden');

      if (ultimaWseError) {
        console.error('[obtenerDetalleRutina] ultima sesion sets', ultimaWseError.message);
      } else {
        for (const wse of (ultimaWse ?? []) as UltimaWseRow[]) {
          for (const set of wse.workout_sets ?? []) {
            if (!set.completada) continue;
            rirPorSet.set(`${wse.exercise_id}:${wse.orden}:${set.numero_serie}`, set.rir ?? null);
          }
        }
      }
    }

    type ReRow = {
      id: string;
      exercise_id: string;
      orden: number;
      notas: string | null;
      exercises:
        | { nombre: string; musculo_primario: string; foto_url: string | null; tracking_mode: TrackingMode | null }
        | { nombre: string; musculo_primario: string; foto_url: string | null; tracking_mode: TrackingMode | null }[]
        | null;
      routine_sets:
        | {
            numero_serie: number;
            tipo_serie: TipoSeriePlantillaDb;
            reps: number | null;
            peso_kg: number | null;
            tipo_peso: TipoPeso | null;
            duracion_seg: number | null;
            distancia_km: number | null;
          }[]
        | null;
    };

    const row = data as { id: string; nombre: string; routine_exercises: ReRow[] | null };
    const rexList = (row.routine_exercises ?? []).slice().sort((a, b) => a.orden - b.orden);

    const routine_exercises: DetalleRutinaEjercicio[] = rexList.map((re) => {
      const exRaw = re.exercises;
      const exOne = Array.isArray(exRaw) ? exRaw[0] : exRaw;
      const setsRaw = re.routine_sets ?? [];
      const routine_sets: DetalleRutinaSet[] = setsRaw
        .slice()
        .sort((a, b) => a.numero_serie - b.numero_serie)
        .map((s) => ({
          numero_serie: s.numero_serie,
          tipo_serie: s.tipo_serie,
          reps: s.reps,
          rir: rirPorSet.get(`${re.exercise_id}:${re.orden}:${s.numero_serie}`) ?? null,
          peso_kg: s.peso_kg,
          tipo_peso: (s.tipo_peso ?? 'kg') as TipoPeso,
          duracion_seg: s.duracion_seg ?? null,
          distancia_km: s.distancia_km ?? null,
        }));
      return {
        id: re.id,
        exercise_id: re.exercise_id,
        orden: re.orden,
        notas: re.notas,
        exercises: {
          nombre: exOne?.nombre?.trim() ?? 'Ejercicio',
          musculo_primario: exOne?.musculo_primario?.trim() ?? '',
          foto_url: exOne?.foto_url != null && String(exOne.foto_url).trim() !== '' ? String(exOne.foto_url).trim() : null,
          tracking_mode: trackingModeSeguro(exOne?.tracking_mode),
        },
        routine_sets,
      };
    });

    return {
      id: row.id,
      nombre: row.nombre,
      routine_exercises,
    };
  },

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

  // ─── Entreno activo (workout_sessions + session exercises + sets) ───────────

  async crearWorkoutSession(userId: string, nombre: string, routineId: string | null): Promise<string> {
    const hoy = new Date();
    const fecha = fechaIsoDesdeDate(hoy);
    const horaInicio = hoy.toISOString();

    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: userId,
        nombre: nombre || 'Entreno',
        fecha,
        hora_inicio: horaInicio,
        hora_fin: null,
        notas: null,
        routine_id: routineId,
      })
      .select('id')
      .single();

    if (error || !data?.id) {
      console.error('[crearWorkoutSession]', error?.message);
      throw new Error(error?.message ?? 'No se pudo crear la sesión');
    }
    return data.id as string;
  },

  async marcarHoraFinWorkoutSession(sessionId: string): Promise<void> {
    const fin = new Date();
    const horaFin = fin.toISOString();
    const fecha = fechaIsoDesdeDate(fin);
    const { error } = await supabase.from('workout_sessions').update({ fecha, hora_fin: horaFin }).eq('id', sessionId);
    if (error) console.error('[marcarHoraFinWorkoutSession]', error.message);
  },

  async actualizarWorkoutSession(
    sessionId: string,
    datos: { nombre?: string; routine_id?: string | null },
  ): Promise<void> {
    const payload: { nombre?: string; routine_id?: string | null } = {};
    if (datos.nombre !== undefined) payload.nombre = datos.nombre;
    if (datos.routine_id !== undefined) payload.routine_id = datos.routine_id;
    if (Object.keys(payload).length === 0) return;
    const { error } = await supabase.from('workout_sessions').update(payload).eq('id', sessionId);
    if (error) console.error('[actualizarWorkoutSession]', error.message);
  },

  async actualizarDuracionSesion(
    sessionId: string,
    hora_inicio: string,
    hora_fin: string,
  ): Promise<void> {
    const { error } = await supabase
      .from('workout_sessions')
      .update({ hora_inicio, hora_fin })
      .eq('id', sessionId);
    if (error) throw new Error(error.message);
  },

  async cargarEjerciciosDesdeRutina(routineId: string): Promise<EjercicioBorrador[]> {
    const { data, error } = await supabase
      .from('routine_exercises')
      .select(
        'orden, exercise_id, exercises ( nombre, musculo_primario, tracking_mode ), routine_sets ( numero_serie, tipo_serie, reps, peso_kg, tipo_peso, duracion_seg, distancia_km )',
      )
      .eq('routine_id', routineId)
      .order('orden');

    if (error) {
      console.error('[cargarEjerciciosDesdeRutina]', error.message);
      return [];
    }

    const rows = (data ?? []) as RoutineExerciseJoinRow[];
    return rows
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((row) => {
        const ex = row.exercises;
        const exObj = Array.isArray(ex) ? ex[0] : ex;
        const nombre = exObj?.nombre?.trim() ?? 'Ejercicio';
        const musculo = exObj?.musculo_primario?.trim() ?? '';
        const tracking_mode = trackingModeSeguro(exObj?.tracking_mode);
        const setsRaw = row.routine_sets ?? [];
        const sets = setsRaw
          .slice()
          .sort((a, b) => a.numero_serie - b.numero_serie)
          .map((s) => ({
            numero_serie: s.numero_serie,
            tipo_serie: s.tipo_serie,
            repeticiones: s.reps,
            peso_kg: s.peso_kg,
            tipo_peso: s.tipo_peso ?? 'kg',
            duracion_seg: s.duracion_seg ?? null,
            distancia_km: s.distancia_km ?? null,
          }));
        return {
          exercise_id: row.exercise_id,
          orden: row.orden,
          nombre,
          musculo_primario: musculo,
          tracking_mode,
          sets,
        };
      });
  },

  async obtenerAnteriorPorEjercicio(_userId: string, exerciseId: string): Promise<string | null> {
    // RPC: Postgres filtra por auth.uid(), ordena por sesión más reciente y devuelve 1 fila.
    // Antes: join de 50 filas al cliente + sort en JS. Ahora: 1 fila, 0 JS.
    const { data, error } = await supabase.rpc('obtener_anterior_ejercicio_registro', {
      p_exercise_id: exerciseId,
    });

    if (error) {
      console.error('[obtenerAnteriorPorEjercicio]', error.message);
      return null;
    }

    const row = (data as any[])?.[0];
    if (!row) return null;
    const tracking = trackingModeSeguro(row.tracking_mode);
    if (tracking !== 'strength') {
      return formatearAnteriorCardio(row.duracion_seg ?? null, row.distancia_km ?? null);
    }
    return formatearAnteriorSet(row.peso_kg, row.repeticiones, row.tipo_peso);
  },

  async guardarSetsCompletados(sessionId: string, ejercicios: EntrenoEjercicioPersistido[]): Promise<void> {
    const workoutSetIds: string[] = [];

    for (const ex of ejercicios) {
      if (!ex.sets.length) continue;

      const { data: wseRow, error: errWse } = await supabase
        .from('workout_session_exercises')
        .insert({
          session_id: sessionId,
          exercise_id: ex.exercise_id,
          orden: ex.orden,
          notas: ex.notas != null && ex.notas.trim() !== '' ? ex.notas.trim() : null,
        })
        .select('id')
        .single();

      if (errWse || !wseRow?.id) {
        console.error('[guardarSetsCompletados] workout_session_exercises', errWse?.message);
        continue;
      }

      const sessionExerciseId = wseRow.id as string;

      for (const set of ex.sets) {
        const { data: setRow, error: errSet } = await supabase
          .from('workout_sets')
          .insert({
            session_exercise_id: sessionExerciseId,
            numero_serie: set.numero_serie,
            tipo_serie: set.tipo_serie,
            repeticiones: set.repeticiones,
            rir: set.rir ?? null,
            peso_kg: set.peso_kg,
            tipo_peso: set.tipo_peso,
            duracion_seg: set.duracion_seg ?? null,
            distancia_km: set.distancia_km ?? null,
            descanso_seg: set.descanso_seg ?? null,
            completada: true,
          })
          .select('id')
          .single();
        if (errSet) console.error('[guardarSetsCompletados] workout_sets', errSet.message);
        else if (setRow?.id) workoutSetIds.push(setRow.id as string);
      }
    }

    if (workoutSetIds.length > 0) {
      const { error } = await supabase.rpc('registrar_record_events_para_sets', {
        p_set_ids: workoutSetIds,
      });
      if (error) console.error('[guardarSetsCompletados] registrar_record_events_para_sets', error.message);
    }
  },

  async obtenerRecordsVigentesEjercicios(_userId: string, exerciseIds: string[]): Promise<RecordBaseline[]> {
    const ids = [...new Set(exerciseIds.filter(Boolean))];
    if (!ids.length) return [];

    const { data, error } = await supabase.rpc('obtener_records_vigentes_ejercicios', {
      p_exercise_ids: ids,
    });

    if (error) {
      console.error('[obtenerRecordsVigentesEjercicios]', error.message);
      return [];
    }

    return ((data ?? []) as RecordBaselineRpcRow[])
      .map((row) => ({
        exerciseId: row.exercise_id,
        recordType: row.record_type,
        value: Number(row.value),
      }))
      .filter((row) => Number.isFinite(row.value) && row.value > 0);
  },

  async obtenerRecordEventsSesion(sessionId: string): Promise<RecordEvent[]> {
    const { data, error } = await supabase.rpc('obtener_record_events_sesion', {
      p_session_id: sessionId,
    });

    if (error) {
      console.error('[obtenerRecordEventsSesion]', error.message);
      return [];
    }

    return ((data ?? []) as RecordEventRpcRow[])
      .map((row) => ({
        exerciseId: row.exercise_id,
        workoutSetId: row.workout_set_id,
        recordType: row.record_type,
        value: Number(row.value),
      }))
      .filter((row) => Number.isFinite(row.value) && row.value > 0);
  },

  async obtenerTodosLosRecords(userId: string): Promise<RecordUsuario[]> {
    const { data, error } = await supabase
      .from('exercise_records')
      .select(`
        id, record_type, value, achieved_at, exercise_id,
        exercises(nombre, tracking_mode),
        workout_sets(repeticiones, peso_kg, tipo_peso, duracion_seg, distancia_km)
      `)
      .eq('user_id', userId)
      .order('achieved_at', { ascending: false });

    if (error) {
      console.error('[obtenerTodosLosRecords]', error.message);
      return [];
    }

    return ((data ?? []) as any[]).map((row) => {
      const ex = row.exercises as { nombre: string; tracking_mode: string | null } | null;
      const ws = row.workout_sets as { repeticiones: number | null; peso_kg: number | null; tipo_peso: string; duracion_seg: number | null; distancia_km: number | null } | null;
      return {
        id: row.id as string,
        exerciseId: row.exercise_id as string,
        exerciseNombre: ex?.nombre ?? '',
        trackingMode: (ex?.tracking_mode ?? null) as RecordUsuario['trackingMode'],
        recordType: row.record_type as RecordType,
        value: Number(row.value),
        achievedAt: row.achieved_at as string,
        serie: ws
          ? {
              repeticiones: ws.repeticiones,
              pesoKg: ws.peso_kg,
              tipoPeso: ws.tipo_peso,
              duracionSeg: ws.duracion_seg,
              distanciaKm: ws.distancia_km,
            }
          : null,
      } satisfies RecordUsuario;
    }).filter((r) => Number.isFinite(r.value) && r.value > 0);
  },

  async descartarWorkoutSession(sessionId: string): Promise<void> {
    const { data: ejercicios, error: errEjercicios } = await supabase
      .from('workout_session_exercises')
      .select('id')
      .eq('session_id', sessionId);

    if (errEjercicios) {
      console.error('[descartarWorkoutSession] workout_session_exercises', errEjercicios.message);
      throw new Error(errEjercicios.message);
    }

    const ejercicioIds = (ejercicios ?? []).map((row) => row.id as string);
    if (ejercicioIds.length > 0) {
      const { error: errSets } = await supabase.from('workout_sets').delete().in('session_exercise_id', ejercicioIds);
      if (errSets) {
        console.error('[descartarWorkoutSession] workout_sets', errSets.message);
        throw new Error(errSets.message);
      }

      const { error: errWse } = await supabase.from('workout_session_exercises').delete().eq('session_id', sessionId);
      if (errWse) {
        console.error('[descartarWorkoutSession] workout_session_exercises delete', errWse.message);
        throw new Error(errWse.message);
      }
    }

    const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId);
    if (error) {
      console.error('[descartarWorkoutSession]', error.message);
      throw new Error(error.message);
    }
  },

  /** Borra por completo la sesion huerfana del calendario. */
  async descartarSesionHuerfana(sessionId: string): Promise<void> {
    await entrenamientoService.descartarWorkoutSession(sessionId);
  },

  async eliminarSesion(sessionId: string): Promise<void> {
    const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId);
    if (error) {
      console.error('[eliminarSesion]', error.message);
      throw new Error(error.message);
    }
  },

  async actualizarRutinaDesdeEntreno(
    routineId: string,
    ejercicios: BorradorEjercicioRutina[],
    opciones?: { nombre?: string },
  ): Promise<string> {
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? null;
    if (authErr || !userId) {
      console.error('[actualizarRutinaDesdeEntreno] auth', authErr?.message);
      throw new Error('Debes iniciar sesión para guardar la rutina.');
    }

    const meta = await obtenerMetaRutina(routineId);
    if (!meta) {
      throw new Error('No se pudo cargar la rutina.');
    }

    const tituloLimpio = opciones?.nombre?.trim() ?? '';
    const isPredeterminada = meta.created_by == null || meta.is_default === true;

    if (!isPredeterminada) {
      if (tituloLimpio && tituloLimpio !== meta.nombre) {
        const { error: updateErr } = await supabase.from('routines').update({ nombre: tituloLimpio }).eq('id', routineId);
        if (updateErr) {
          console.error('[actualizarRutinaDesdeEntreno] routines update', updateErr.message);
          throw new Error(updateErr.message);
        }
      }
      await escribirRutinaEjercicios(routineId, ejercicios);
      return routineId;
    }

    const nuevoRoutineId = await clonarRutinaBase(meta, userId);

    try {
      if (tituloLimpio && tituloLimpio !== meta.nombre) {
        const { error: updateErr } = await supabase
          .from('routines')
          .update({ nombre: tituloLimpio })
          .eq('id', nuevoRoutineId);
        if (updateErr) {
          console.error('[actualizarRutinaDesdeEntreno] clone routines update', updateErr.message);
          throw new Error(updateErr.message);
        }
      }

      await escribirRutinaEjercicios(nuevoRoutineId, ejercicios);
      return nuevoRoutineId;
    } catch (error) {
      await limpiarRutinaClonada(nuevoRoutineId);
      throw error;
    }
  },

  // ─── Historial ─────────────────────────────────────────────────────────────

  async obtenerHistorialSesiones(userId: string, limite = 20): Promise<WorkoutSession[]> {
    // TODO: implementar
    // SELECT * FROM workout_sessions WHERE user_id = userId
    // ORDER BY fecha DESC, created_at DESC LIMIT limite
    return [];
  },

  /**
   * Diferencia en minutos entre dos instantes ISO/timestamptz.
   * Si falta hora_fin devuelve 0.
   */
  calcularDuracionMinutos(hora_inicio: string | null, hora_fin: string | null): number {
    if (hora_inicio == null || hora_fin == null) return 0;
    const a = new Date(hora_inicio).getTime();
    const b = new Date(hora_fin).getTime();
    if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
    return Math.round((b - a) / 60000);
  },

  async obtenerSesionesSemana(
    userId: string,
    fechaInicio: string,
    fechaFin: string,
  ): Promise<SesionResumen[]> {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('id, nombre, fecha, hora_inicio, hora_fin')
      .eq('user_id', userId)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true });

    if (error) {
      console.error('[obtenerSesionesSemana]', error.message);
      return [];
    }
    return ((data ?? []) as SesionSemanaRow[]).map((r) => ({
      id: r.id,
      nombre: r.nombre,
      fecha: r.fecha,
      hora_inicio: r.hora_inicio,
      hora_fin: r.hora_fin,
    }));
  },

  /**
   * Versión optimizada: 2 queries para toda la semana en lugar de 1+N.
   * Devuelve sesiones con ejercicios, series y volumen ya calculados.
   */
  async obtenerResumenSesionesSemana(
    userId: string,
    fechaInicio: string,
    fechaFin: string,
  ): Promise<{ sesion: SesionResumen; ejercicios: number; series: number; volumenKg: number }[]> {
    // Query 1: sesiones del rango
    const { data: sesionesData, error: sesionesError } = await supabase
      .from('workout_sessions')
      .select('id, nombre, fecha, hora_inicio, hora_fin')
      .eq('user_id', userId)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true });

    if (sesionesError) {
      console.error('[obtenerResumenSesionesSemana] sessions', sesionesError.message);
      return [];
    }

    const sesiones = ((sesionesData ?? []) as SesionSemanaRow[]).map((r) => ({
      id: r.id,
      nombre: r.nombre,
      fecha: r.fecha,
      hora_inicio: r.hora_inicio,
      hora_fin: r.hora_fin,
    }));

    if (sesiones.length === 0) return [];

    const sessionIds = sesiones.map((s) => s.id);

    // Query 2: todos los ejercicios + sets de esas sesiones en una sola llamada
    type WseResumenRow = {
      session_id: string;
      exercise_id: string;
      workout_sets: { peso_kg: number | null; repeticiones: number | null; completada: boolean }[] | null;
    };

    const { data: wseData, error: wseError } = await supabase
      .from('workout_session_exercises')
      .select('session_id, exercise_id, workout_sets ( peso_kg, repeticiones, completada )')
      .in('session_id', sessionIds);

    if (wseError) {
      console.error('[obtenerResumenSesionesSemana] wse', wseError.message);
      // Devolver sesiones sin stats antes que fallar completamente
      return sesiones.map((s) => ({ sesion: s, ejercicios: 0, series: 0, volumenKg: 0 }));
    }

    // Agrupar por session_id
    const statsPorSesion = new Map<string, { ejercicios: Set<string>; series: number; volumenKg: number }>();
    for (const wse of (wseData ?? []) as WseResumenRow[]) {
      let entry = statsPorSesion.get(wse.session_id);
      if (!entry) {
        entry = { ejercicios: new Set(), series: 0, volumenKg: 0 };
        statsPorSesion.set(wse.session_id, entry);
      }
      entry.ejercicios.add(wse.exercise_id);
      for (const set of wse.workout_sets ?? []) {
        if (!set.completada) continue;
        entry.series += 1;
        const peso = set.peso_kg != null ? Number(set.peso_kg) : 0;
        const reps = set.repeticiones != null ? Number(set.repeticiones) : 0;
        entry.volumenKg += peso * reps;
      }
    }

    return sesiones.map((sesion) => {
      const stats = statsPorSesion.get(sesion.id);
      return {
        sesion,
        ejercicios: stats?.ejercicios.size ?? 0,
        series: stats?.series ?? 0,
        volumenKg: stats?.volumenKg ?? 0,
      };
    });
  },

  /** Suma (peso_kg × repeticiones) de sets completados en sesiones de la semana. */
  async obtenerVolumenSemanaKg(userId: string, fechaInicio: string, fechaFin: string): Promise<number> {
    // RPC: Postgres calcula el SUM directamente y devuelve 1 número.
    // Antes: join de 75–280 filas al cliente + bucle triple en JS.
    const { data, error } = await supabase.rpc('obtener_volumen_semana_kg', {
      p_user_id: userId,
      p_fecha_inicio: fechaInicio,
      p_fecha_fin: fechaFin,
    });

    if (error) {
      console.error('[obtenerVolumenSemanaKg]', error.message);
      return 0;
    }

    return Number(data ?? 0);
  },

  async obtenerDetalleSesion(sessionId: string): Promise<DetalleSesion | null> {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select(
        `id, nombre, fecha, hora_inicio, hora_fin,
        workout_session_exercises (
          id, orden, exercise_id, notas,
          exercises ( nombre, musculo_primario, foto_url, tracking_mode ),
          workout_sets ( id, numero_serie, tipo_serie, peso_kg, repeticiones, rir, tipo_peso, duracion_seg, distancia_km, completada, descanso_seg )
        )`,
      )
      .eq('id', sessionId)
      .maybeSingle();

    if (error) {
      console.error('[obtenerDetalleSesion]', error.message);
      return null;
    }
    if (!data) return null;

    const row = data as DetalleSesionRow;
    const wseList = (row.workout_session_exercises ?? []).slice().sort((a, b) => a.orden - b.orden);

    const ejercicios: DetalleSesionEjercicio[] = wseList.map((wse) => {
      const exRaw = wse.exercises;
      const exOne = Array.isArray(exRaw) ? exRaw[0] : exRaw;
      const nombre = exOne?.nombre?.trim() ?? 'Ejercicio';
      const musculo = exOne?.musculo_primario?.trim() ?? '';
      const fotoRaw = exOne?.foto_url;
      const foto_url =
        fotoRaw != null && String(fotoRaw).trim() !== '' ? String(fotoRaw).trim() : null;
      const tracking_mode = trackingModeSeguro(exOne?.tracking_mode);
      const setsRaw = wse.workout_sets ?? [];
      const sets: DetalleSesionSet[] = setsRaw
        .slice()
        .sort((a, b) => a.numero_serie - b.numero_serie)
        .map((s) => ({
          id: s.id,
          numero_serie: s.numero_serie,
          tipo_serie: s.tipo_serie,
          peso_kg: s.peso_kg,
          repeticiones: s.repeticiones,
          rir: s.rir ?? null,
          tipo_peso: s.tipo_peso,
          duracion_seg: s.duracion_seg ?? null,
          distancia_km: s.distancia_km ?? null,
          completada: s.completada,
          descanso_seg: s.descanso_seg ?? null,
        }));
      return {
        id: wse.id,
        exercise_id: wse.exercise_id,
        nombre,
        musculo_primario: musculo,
        foto_url,
        tracking_mode,
        notas: wse.notas ?? null,
        sets,
      };
    });

    return {
      id: row.id,
      nombre: row.nombre,
      fecha: row.fecha,
      hora_inicio: row.hora_inicio,
      hora_fin: row.hora_fin,
      ejercicios,
    };
  },

  async obtenerUltimaSesionRutina(userId: string, routineId: string): Promise<UltimaSesionRutina | null> {
    const { data: sess, error: errSess } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('routine_id', routineId)
      .not('hora_fin', 'is', null)
      .order('hora_inicio', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (errSess) {
      console.error('[obtenerUltimaSesionRutina] session', errSess.message);
      return null;
    }
    if (!sess?.id) return null;

    const sessionId = sess.id as string;

    type WseUltimaRow = {
      orden: number;
      exercise_id: string;
      workout_sets:
        | {
            numero_serie: number;
            peso_kg: number | null;
            repeticiones: number | null;
            tipo_peso: TipoPeso;
            duracion_seg: number | null;
            distancia_km: number | null;
            completada: boolean;
          }[]
        | null;
    };

    const { data: wseData, error: errWse } = await supabase
      .from('workout_session_exercises')
      .select('orden, exercise_id, workout_sets ( numero_serie, peso_kg, repeticiones, tipo_peso, duracion_seg, distancia_km, completada )')
      .eq('session_id', sessionId)
      .order('orden');

    if (errWse) {
      console.error('[obtenerUltimaSesionRutina] wse', errWse.message);
      return { sessionId, ejercicios: [] };
    }

    const rows = (wseData ?? []) as WseUltimaRow[];
    const ejercicios = rows.map((wse) => {
      const setsRaw = wse.workout_sets ?? [];
      const sets = setsRaw
        .filter((s) => s.completada)
        .sort((a, b) => a.numero_serie - b.numero_serie)
        .map((s) => ({
          numero_serie: s.numero_serie,
          peso_kg: s.peso_kg,
          repeticiones: s.repeticiones,
          tipo_peso: s.tipo_peso,
          duracion_seg: s.duracion_seg ?? null,
          distancia_km: s.distancia_km ?? null,
        }));
      return {
        exercise_id: wse.exercise_id,
        orden: wse.orden,
        sets,
      };
    });

    return { sessionId, ejercicios };
  },

  async obtenerEntrenosPaginados(userId: string, pagina: number, porPagina: number): Promise<EntrenoResumen[]> {
    const from = pagina * porPagina;
    const to = (pagina + 1) * porPagina - 1;

    type EntrenoRow = {
      id: string;
      nombre: string | null;
      fecha: string;
      hora_inicio: string | null;
      hora_fin: string | null;
      routines: { nombre: string | null } | { nombre: string | null }[] | null;
      workout_session_exercises:
        | {
            exercise_id: string;
            exercises: { nombre: string; foto_url: string | null } | { nombre: string; foto_url: string | null }[] | null;
            workout_sets:
              | { peso_kg: number | null; repeticiones: number | null; completada: boolean }[]
              | null;
          }[]
        | null;
    };

    const { data, error } = await supabase
      .from('workout_sessions')
      .select(
        `id, nombre, fecha, hora_inicio, hora_fin,
        routines ( nombre ),
        workout_session_exercises (
          exercise_id,
          exercises ( nombre, foto_url ),
          workout_sets ( peso_kg, repeticiones, completada )
        )`,
      )
      .eq('user_id', userId)
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[obtenerEntrenosPaginados]', error.message);
      return [];
    }

    return ((data ?? []) as EntrenoRow[]).map((row) => {
      const routineRaw = row.routines;
      const routineOne = Array.isArray(routineRaw) ? routineRaw[0] : routineRaw;
      const ejerciciosRaw = row.workout_session_exercises ?? [];
      let volumenKg = 0;

      const ejercicios = ejerciciosRaw.map((ex) => {
        const exJoin = Array.isArray(ex.exercises) ? ex.exercises[0] : ex.exercises;
        const nombre = exJoin?.nombre?.trim() ?? 'Ejercicio';
        const fotoUrl = exJoin?.foto_url?.trim() ? exJoin.foto_url.trim() : null;
        const sets = ex.workout_sets ?? [];
        for (const st of sets) {
          if (!st.completada) continue;
          const peso = st.peso_kg != null ? Number(st.peso_kg) : 0;
          const reps = st.repeticiones != null ? Number(st.repeticiones) : 0;
          volumenKg += peso * reps;
        }
        return {
          ejercicioId: ex.exercise_id,
          nombre,
          fotoUrl,
          numSeries: sets.length,
        };
      });

      return {
        id: row.id,
        nombre: row.nombre,
        rutinaNombre: routineOne?.nombre ?? null,
        fecha: row.fecha,
        horaInicio: row.hora_inicio,
        horaFin: row.hora_fin,
        ejercicios,
        totalEjercicios: ejercicios.length,
        volumenKg,
      };
    });
  },

  async eliminarEntreno(sessionId: string): Promise<void> {
    // ON DELETE CASCADE en BD: borrar la sesión elimina en cascada
    // workout_session_exercises y workout_sets automáticamente.
    const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId);
    if (error) throw error;
  },

  async obtenerRutinasPredeterminadas(): Promise<RutinaExplorar[]> {
    type ExploreReRow = {
      orden: number;
      exercises: { musculo_primario: string | null } | { musculo_primario: string | null }[] | null;
    };
    type ExploreRoutineRow = {
      id: string;
      nombre: string;
      descripcion: string | null;
      dificultad: string | null;
      routine_exercises?: ExploreReRow[] | null;
    };

    // Obtener uid desde la sesión cacheada (sin round-trip al servidor)
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id ?? null;

    // Lanzar rutinas y favoritos en paralelo
    const [rutinaRes, favRes] = await Promise.all([
      supabase
        .from('routines')
        .select(
          `id, nombre, descripcion, dificultad,
          routine_exercises ( orden, exercises ( musculo_primario ) )`,
        )
        .eq('is_default', true)
        .order('nombre'),
      uid
        ? supabase
            .from('user_favorite_routines')
            .select('routine_id')
            .eq('user_id', uid)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (rutinaRes.error) {
      console.error('[obtenerRutinasPredeterminadas]', rutinaRes.error.message);
      throw new Error(rutinaRes.error.message);
    }
    const data = rutinaRes.data;

    if (favRes.error) {
      console.error('[obtenerRutinasPredeterminadas] favoritos', favRes.error.message);
    }
    const favoritos = new Set(
      ((favRes.data ?? []) as { routine_id: string }[]).map((r) => r.routine_id),
    );

    const musculosUnicosPorFrecuencia = (primaries: string[]): string[] => {
      const counts = new Map<string, { n: number; label: string }>();
      for (const raw of primaries) {
        const t = raw.trim();
        if (!t) continue;
        const k = t.toLowerCase();
        const cur = counts.get(k);
        if (cur) cur.n += 1;
        else counts.set(k, { n: 1, label: t });
      }
      return [...counts.values()]
        .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'es'))
        .map((x) => x.label);
    };

    const out: RutinaExplorar[] = [];
    for (const raw of (data ?? []) as ExploreRoutineRow[]) {
      const rel = (raw.routine_exercises ?? []).slice().sort((a, b) => a.orden - b.orden);
      const musculosPorEjercicio: string[] = [];
      for (const re of rel) {
        const exRaw = re.exercises;
        const exOne = Array.isArray(exRaw) ? exRaw[0] : exRaw;
        const mp = exOne?.musculo_primario?.trim() ?? '';
        musculosPorEjercicio.push(mp);
      }
      const musculos = musculosUnicosPorFrecuencia(musculosPorEjercicio.filter((m) => m.length > 0));
      out.push({
        id: raw.id,
        nombre: raw.nombre,
        descripcion: raw.descripcion,
        dificultad: raw.dificultad,
        musculos,
        musculosPorEjercicio,
        esFavorita: favoritos.has(raw.id),
      });
    }
    return out;
  },
};

/**
 * Fija favorito en BD según estado deseado (insert/delete). Usuario = sesión actual.
 * Coexiste con `entrenamientoService.toggleFavoritoRutina(userId, routineId)` que alterna sin estado explícito.
 */
export async function toggleFavoritoRutina(rutinaId: string, esFavorita: boolean): Promise<void> {
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth.user?.id) {
    console.error('[toggleFavoritoRutina] sin usuario', authErr?.message);
    return;
  }
  const userId = auth.user.id;
  if (esFavorita) {
    const { error } = await supabase.from('user_favorite_routines').insert({
      user_id: userId,
      routine_id: rutinaId,
    });
    if (error && error.code !== '23505') {
      console.error('[toggleFavoritoRutina] insert', error.message);
    }
  } else {
    const { error } = await supabase
      .from('user_favorite_routines')
      .delete()
      .eq('user_id', userId)
      .eq('routine_id', rutinaId);
    if (error) console.error('[toggleFavoritoRutina] delete', error.message);
  }
}

/**
 * Renombra una rutina creada por el usuario. RLS + filtro `created_by` aseguran propiedad.
 */
export async function cambiarNombreRutina(rutinaId: string, nuevoNombre: string): Promise<void> {
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth.user?.id) {
    console.error('[cambiarNombreRutina] auth', authErr?.message);
    throw new Error('Debes iniciar sesión para cambiar el nombre de la rutina.');
  }
  const userId = auth.user.id;
  const trimmed = nuevoNombre.trim();
  if (!trimmed) {
    throw new Error('El nombre no puede estar vacío.');
  }

  const { data, error } = await supabase
    .from('routines')
    .update({ nombre: trimmed, updated_at: new Date().toISOString() })
    .eq('id', rutinaId)
    .eq('created_by', userId)
    .select('id');

  if (error) {
    console.error('[cambiarNombreRutina]', error.message);
    throw new Error(error.message || 'No se pudo actualizar el nombre de la rutina.');
  }
  if (!data?.length) {
    throw new Error('No se pudo actualizar la rutina o no tienes permiso.');
  }
}

/**
 * Elimina una rutina del usuario. Las sesiones con `routine_id` quedan con FK en NULL según esquema.
 */
export async function borrarRutina(rutinaId: string): Promise<void> {
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth.user?.id) {
    console.error('[borrarRutina] auth', authErr?.message);
    throw new Error('Debes iniciar sesión para borrar la rutina.');
  }
  const userId = auth.user.id;

  const { data, error } = await supabase
    .from('routines')
    .delete()
    .eq('id', rutinaId)
    .eq('created_by', userId)
    .select('id');

  if (error) {
    console.error('[borrarRutina]', error.message);
    throw new Error(error.message || 'No se pudo borrar la rutina.');
  }
  if (!data?.length) {
    throw new Error('No se pudo borrar la rutina o no tienes permiso.');
  }
}
