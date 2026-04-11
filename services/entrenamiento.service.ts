/**
 * SERVICIO DE ENTRENAMIENTO
 *
 * Gestiona workout_sessions, workout_session_exercises y workout_sets.
 */

import { supabase } from '@/lib/supabase';
import type {
  TipoPeso,
  TipoSerie,
  WorkoutSession,
  WorkoutSet,
} from '@/types/database.types';
import type { TipoSeriePlantillaDb } from '@/lib/entrenamientoSerie';

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
  peso_kg: number | null;
  tipo_peso: TipoPeso;
};

export type DetalleRutinaEjercicio = {
  id: string;
  exercise_id: string;
  orden: number;
  notas: string | null;
  exercises: { nombre: string; musculo_primario: string };
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
    exercises: { nombre: string } | null;
  }[] | null;
};

function mapRoutineJoin(row: RoutineJoinRow): RutinaListaVista {
  const lines = (row.routine_exercises ?? [])
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((re) => re.exercises?.nombre?.trim() ?? '')
    .filter((n) => n.length > 0);
  return { id: row.id, nombre: row.nombre, ejercicios: lines };
}
import type { SesionCompleta } from '@/types/app.types';

/** Borrador al guardar rutina desde la pantalla Crear rutina */
export type BorradorSerieRutina = {
  numero_serie: number;
  tipo_serie: TipoSeriePlantillaDb;
  repeticiones: number | null;
  peso_kg: number | null;
  tipo_peso: TipoPeso;
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
  sets: {
    numero_serie: number;
    tipo_serie: TipoSeriePlantillaDb;
    repeticiones: number | null;
    peso_kg: number | null;
    tipo_peso: TipoPeso;
  }[];
};

export type EntrenoEjercicioPersistido = {
  exercise_id: string;
  orden: number;
  sets: {
    numero_serie: number;
    tipo_serie: TipoSeriePlantillaDb;
    repeticiones: number | null;
    peso_kg: number | null;
    tipo_peso: TipoPeso;
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

export type DetalleSesionSet = {
  numero_serie: number;
  tipo_serie: TipoSerie;
  peso_kg: number | null;
  repeticiones: number | null;
  tipo_peso: TipoPeso;
  completada: boolean;
};

export type DetalleSesionEjercicio = {
  id: string;
  nombre: string;
  musculo_primario: string;
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
    }[];
  }[];
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
    exercises: { nombre: string; musculo_primario: string } | { nombre: string; musculo_primario: string }[] | null;
    workout_sets: {
      numero_serie: number;
      tipo_serie: TipoSerie;
      peso_kg: number | null;
      repeticiones: number | null;
      tipo_peso: TipoPeso;
      completada: boolean;
    }[] | null;
  }[] | null;
};

function formatearAnteriorSet(peso_kg: number | null, repeticiones: number | null, tipo_peso: TipoPeso): string {
  const r = repeticiones != null ? String(repeticiones) : '—';
  if (tipo_peso === 'bodyweight') return `BW × ${r}`;
  if (tipo_peso === 'assisted') return `Asist. × ${r}`;
  const p = peso_kg != null ? `${peso_kg}kg` : '—';
  return `${p} × ${r}`;
}

