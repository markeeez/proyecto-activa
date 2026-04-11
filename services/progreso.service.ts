/**
 * Datos agregados para la pantalla de progreso (nutrición semanal, peso, contadores).
 */

import { supabase } from '@/lib/supabase';
import { agregarDiasIso, fechaHoyIsoLocal, fechaIsoDesdeDate, parseFechaLocal } from '@/lib/fechaNutricion';

/** Plan nutricional guardado en `user_goals` (pantalla progreso / personalizar). */
export type PlanActual = {
  objetivo: string;
  calorias_objetivo: number;
  proteinas_objetivo: number;
  carbos_objetivo: number;
  grasas_objetivo: number;
  /** ISO timestamptz desde `user_goals.created_at`. */
  created_at: string;
  peso_objetivo: number | null;
};

/** Progreso hacia el peso objetivo (tab Plan). */
export type ProgresoPeso = {
  pesoInicio: number;
  pesoActual: number;
  pesoObjetivo: number;
  objetivo: 'perder_peso' | 'ganar_masa';
  porcentaje: number;
};

/** Datos para recalcular TDEE: `profiles` + último `peso_kg` en `user_body_metrics`. */
export type ContextoPlanNutricion = {
  genero: 'hombre' | 'mujer' | null;
  edad: number | null;
  alturaCm: number | null;
  factorActividad: number | null;
  pesoKg: number | null;
};

export interface NutricionSemana {
  /** Lunes de la semana (YYYY-MM-DD, calendario local). */
  semanaInicio: string;
  kcal: number;
  proteinas: number;
  carbos: number;
  grasas: number;
}

export interface RegistroPeso {
  fecha: string;
  peso_kg: number;
}

/** Ejercicios que el usuario ha registrado al menos una vez en una sesión. */
export interface EjercicioResumen {
  id: string;
  nombre: string;
  musculo_primario: string;
  /** Para filtros de chip (misma tabla `exercises`). */
  equipamiento: string | null;
  musculos_secundarios: string[];
}

export interface SesionEjercicioStats {
  fecha: string;
  mejorPeso: number | null;
  volumen: number;
  mejorReps: number | null;
  series: number;
}

export interface EstadisticasEjercicio {
  rutinas: number;
  veces: number;
  mejorPeso: number | null;
  mejorReps: number | null;
  porSesion: SesionEjercicioStats[];
}

export interface DistribucionMuscular {
  grupo: string;
  series: number;
  porcentaje: number;
}

/** Claves canónicas de grupo (orden fijo para UI). */
const GRUPOS_MUSCULARES_ORDEN = ['PECHO', 'ESPALDA', 'PIERNAS', 'BRAZOS', 'HOMBRO', 'CORE'] as const;

/** Palabras clave por grupo (más largas primero dentro de cada lista). */
const KEYWORDS_GRUPO_MUSCULAR: Record<(typeof GRUPOS_MUSCULARES_ORDEN)[number], string[]> = {
  PECHO: ['pectoral mayor', 'pectoral menor', 'pectorales', 'pectoral', 'pecho'],
  ESPALDA: [
    'dorsal ancho',
    'infraespinoso',
    'redondo mayor',
    'erectores',
    'romboides',
    'trapecio',
    'dorsal',
    'espalda',
  ],
  PIERNAS: [
    'isquiotibiales',
    'cuádriceps',
    'cuadriceps',
    'aductores',
    'abductores',
    'femoral',
    'glúteos',
    'gluteos',
    'glúteo',
    'gluteo',
    'gemelos',
    'sóleo',
    'soleo',
    'piernas',
    'pierna',
  ],
  BRAZOS: ['antebrazos', 'antebrazo', 'tríceps', 'triceps', 'bíceps', 'biceps', 'braquial'],
  HOMBRO: [
    'deltoides anterior',
    'deltoides posterior',
    'deltoides lateral',
    'manguito rotador',
    'deltoides',
    'hombros',
    'hombro',
  ],
  CORE: [
    'abdominales inferiores',
    'abdominales superiores',
    'abdominales',
    'transverso',
    'oblicuos',
    'core',
  ],
};

function mapearMusculoPrimarioAGrupo(musculoPrimario: string): (typeof GRUPOS_MUSCULARES_ORDEN)[number] | null {
  const s = musculoPrimario.trim().toLowerCase();
  if (!s) return null;
  for (const grupo of GRUPOS_MUSCULARES_ORDEN) {
    const keys = KEYWORDS_GRUPO_MUSCULAR[grupo];
    for (const k of keys) {
      const kk = k.toLowerCase();
      if (s.includes(kk) || s.startsWith(kk)) return grupo;
    }
  }
  return null;
}

function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function inicioSemanaLunesIso(fechaIso: string): string {
  const base = parseFechaLocal(fechaIso);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + mondayOffset);
  return fechaIsoDesdeDate(monday);
}

function enumerarSemanasLunes(fechaInicio: string, fechaFin: string): string[] {
  const start = inicioSemanaLunesIso(fechaInicio);
  const end = inicioSemanaLunesIso(fechaFin);
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = agregarDiasIso(cur, 7);
  }
  return out;
}

function clampFechaMin(fecha: string, minIso: string): string {
  return fecha < minIso ? minIso : fecha;
}

export const progresoService = {
  /** Último plan nutricional del usuario (`user_goals`). */
  async obtenerPlanActual(userId: string): Promise<PlanActual | null> {
    const { data, error } = await supabase
      .from('user_goals')
      .select(
        'objetivo, calorias_objetivo, proteinas_objetivo, carbos_objetivo, grasas_objetivo, created_at, peso_objetivo',
      )
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const rawPo = data.peso_objetivo;
    const nPo = rawPo == null ? NaN : Number(rawPo);
    const peso_objetivo = Number.isFinite(nPo) ? nPo : null;
    return {
      objetivo: String(data.objetivo),
      calorias_objetivo: Number(data.calorias_objetivo) || 0,
      proteinas_objetivo: Number(data.proteinas_objetivo) || 0,
      carbos_objetivo: Number(data.carbos_objetivo) || 0,
      grasas_objetivo: Number(data.grasas_objetivo) || 0,
      created_at: data.created_at != null ? String(data.created_at) : '',
      peso_objetivo,
    };
  },

  /**
   * Peso inicio (métrica con `created_at` más cercano a `user_goals.created_at`),
   * peso actual (última fecha), objetivo y % hacia la meta.
   */
  async obtenerProgresoPeso(userId: string): Promise<ProgresoPeso | null> {
    const { data: goal, error: eGoal } = await supabase
      .from('user_goals')
      .select('peso_objetivo, objetivo, created_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (eGoal) throw eGoal;
    if (!goal) return null;

    const obj = String(goal.objetivo);
    const rawPo = goal.peso_objetivo;
    const pesoObjMeta =
      rawPo != null && rawPo !== '' ? Number(rawPo) : NaN;
    if (rawPo == null || !Number.isFinite(pesoObjMeta) || obj === 'mantener') return null;
    if (obj !== 'perder_peso' && obj !== 'ganar_masa') return null;

    const goalCreatedRaw = goal.created_at != null ? String(goal.created_at) : '';
    const goalMs = goalCreatedRaw ? new Date(goalCreatedRaw).getTime() : NaN;

    const { data: metrics, error: eMet } = await supabase
      .from('user_body_metrics')
      .select('peso_kg, created_at, fecha')
      .eq('user_id', userId)
      .not('peso_kg', 'is', null);
    if (eMet) throw eMet;
    const rows = (metrics ?? []).filter((r) => r.peso_kg != null && !Number.isNaN(Number(r.peso_kg)));
    if (rows.length === 0) return null;

    function metricTimeMs(r: { created_at?: unknown; fecha?: unknown }): number {
      if (r.created_at != null && String(r.created_at).length > 0) {
        const t = new Date(String(r.created_at)).getTime();
        if (Number.isFinite(t)) return t;
      }
      if (r.fecha != null) {
        const t = new Date(String(r.fecha) + 'T12:00:00').getTime();
        if (Number.isFinite(t)) return t;
      }
      return NaN;
    }

    const sortedByFecha = [...rows].sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')));
    const latest = sortedByFecha[0];
    const pesoActual = Number(latest?.peso_kg);
    if (!Number.isFinite(pesoActual)) return null;

    let best = rows[0]!;
    if (Number.isFinite(goalMs)) {
      let bestDiff = Infinity;
      for (const r of rows) {
        const t = metricTimeMs(r);
        if (!Number.isFinite(t)) continue;
        const d = Math.abs(t - goalMs);
        if (d < bestDiff) {
          bestDiff = d;
          best = r;
        }
      }
    }

    const pesoInicio = Number(best.peso_kg);
    if (!Number.isFinite(pesoInicio)) return null;
    if (pesoInicio === pesoObjMeta) return null;

    let pct: number;
    if (obj === 'perder_peso') {
      pct = ((pesoInicio - pesoActual) / (pesoInicio - pesoObjMeta)) * 100;
    } else {
      pct = ((pesoActual - pesoInicio) / (pesoObjMeta - pesoInicio)) * 100;
    }
    if (!Number.isFinite(pct)) return null;
    pct = Math.max(0, Math.min(100, pct));

    return {
      pesoInicio,
      pesoActual,
      pesoObjetivo: pesoObjMeta,
      objetivo: obj as 'perder_peso' | 'ganar_masa',
      porcentaje: pct,
    };
  },

  /**
   * `genero`, `edad`, `altura_cm`, `factor_actividad` desde `profiles`;
   * `peso_kg` desde el último registro de `user_body_metrics`.
   */
  async obtenerContextoPlanNutricion(userId: string): Promise<ContextoPlanNutricion> {
    const [{ data: mRow }, { data: pRow }] = await Promise.all([
      supabase
        .from('user_body_metrics')
        .select('peso_kg')
        .eq('user_id', userId)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('genero, edad, altura_cm, factor_actividad')
        .eq('id', userId)
        .maybeSingle(),
    ]);

    const pesoRaw = mRow?.peso_kg;
    const pesoNum = pesoRaw != null ? Number(pesoRaw) : NaN;
    const pesoKg = Number.isFinite(pesoNum) && pesoNum > 0 ? pesoNum : null;

    const g = pRow?.genero;
    const genero = g === 'hombre' || g === 'mujer' ? g : null;

    const e = pRow?.edad;
    let edad: number | null = null;
    if (typeof e === 'number' && Number.isFinite(e) && e > 0) edad = Math.round(e);
    else if (typeof e === 'string') {
      const n = parseInt(e, 10);
      if (Number.isFinite(n) && n > 0) edad = n;
    }

    const a = pRow?.altura_cm;
    let alturaCm: number | null = null;
    if (a != null) {
      const n = Number(a);
      if (Number.isFinite(n) && n > 0) alturaCm = n;
    }

    const f = pRow?.factor_actividad;
    let factorActividad: number | null = null;
    if (typeof f === 'number' && Number.isFinite(f) && f > 0) factorActividad = f;
    else if (typeof f === 'string') {
      const n = parseFloat(f.replace(',', '.'));
      if (Number.isFinite(n) && n > 0) factorActividad = n;
    }

    return {
      genero,
      edad,
      alturaCm,
      factorActividad,
      pesoKg,
    };
  },

  /**
   * Media diaria por semana: suma de ítems / días con fila en nutrition_logs en esa semana.
   */
  async obtenerNutricionSemanal(
    userId: string,
    fechaInicio: string,
    fechaFin: string,
  ): Promise<NutricionSemana[]> {
    const ini = fechaInicio;
    const fin = fechaFin;

    const [{ data: logs, error: e1 }, { data: items, error: e2 }] = await Promise.all([
      supabase.from('nutrition_logs').select('fecha').eq('user_id', userId).gte('fecha', ini).lte('fecha', fin),
      supabase
        .from('nutrition_log_items')
        .select(
          `
          calorias_calculadas,
          proteinas_calculadas,
          carbos_calculados,
          grasas_calculadas,
          nutrition_log_meals!inner (
            nutrition_logs!inner (user_id, fecha)
          )
        `,
        )
        .eq('nutrition_log_meals.nutrition_logs.user_id', userId)
        .gte('nutrition_log_meals.nutrition_logs.fecha', ini)
        .lte('nutrition_log_meals.nutrition_logs.fecha', fin),
    ]);

    if (e1) throw e1;
    if (e2) throw e2;

    const daysByWeek = new Map<string, Set<string>>();
    for (const row of logs ?? []) {
      const f = row.fecha as string;
      const w = inicioSemanaLunesIso(f);
      if (!daysByWeek.has(w)) daysByWeek.set(w, new Set());
      daysByWeek.get(w)!.add(f);
    }

    type Sum = { kcal: number; proteinas: number; carbos: number; grasas: number };
    const sumsByWeek = new Map<string, Sum>();

    const add = (w: string, s: Sum) => {
      const prev = sumsByWeek.get(w) ?? { kcal: 0, proteinas: 0, carbos: 0, grasas: 0 };
      sumsByWeek.set(w, {
        kcal: prev.kcal + s.kcal,
        proteinas: prev.proteinas + s.proteinas,
        carbos: prev.carbos + s.carbos,
        grasas: prev.grasas + s.grasas,
      });
    };

    for (const row of items ?? []) {
      const nl = (row as any).nutrition_log_meals?.nutrition_logs;
      if (!nl?.fecha) continue;
      const fecha = nl.fecha as string;
      const w = inicioSemanaLunesIso(fecha);
      add(w, {
        kcal: Number(row.calorias_calculadas) || 0,
        proteinas: Number(row.proteinas_calculadas) || 0,
        carbos: Number(row.carbos_calculados) || 0,
        grasas: Number(row.grasas_calculadas) || 0,
      });
    }

    const semanas = enumerarSemanasLunes(ini, fin);
    return semanas.map((semanaInicio) => {
      const days = daysByWeek.get(semanaInicio)?.size ?? 0;
      const sum = sumsByWeek.get(semanaInicio) ?? { kcal: 0, proteinas: 0, carbos: 0, grasas: 0 };
      return {
        semanaInicio,
        kcal: days > 0 ? sum.kcal / days : 0,
        proteinas: days > 0 ? sum.proteinas / days : 0,
        carbos: days > 0 ? sum.carbos / days : 0,
        grasas: days > 0 ? sum.grasas / days : 0,
      };
    });
  },

  async obtenerContadorDiasRegistrados(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('nutrition_log_items')
      .select(
        `
        nutrition_log_meals!inner (
          nutrition_logs!inner (user_id, fecha)
        )
      `,
      )
      .eq('nutrition_log_meals.nutrition_logs.user_id', userId);
    if (error) throw error;
    const fechas = new Set<string>();
    for (const row of data ?? []) {
      const nl = (row as { nutrition_log_meals?: { nutrition_logs?: { fecha?: string } } }).nutrition_log_meals
        ?.nutrition_logs;
      const f = nl?.fecha;
      if (f) fechas.add(f);
    }
    return fechas.size;
  },

  async obtenerContadorEntrenos(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('workout_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('hora_fin', 'is', null);
    if (error) throw error;
    return count ?? 0;
  },

  /** Fecha de alta (solo día) YYYY-MM-DD desde profiles.created_at */
  async obtenerFechaRegistro(userId: string): Promise<string> {
    const { data, error } = await supabase
      .from('profiles')
      .select('created_at')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    const raw = data?.created_at as string | undefined;
    if (!raw) return fechaHoyIsoLocal();
    return raw.slice(0, 10);
  },

  async obtenerHistorialPeso(
    userId: string,
    fechaInicio: string,
    fechaFin: string,
  ): Promise<RegistroPeso[]> {
    const { data, error } = await supabase
      .from('user_body_metrics')
      .select('fecha, peso_kg')
      .eq('user_id', userId)
      .not('peso_kg', 'is', null)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: true });
    if (error) throw error;
    return (data ?? [])
      .map((r) => ({
        fecha: r.fecha as string,
        peso_kg: Number(r.peso_kg),
      }))
      .filter((r) => !Number.isNaN(r.peso_kg));
  },

  async upsertPesoHoy(userId: string, pesoKg: number): Promise<void> {
    const fecha = fechaHoyIsoLocal();
    const { error } = await supabase.from('user_body_metrics').upsert(
      {
        user_id: userId,
        peso_kg: pesoKg,
        fecha,
      },
      { onConflict: 'user_id,fecha' },
    );
    if (error) throw error;
  },

  /**
   * Ejercicios presentes en al menos una sesión del usuario (nombre y músculo para lista).
   */
  async obtenerEjerciciosRealizados(userId: string): Promise<EjercicioResumen[]> {
    const { data: wseRows, error } = await supabase
      .from('workout_session_exercises')
      .select('exercise_id, workout_sessions!inner(user_id)')
      .eq('workout_sessions.user_id', userId);
    if (error) throw error;
    const ids = [...new Set((wseRows ?? []).map((r) => r.exercise_id as string))];
    if (ids.length === 0) return [];

    const chunks = chunkIds(ids, 120);
    const exercises: {
      id: string;
      nombre: string;
      musculo_primario: string;
      equipamiento: string | null;
      musculos_secundarios: string[] | null;
    }[] = [];
    for (const part of chunks) {
      const { data: ex, error: e2 } = await supabase
        .from('exercises')
        .select('id, nombre, musculo_primario, equipamiento, musculos_secundarios')
        .in('id', part)
        .order('nombre');
      if (e2) throw e2;
      exercises.push(...((ex ?? []) as any[]));
    }
    exercises.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return exercises.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      musculo_primario: e.musculo_primario,
      equipamiento: e.equipamiento ?? null,
      musculos_secundarios: Array.isArray(e.musculos_secundarios) ? e.musculos_secundarios : [],
    }));
  },

  /**
   * Rutinas del usuario (creadas por él) que incluyen el ejercicio; sesiones y series en el rango de fechas.
   */
  async obtenerEstadisticasEjercicio(
    userId: string,
    exerciseId: string,
    fechaInicio: string,
    fechaFin: string,
  ): Promise<EstadisticasEjercicio> {
    const [{ data: reRows, error: eRe }, { data: wseRows, error: eWse }] = await Promise.all([
      supabase
        .from('routine_exercises')
        .select('routine_id, routines!inner(created_by)')
        .eq('exercise_id', exerciseId)
        .eq('routines.created_by', userId),
      supabase
        .from('workout_session_exercises')
        .select('id, session_id, workout_sessions!inner(fecha, user_id)')
        .eq('exercise_id', exerciseId)
        .eq('workout_sessions.user_id', userId)
        .gte('workout_sessions.fecha', fechaInicio)
        .lte('workout_sessions.fecha', fechaFin),
    ]);
    if (eRe) throw eRe;
    if (eWse) throw eWse;

    const rutinas = new Set((reRows ?? []).map((r) => r.routine_id as string)).size;
    const sesionesList = wseRows ?? [];
    const veces = new Set(sesionesList.map((r) => r.session_id as string)).size;
    const wseIds = sesionesList.map((r) => r.id as string);

    const wseIdToSessionId = new Map<string, string>();
    const bySession = new Map<
      string,
      { fecha: string; pesos: number[]; reps: number[]; volumen: number; series: number }
    >();
    for (const row of sesionesList) {
      const wseId = row.id as string;
      const sessionId = row.session_id as string;
      const fecha = ((row as any).workout_sessions?.fecha as string) ?? '';
      wseIdToSessionId.set(wseId, sessionId);
      if (!bySession.has(sessionId)) {
        bySession.set(sessionId, { fecha, pesos: [], reps: [], volumen: 0, series: 0 });
      }
    }

    const setsRows: {
      session_exercise_id: string;
      peso_kg: number | null;
      repeticiones: number | null;
    }[] = [];

    for (const part of chunkIds(wseIds, 150)) {
      if (part.length === 0) continue;
      const { data: sets, error: eS } = await supabase
        .from('workout_sets')
        .select('session_exercise_id, peso_kg, repeticiones, completada')
        .in('session_exercise_id', part)
        .eq('completada', true);
      if (eS) throw eS;
      for (const s of sets ?? []) {
        setsRows.push({
          session_exercise_id: s.session_exercise_id as string,
          peso_kg: s.peso_kg != null ? Number(s.peso_kg) : null,
          repeticiones: s.repeticiones != null ? Number(s.repeticiones) : null,
        });
      }
    }

    for (const st of setsRows) {
      const sessionId = wseIdToSessionId.get(st.session_exercise_id);
      if (!sessionId) continue;
      const agg = bySession.get(sessionId);
      if (!agg) continue;
      agg.series += 1;
      const p = st.peso_kg;
      const r = st.repeticiones;
      if (p != null && !Number.isNaN(p)) {
        agg.pesos.push(p);
        const reps = r != null && !Number.isNaN(r) ? r : 0;
        agg.volumen += p * reps;
      }
      if (r != null && !Number.isNaN(r)) {
        agg.reps.push(r);
      }
    }

    const porSesion: SesionEjercicioStats[] = [...bySession.entries()]
      .map(([, v]) => ({
        fecha: v.fecha,
        mejorPeso: v.pesos.length ? Math.max(...v.pesos) : null,
        volumen: v.volumen,
        mejorReps: v.reps.length ? Math.max(...v.reps) : null,
        series: v.series,
      }))
      .filter((row) => row.fecha && row.series > 0)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    let mejorPeso: number | null = null;
    let mejorReps: number | null = null;
    for (const st of setsRows) {
      if (st.peso_kg != null && !Number.isNaN(st.peso_kg)) {
        mejorPeso = mejorPeso == null ? st.peso_kg : Math.max(mejorPeso, st.peso_kg);
      }
      if (st.repeticiones != null && !Number.isNaN(st.repeticiones)) {
        mejorReps = mejorReps == null ? st.repeticiones : Math.max(mejorReps, st.repeticiones);
      }
    }

    return {
      rutinas,
      veces,
      mejorPeso,
      mejorReps,
      porSesion,
    };
  },

  /**
   * Series completadas en el periodo, agrupadas por región muscular (todos los ejercicios del usuario).
   */
  async obtenerDistribucionMuscular(
    userId: string,
    fechaInicio: string,
    fechaFin: string,
  ): Promise<DistribucionMuscular[]> {
    const { data, error } = await supabase
      .from('workout_sets')
      .select(
        'id, workout_session_exercises!inner ( exercises!inner ( musculo_primario ), workout_sessions!inner ( user_id, fecha ) )',
      )
      .eq('completada', true)
      .eq('workout_session_exercises.workout_sessions.user_id', userId)
      .gte('workout_session_exercises.workout_sessions.fecha', fechaInicio)
      .lte('workout_session_exercises.workout_sessions.fecha', fechaFin);
    if (error) throw error;

    const porGrupo = new Map<string, number>();
    for (const row of data ?? []) {
      const wse = (row as any).workout_session_exercises;
      const mp = wse?.exercises?.musculo_primario as string | undefined;
      if (!mp) continue;
      const g = mapearMusculoPrimarioAGrupo(mp);
      if (!g) continue;
      porGrupo.set(g, (porGrupo.get(g) ?? 0) + 1);
    }

    const total = [...porGrupo.values()].reduce((a, b) => a + b, 0);
    if (total <= 0) return [];

    const out: DistribucionMuscular[] = GRUPOS_MUSCULARES_ORDEN.map((grupo) => {
      const series = porGrupo.get(grupo) ?? 0;
      return {
        grupo,
        series,
        porcentaje: (series / total) * 100,
      };
    }).filter((r) => r.series > 0);

    out.sort((a, b) => b.porcentaje - a.porcentaje);
    return out;
  },
};

export function fechaInicioRangoProgreso(
  tipo: '3m' | '1y' | 'all',
  fechaRegistroIso: string,
): string {
  const hoy = new Date();
  if (tipo === 'all') {
    return fechaRegistroIso;
  }
  const d = new Date(hoy);
  if (tipo === '3m') {
    d.setMonth(d.getMonth() - 3);
  } else {
    d.setFullYear(d.getFullYear() - 1);
  }
  const candidata = fechaIsoDesdeDate(d);
  return clampFechaMin(candidata, fechaRegistroIso);
}