type RoutineExerciseJoinRow = {
  orden: number;
  exercise_id: string;
  exercises: { nombre: string; musculo_primario: string } | { nombre: string; musculo_primario: string }[] | null;
  routine_sets:
    | {
        numero_serie: number;
        tipo_serie: TipoSeriePlantillaDb;
        reps: number | null;
        peso_kg: number | null;
        tipo_peso: TipoPeso;
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

    for (const ex of ejercicios) {
      const { data: reRow, error: errRe } = await supabase
        .from('routine_exercises')
        .insert({
          routine_id: routineId,
          exercise_id: ex.exercise_id,
          orden: ex.orden,
          notas: null,
        })
        .select('id')
        .single();

      if (errRe || !reRow?.id) {
        console.error('[guardarRutinaDesdeBorrador] routine_exercises', errRe?.message);
        return { ok: false, error: errRe?.message ?? 'Error al guardar ejercicios de la rutina.' };
      }

      const routineExerciseId = reRow.id as string;

      for (const set of ex.sets) {
        const { error: errSet } = await supabase.from('routine_sets').insert({
          routine_exercise_id: routineExerciseId,
          numero_serie: set.numero_serie,
          tipo_serie: set.tipo_serie,
          reps: set.repeticiones,
          peso_kg: set.peso_kg,
          tipo_peso: set.tipo_peso,
        });

        if (errSet) {
          console.error('[guardarRutinaDesdeBorrador] routine_sets', errSet.message);
          return { ok: false, error: errSet.message };
        }
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
          exercises ( nombre, musculo_primario ),
          routine_sets ( numero_serie, tipo_serie, reps, peso_kg, tipo_peso )
        )`,
      )
      .eq('id', routineId)
      .maybeSingle();

    if (error) {
      console.error('[obtenerDetalleRutina]', error.message);
      return null;
    }
    if (!data) return null;

    type ReRow = {
      id: string;
      exercise_id: string;
      orden: number;
      notas: string | null;
      exercises: { nombre: string; musculo_primario: string } | { nombre: string; musculo_primario: string }[] | null;
      routine_sets:
        | {
            numero_serie: number;
            tipo_serie: TipoSeriePlantillaDb;
            reps: number | null;
            peso_kg: number | null;
            tipo_peso: TipoPeso | null;
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
          peso_kg: s.peso_kg,
          tipo_peso: (s.tipo_peso ?? 'kg') as TipoPeso,
        }));
      return {
        id: re.id,
        exercise_id: re.exercise_id,
        orden: re.orden,
        notas: re.notas,
        exercises: {
          nombre: exOne?.nombre?.trim() ?? 'Ejercicio',
          musculo_primario: exOne?.musculo_primario?.trim() ?? '',
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
    const fecha = [
      hoy.getFullYear(),
      String(hoy.getMonth() + 1).padStart(2, '0'),
      String(hoy.getDate()).padStart(2, '0'),
    ].join('-');
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
    const horaFin = new Date().toISOString();
    const { error } = await supabase.from('workout_sessions').update({ hora_fin: horaFin }).eq('id', sessionId);
    if (error) console.error('[marcarHoraFinWorkoutSession]', error.message);
  },

  async cargarEjerciciosDesdeRutina(routineId: string): Promise<EjercicioBorrador[]> {
    const { data, error } = await supabase
      .from('routine_exercises')
      .select(
        'orden, exercise_id, exercises ( nombre, musculo_primario ), routine_sets ( numero_serie, tipo_serie, reps, peso_kg, tipo_peso )',
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
          }));
        return {
          exercise_id: row.exercise_id,
          orden: row.orden,
          nombre,
          musculo_primario: musculo,
          sets,
        };
      });
  },

  async obtenerAnteriorPorEjercicio(userId: string, exerciseId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('workout_sets')
      .select(
        'repeticiones, peso_kg, tipo_peso, workout_session_exercises!inner ( exercise_id, workout_sessions!inner ( user_id, fecha, created_at ) )',
      )
      .eq('completada', true)
      .eq('workout_session_exercises.exercise_id', exerciseId);

    if (error) {
      console.error('[obtenerAnteriorPorEjercicio]', error.message);
      return null;
    }

    const rows = (data ?? []) as AnteriorJoinRow[];
    const mine = rows.filter(
      (r) =>
        r.workout_session_exercises?.exercise_id === exerciseId &&
        r.workout_session_exercises?.workout_sessions?.user_id === userId,
    );
    if (!mine.length) return null;

    const scored = mine.map((r) => {
      const sess = r.workout_session_exercises.workout_sessions;
      const sortKey = new Date(sess.created_at).getTime() || new Date(sess.fecha).getTime() || 0;
      return { r, sortKey };
    });
    scored.sort((a, b) => b.sortKey - a.sortKey);
    const best = scored[0]?.r;
    if (!best) return null;
    return formatearAnteriorSet(best.peso_kg, best.repeticiones, best.tipo_peso);
  },

  async guardarSetsCompletados(sessionId: string, ejercicios: EntrenoEjercicioPersistido[]): Promise<void> {
    for (const ex of ejercicios) {
      if (!ex.sets.length) continue;

      const { data: wseRow, error: errWse } = await supabase
        .from('workout_session_exercises')
        .insert({
          session_id: sessionId,
          exercise_id: ex.exercise_id,
          orden: ex.orden,
          notas: null,
        })
        .select('id')
        .single();

      if (errWse || !wseRow?.id) {
        console.error('[guardarSetsCompletados] workout_session_exercises', errWse?.message);
        continue;
      }

      const sessionExerciseId = wseRow.id as string;

      for (const set of ex.sets) {
        const { error: errSet } = await supabase.from('workout_sets').insert({
          session_exercise_id: sessionExerciseId,
          numero_serie: set.numero_serie,
          tipo_serie: set.tipo_serie,
          repeticiones: set.repeticiones,
          peso_kg: set.peso_kg,
          tipo_peso: set.tipo_peso,
          duracion_seg: null,
          descanso_seg: null,
          completada: true,
        });
        if (errSet) console.error('[guardarSetsCompletados] workout_sets', errSet.message);
      }
    }
  },

  async descartarWorkoutSession(sessionId: string): Promise<void> {
    const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId);
    if (error) console.error('[descartarWorkoutSession]', error.message);
  },

  /**
   * Marca la sesión como finalizada (hora_fin = ahora) sin borrar datos.
   * Para sesiones huérfanas en calendario "En curso" cuando no hay contexto en memoria.
   */
  async descartarSesionHuerfana(sessionId: string): Promise<void> {
    const horaFin = new Date().toISOString();
    const { error } = await supabase.from('workout_sessions').update({ hora_fin: horaFin }).eq('id', sessionId);
    if (error) console.error('[descartarSesionHuerfana]', error.message);
  },

  async eliminarSesion(sessionId: string): Promise<void> {
    const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId);
    if (error) {
      console.error('[eliminarSesion]', error.message);
      throw new Error(error.message);
    }
  },

  async actualizarRutinaDesdeEntreno(routineId: string, ejercicios: BorradorEjercicioRutina[]): Promise<void> {
    const { error: delErr } = await supabase.from('routine_exercises').delete().eq('routine_id', routineId);
    if (delErr) {
      console.error('[actualizarRutinaDesdeEntreno] delete', delErr.message);
      return;
    }

    for (const ex of ejercicios) {
      const { data: reRow, error: errRe } = await supabase
        .from('routine_exercises')
        .insert({
          routine_id: routineId,
          exercise_id: ex.exercise_id,
          orden: ex.orden,
          notas: null,
        })
        .select('id')
        .single();

      if (errRe || !reRow?.id) {
        console.error('[actualizarRutinaDesdeEntreno] routine_exercises', errRe?.message);
        continue;
      }

      const routineExerciseId = reRow.id as string;

      for (const set of ex.sets) {
        const { error: errSet } = await supabase.from('routine_sets').insert({
          routine_exercise_id: routineExerciseId,
          numero_serie: set.numero_serie,
          tipo_serie: set.tipo_serie,
          reps: set.repeticiones,
          peso_kg: set.peso_kg,
          tipo_peso: set.tipo_peso,
        });
        if (errSet) console.error('[actualizarRutinaDesdeEntreno] routine_sets', errSet.message);
      }
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

  /** Suma (peso_kg × repeticiones) de sets completados en sesiones de la semana. */
  async obtenerVolumenSemanaKg(userId: string, fechaInicio: string, fechaFin: string): Promise<number> {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('workout_session_exercises ( workout_sets ( peso_kg, repeticiones, completada ) )')
      .eq('user_id', userId)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin);

    if (error) {
      console.error('[obtenerVolumenSemanaKg]', error.message);
      return 0;
    }

    let vol = 0;
    for (const row of (data ?? []) as VolumenSemanaRow[]) {
      for (const ex of row.workout_session_exercises ?? []) {
        for (const st of ex.workout_sets ?? []) {
          if (!st.completada) continue;
          const w = st.peso_kg != null ? Number(st.peso_kg) : 0;
          const r = st.repeticiones != null ? Number(st.repeticiones) : 0;
          vol += w * r;
        }
      }
    }
    return vol;
  },

  async obtenerDetalleSesion(sessionId: string): Promise<DetalleSesion | null> {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select(
        `id, nombre, fecha, hora_inicio, hora_fin,
        workout_session_exercises (
          id, orden, exercise_id,
          exercises ( nombre, musculo_primario ),
          workout_sets ( numero_serie, tipo_serie, peso_kg, repeticiones, tipo_peso, completada )
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
      const setsRaw = wse.workout_sets ?? [];
      const sets: DetalleSesionSet[] = setsRaw
        .slice()
        .sort((a, b) => a.numero_serie - b.numero_serie)
        .map((s) => ({
          numero_serie: s.numero_serie,
          tipo_serie: s.tipo_serie,
          peso_kg: s.peso_kg,
          repeticiones: s.repeticiones,
          tipo_peso: s.tipo_peso,
          completada: s.completada,
        }));
      return {
        id: wse.id,
        nombre,
        musculo_primario: musculo,
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
            completada: boolean;
          }[]
        | null;
    };

    const { data: wseData, error: errWse } = await supabase
      .from('workout_session_exercises')
      .select('orden, exercise_id, workout_sets ( numero_serie, peso_kg, repeticiones, tipo_peso, completada )')
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
        }));
      return {
        exercise_id: wse.exercise_id,
        orden: wse.orden,
        sets,
      };
    });

    return { sessionId, ejercicios };
  },
};
