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

export interface NutricionDia {
  fecha: string;
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
  foto_url: string | null;
  dificultad: string | null;
  tracking_mode: 'strength' | 'cardio_time' | 'cardio_time_distance' | null;
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

export interface SesionCardioStats {
  fecha: string;
  totalTiempoSeg: number;
  mejorTiempoSeg: number | null;
  mayorDistanciaKm: number | null;
  series: number;
}

export interface EstadisticasCardio {
  veces: number;
  mejorTiempoSeg: number | null;
  mayorDistanciaKm: number | null;
  porSesion: SesionCardioStats[];
}

export interface DistribucionMuscular {
  grupo: string;
  series: number;
  porcentaje: number;
}

/** Día agregado para gráficos de detalle de ejercicio (consulta-ejercicio). */
export type EstadisticaEjercicioDia = {
  fecha: string;
  mayorPeso: number;
  oneRepMax: number;
  mejorVolumenSerie: number;
  totalRepeticiones: number;
};

/** Records históricos de un ejercicio (consulta-ejercicio). */
export type RecordsEjercicio = {
  mayorPeso: number;
  mejorVolumenSerie: number;
  mejorSeriePesoKg: number;
  mejorSerieReps: number;
  mejorVolumenTotal: number;
};

export type SesionEjercicioHistorial = {
  sessionId: string;
  sessionNombre: string | null;
  fecha: string;
  horaInicio: string | null;
  sets: {
    numeroSerie: number;
    tipoSerie: string;
    pesoKg: number | null;
    repeticiones: number | null;
    tipoPeso: string;
    duracionSeg: number | null;
    distanciaKm: number | null;
  }[];
};

/** Día agregado para gráficos de cardio (consulta-ejercicio). */
export type EstadisticaCardioEjercicioDia = {
  fecha: string;
  mejorTiempoSeg: number;
  mayorDistanciaKm: number;
  totalTiempoSeg: number;
};

/** Records históricos de cardio de un ejercicio (consulta-ejercicio). */
export type RecordsCardioEjercicio = {
  mejorTiempoSeg: number;
  mayorDistanciaKm: number;
};

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

const SUPABASE_PAGE_SIZE = 1000;

async function obtenerTodasLasFilas<T>(
  buildQuery: () => any,
  contextoError: string,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;

  while (true) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) {
      console.error(contextoError, error.message);
      throw error;
    }

    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
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

  async obtenerNutricionDiaria(
    userId: string,
    fechaInicio: string,
    fechaFin: string,
  ): Promise<NutricionDia[]> {
    const { data, error } = await supabase
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
      .gte('nutrition_log_meals.nutrition_logs.fecha', fechaInicio)
      .lte('nutrition_log_meals.nutrition_logs.fecha', fechaFin);

    if (error) throw error;

    const sumsByDay = new Map<string, Omit<NutricionDia, 'fecha'>>();
    for (const row of data ?? []) {
      const fecha = (row as any).nutrition_log_meals?.nutrition_logs?.fecha as string | undefined;
      if (!fecha) continue;
      const prev = sumsByDay.get(fecha) ?? { kcal: 0, proteinas: 0, carbos: 0, grasas: 0 };
      sumsByDay.set(fecha, {
        kcal: prev.kcal + (Number(row.calorias_calculadas) || 0),
        proteinas: prev.proteinas + (Number(row.proteinas_calculadas) || 0),
        carbos: prev.carbos + (Number(row.carbos_calculados) || 0),
        grasas: prev.grasas + (Number(row.grasas_calculadas) || 0),
      });
    }

    const out: NutricionDia[] = [];
    let cur = fechaInicio;
    while (cur <= fechaFin) {
      const sum = sumsByDay.get(cur) ?? { kcal: 0, proteinas: 0, carbos: 0, grasas: 0 };
      out.push({ fecha: cur, ...sum });
      cur = agregarDiasIso(cur, 1);
    }
    return out;
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

  async obtenerPesoUsuario(userId: string): Promise<number | null> {
    const { data, error } = await supabase
      .from('user_body_metrics')
      .select('peso_kg')
      .eq('user_id', userId)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('[obtenerPesoUsuario]', error.message);
      return null;
    }
    const raw = data?.peso_kg;
    const n = raw != null ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  },

  /**
   * Ejercicios presentes en al menos una sesión del usuario (nombre y músculo para lista).
   * Una sola query con JOIN: workout_session_exercises → workout_sessions (filtro user_id)
   * + exercises embebido. Sin round-trip extra ni chunking.
   */
  async obtenerEjerciciosRealizados(userId: string): Promise<EjercicioResumen[]> {
    const { data, error } = await supabase
      .from('workout_session_exercises')
      .select(
        'exercise_id, exercises!inner(id, nombre, musculo_primario, equipamiento, musculos_secundarios, foto_url, dificultad, tracking_mode), workout_sessions!inner(user_id)',
      )
      .eq('workout_sessions.user_id', userId);

    if (error) {
      console.error('[progresoService.obtenerEjerciciosRealizados]', error.message);
      return [];
    }

    const seen = new Set<string>();
    const out: EjercicioResumen[] = [];
    for (const row of data ?? []) {
      const ex = (row as any).exercises as {
        id: string;
        nombre: string;
        musculo_primario: string;
        equipamiento: string | null;
        musculos_secundarios: string[] | null;
        foto_url: string | null;
        dificultad: string | null;
        tracking_mode: string | null;
      } | null;
      if (!ex || seen.has(ex.id)) continue;
      seen.add(ex.id);
      const tm = ex.tracking_mode;
      out.push({
        id: ex.id,
        nombre: ex.nombre,
        musculo_primario: ex.musculo_primario,
        equipamiento: ex.equipamiento ?? null,
        musculos_secundarios: Array.isArray(ex.musculos_secundarios) ? ex.musculos_secundarios : [],
        foto_url: ex.foto_url ?? null,
        dificultad: ex.dificultad ?? null,
        tracking_mode:
          tm === 'cardio_time' || tm === 'cardio_time_distance' || tm === 'strength' ? tm : null,
      });
    }
    out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return out;
  },

  /**
   * Rutinas del usuario (creadas por él) que incluyen el ejercicio; sesiones y series en el rango de fechas.
   * 2 queries en paralelo en lugar de 3 secuenciales: routine_exercises + workout_sets con JOIN completo.
   */
  async obtenerEstadisticasEjercicio(
    userId: string,
    exerciseId: string,
    fechaInicio: string,
    fechaFin: string,
  ): Promise<EstadisticasEjercicio> {
    const [{ data: reRows, error: eRe }, { data: setsData, error: eS }] = await Promise.all([
      supabase
        .from('routine_exercises')
        .select('routine_id, routines!inner(created_by)')
        .eq('exercise_id', exerciseId)
        .eq('routines.created_by', userId),
      supabase
        .from('workout_sets')
        .select(
          'peso_kg, repeticiones, workout_session_exercises!inner(id, session_id, exercise_id, workout_sessions!inner(user_id, fecha))',
        )
        .eq('completada', true)
        .eq('workout_session_exercises.exercise_id', exerciseId)
        .eq('workout_session_exercises.workout_sessions.user_id', userId)
        .gte('workout_session_exercises.workout_sessions.fecha', fechaInicio)
        .lte('workout_session_exercises.workout_sessions.fecha', fechaFin),
    ]);
    if (eRe) throw eRe;
    if (eS) throw eS;

    const rutinas = new Set((reRows ?? []).map((r) => r.routine_id as string)).size;

    const bySession = new Map<
      string,
      { fecha: string; pesos: number[]; reps: number[]; volumen: number; series: number }
    >();

    let mejorPeso: number | null = null;
    let mejorReps: number | null = null;

    for (const row of setsData ?? []) {
      const wse = (row as any).workout_session_exercises as {
        session_id?: string;
        workout_sessions?: { fecha?: string };
      } | null;
      if (!wse) continue;
      const sessionId = wse.session_id as string | undefined;
      const fecha = wse.workout_sessions?.fecha as string | undefined;
      if (!sessionId || !fecha) continue;

      const p = row.peso_kg != null ? Number(row.peso_kg) : null;
      const r = row.repeticiones != null ? Number(row.repeticiones) : null;
      const pOk = p != null && !Number.isNaN(p);
      const rOk = r != null && !Number.isNaN(r);

      if (!bySession.has(sessionId)) {
        bySession.set(sessionId, { fecha, pesos: [], reps: [], volumen: 0, series: 0 });
      }
      const agg = bySession.get(sessionId)!;
      agg.series += 1;
      if (pOk) {
        agg.pesos.push(p!);
        agg.volumen += p! * (rOk ? r! : 0);
        mejorPeso = mejorPeso == null ? p! : Math.max(mejorPeso, p!);
      }
      if (rOk) {
        agg.reps.push(r!);
        mejorReps = mejorReps == null ? r! : Math.max(mejorReps, r!);
      }
    }

    const veces = bySession.size;

    const porSesion: SesionEjercicioStats[] = [...bySession.values()]
      .map((v) => ({
        fecha: v.fecha,
        mejorPeso: v.pesos.length ? Math.max(...v.pesos) : null,
        volumen: v.volumen,
        mejorReps: v.reps.length ? Math.max(...v.reps) : null,
        series: v.series,
      }))
      .filter((row) => row.fecha && row.series > 0)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    return {
      rutinas,
      veces,
      mejorPeso,
      mejorReps,
      porSesion,
    };
  },

  async obtenerEstadisticasCardio(
    userId: string,
    exerciseId: string,
    fechaInicio: string,
    fechaFin: string,
    conDistancia: boolean,
  ): Promise<EstadisticasCardio> {
    const { data: setsData, error } = await supabase
      .from('workout_sets')
      .select(
        'duracion_seg, distancia_km, workout_session_exercises!inner(id, session_id, exercise_id, workout_sessions!inner(user_id, fecha))',
      )
      .eq('completada', true)
      .eq('workout_session_exercises.exercise_id', exerciseId)
      .eq('workout_session_exercises.workout_sessions.user_id', userId)
      .gte('workout_session_exercises.workout_sessions.fecha', fechaInicio)
      .lte('workout_session_exercises.workout_sessions.fecha', fechaFin);
    if (error) throw error;

    const bySession = new Map<
      string,
      { fecha: string; tiempos: number[]; distancias: number[]; series: number }
    >();

    let mejorTiempoSeg: number | null = null;
    let mayorDistanciaKm: number | null = null;

    for (const row of setsData ?? []) {
      const wse = (row as any).workout_session_exercises as {
        session_id?: string;
        workout_sessions?: { fecha?: string };
      } | null;
      if (!wse) continue;
      const sessionId = wse.session_id as string | undefined;
      const fecha = wse.workout_sessions?.fecha as string | undefined;
      if (!sessionId || !fecha) continue;

      const durRaw = (row as any).duracion_seg;
      const distRaw = (row as any).distancia_km;
      const dur = durRaw != null && durRaw !== '' ? Number(durRaw) : null;
      const dist = distRaw != null && distRaw !== '' ? Number(distRaw) : null;
      const durOk = dur != null && !Number.isNaN(dur) && dur > 0;
      const distOk = dist != null && !Number.isNaN(dist) && dist > 0;

      if (!bySession.has(sessionId)) {
        bySession.set(sessionId, { fecha, tiempos: [], distancias: [], series: 0 });
      }
      const agg = bySession.get(sessionId)!;
      agg.series += 1;
      if (durOk) {
        agg.tiempos.push(dur!);
        mejorTiempoSeg = mejorTiempoSeg == null ? dur! : Math.max(mejorTiempoSeg, dur!);
      }
      if (distOk) {
        agg.distancias.push(dist!);
        mayorDistanciaKm = mayorDistanciaKm == null ? dist! : Math.max(mayorDistanciaKm, dist!);
      }
    }

    const veces = bySession.size;
    const porSesion: SesionCardioStats[] = [...bySession.values()]
      .map((v) => ({
        fecha: v.fecha,
        totalTiempoSeg: v.tiempos.reduce((a, b) => a + b, 0),
        mejorTiempoSeg: v.tiempos.length ? Math.max(...v.tiempos) : null,
        mayorDistanciaKm: conDistancia && v.distancias.length ? Math.max(...v.distancias) : null,
        series: v.series,
      }))
      .filter((r) => r.fecha && r.series > 0)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    return { veces, mejorTiempoSeg, mayorDistanciaKm: conDistancia ? mayorDistanciaKm : null, porSesion };
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
        'workout_session_exercises!inner ( exercises!inner ( musculo_primario ), workout_sessions!inner ( user_id, fecha ) )',
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

  /**
   * Series completadas de un ejercicio, agregadas por día (métricas en cliente).
   */
  async obtenerEstadisticasEjercicioDetalle(
    exerciseId: string,
    userId: string,
    periodo: 'trimestre' | 'anio' | 'todo',
  ): Promise<EstadisticaEjercicioDia[]> {
    const fechaMin = fechaMinimaPeriodoEjercicioDetalle(periodo);
    let q = supabase
      .from('workout_sets')
      .select(
        'peso_kg, repeticiones, tipo_peso, workout_session_exercises!inner ( exercise_id, session_id, workout_sessions!inner ( user_id, fecha ) )',
      )
      .eq('completada', true)
      .eq('workout_session_exercises.exercise_id', exerciseId)
      .eq('workout_session_exercises.workout_sessions.user_id', userId);
    if (fechaMin != null) {
      q = q.gte('workout_session_exercises.workout_sessions.fecha', fechaMin);
    }
    const { data, error } = await q;
    if (error) throw error;

    type AggSession = {
      pesos: number[];
      epleys: number[];
      volSeries: number[];
      totalReps: number;
    };
    // Agrupamos primero por (fecha, sessionId) para no mezclar sesiones distintas del mismo día
    const bySession = new Map<string, AggSession>();
    const sessionFecha = new Map<string, string>();

    for (const row of data ?? []) {
      const wse = (row as {
        peso_kg?: unknown;
        repeticiones?: unknown;
        workout_session_exercises?: {
          session_id?: string;
          workout_sessions?: { fecha?: string };
        };
      }).workout_session_exercises;
      const fecha = wse?.workout_sessions?.fecha;
      const sessionId = wse?.session_id;
      if (!fecha || !sessionId) continue;

      const pesoRaw = (row as { peso_kg?: unknown }).peso_kg;
      const repsRaw = (row as { repeticiones?: unknown }).repeticiones;
      const peso = pesoRaw != null && pesoRaw !== '' ? Number(pesoRaw) : null;
      const reps = repsRaw != null && repsRaw !== '' ? Number(repsRaw) : null;

      const key = `${fecha}__${sessionId}`;
      let agg = bySession.get(key);
      if (!agg) {
        agg = { pesos: [], epleys: [], volSeries: [], totalReps: 0 };
        bySession.set(key, agg);
        sessionFecha.set(key, fecha);
      }

      const r = reps != null && !Number.isNaN(reps) ? reps : 0;
      agg.totalReps += r;

      if (peso != null && !Number.isNaN(peso)) {
        agg.pesos.push(peso);
      }

      const pEpley = peso != null && !Number.isNaN(peso) ? peso : 0;
      if (reps != null && !Number.isNaN(reps)) {
        agg.epleys.push(pEpley * (1 + reps / 30));
      }

      const pVol = peso != null && !Number.isNaN(peso) ? peso : 0;
      agg.volSeries.push(pVol * r);
    }

    // Consolidamos por día tomando el mejor valor de cada sesión (no la suma entre sesiones)
    type AggDay = {
      mayorPeso: number;
      oneRepMax: number;
      mejorVolumenSerie: number;
      totalRepeticiones: number;
    };
    const byDay = new Map<string, AggDay>();

    for (const [key, agg] of bySession.entries()) {
      const fecha = sessionFecha.get(key)!;
      const mayorPesoSesion = agg.pesos.length ? Math.max(...agg.pesos) : 0;
      const oneRepMaxSesion = agg.epleys.length ? Math.max(...agg.epleys) : 0;
      const mejorVolSesion = agg.volSeries.length ? Math.max(...agg.volSeries) : 0;

      const prev = byDay.get(fecha);
      if (!prev) {
        byDay.set(fecha, {
          mayorPeso: mayorPesoSesion,
          oneRepMax: oneRepMaxSesion,
          mejorVolumenSerie: mejorVolSesion,
          totalRepeticiones: agg.totalReps,
        });
      } else {
        byDay.set(fecha, {
          mayorPeso: Math.max(prev.mayorPeso, mayorPesoSesion),
          oneRepMax: Math.max(prev.oneRepMax, oneRepMaxSesion),
          mejorVolumenSerie: Math.max(prev.mejorVolumenSerie, mejorVolSesion),
          totalRepeticiones: Math.max(prev.totalRepeticiones, agg.totalReps),
        });
      }
    }

    const out: EstadisticaEjercicioDia[] = [...byDay.entries()]
      .map(([fecha, agg]) => ({
        fecha,
        mayorPeso: agg.mayorPeso,
        oneRepMax: agg.oneRepMax,
        mejorVolumenSerie: agg.mejorVolumenSerie,
        totalRepeticiones: agg.totalRepeticiones,
      }))
      .filter((row) => row.totalRepeticiones > 0 || row.mayorPeso > 0 || row.oneRepMax > 0 || row.mejorVolumenSerie > 0)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    return out;
  },

  async obtenerRecordsEjercicio(exerciseId: string, userId: string): Promise<RecordsEjercicio> {
    const { data, error } = await supabase
      .from('workout_sets')
      .select(
        'peso_kg, repeticiones, workout_session_exercises!inner ( exercise_id, session_id, workout_sessions!inner ( user_id ) )',
      )
      .eq('completada', true)
      .eq('workout_session_exercises.exercise_id', exerciseId)
      .eq('workout_session_exercises.workout_sessions.user_id', userId);
    if (error) throw error;

    let mayorPeso = 0;
    let mejorVolumenSerie = 0;
    let mejorSeriePesoKg = 0;
    let mejorSerieReps = 0;
    const volPorSesion = new Map<string, number>();

    for (const row of data ?? []) {
      const wse = (row as {
        peso_kg?: unknown;
        repeticiones?: unknown;
        workout_session_exercises?: { session_id?: string };
      }).workout_session_exercises;
      const sessionId = wse?.session_id;
      const pesoRaw = (row as { peso_kg?: unknown }).peso_kg;
      const repsRaw = (row as { repeticiones?: unknown }).repeticiones;
      const peso = pesoRaw != null && pesoRaw !== '' ? Number(pesoRaw) : null;
      const reps = repsRaw != null && repsRaw !== '' ? Number(repsRaw) : null;
      const p = peso != null && !Number.isNaN(peso) ? peso : 0;
      const r = reps != null && !Number.isNaN(reps) ? reps : 0;

      if (peso != null && !Number.isNaN(peso)) {
        mayorPeso = mayorPeso === 0 ? peso : Math.max(mayorPeso, peso);
      }

      const volSerie = p * r;
      if (volSerie > mejorVolumenSerie) {
        mejorVolumenSerie = volSerie;
        mejorSeriePesoKg = p;
        mejorSerieReps = r;
      }

      if (sessionId) {
        volPorSesion.set(sessionId, (volPorSesion.get(sessionId) ?? 0) + volSerie);
      }
    }

    let mejorVolumenTotal = 0;
    for (const v of volPorSesion.values()) {
      if (v > mejorVolumenTotal) mejorVolumenTotal = v;
    }

    return {
      mayorPeso,
      mejorVolumenSerie,
      mejorSeriePesoKg,
      mejorSerieReps,
      mejorVolumenTotal,
    };
  },

  async obtenerEstadisticasCardioDetalle(
    exerciseId: string,
    userId: string,
    periodo: 'trimestre' | 'anio' | 'todo',
  ): Promise<EstadisticaCardioEjercicioDia[]> {
    const fechaMin = fechaMinimaPeriodoEjercicioDetalle(periodo);
    let q = supabase
      .from('workout_sets')
      .select(
        'duracion_seg, distancia_km, workout_session_exercises!inner ( exercise_id, session_id, workout_sessions!inner ( user_id, fecha ) )',
      )
      .eq('completada', true)
      .eq('workout_session_exercises.exercise_id', exerciseId)
      .eq('workout_session_exercises.workout_sessions.user_id', userId);
    if (fechaMin != null) {
      q = q.gte('workout_session_exercises.workout_sessions.fecha', fechaMin);
    }
    const { data, error } = await q;
    if (error) throw error;

    type AggSession = { tiemposSeg: number[]; distanciasKm: number[] };
    const bySession = new Map<string, AggSession>();
    const sessionFecha = new Map<string, string>();

    for (const row of data ?? []) {
      const wse = (row as { workout_session_exercises?: { session_id?: string; workout_sessions?: { fecha?: string } } }).workout_session_exercises;
      const fecha = wse?.workout_sessions?.fecha;
      const sessionId = wse?.session_id;
      if (!fecha || !sessionId) continue;

      const dur = (row as { duracion_seg?: unknown }).duracion_seg;
      const dist = (row as { distancia_km?: unknown }).distancia_km;
      const durSeg = dur != null && dur !== '' ? Number(dur) : null;
      const distKm = dist != null && dist !== '' ? Number(dist) : null;

      const key = `${fecha}__${sessionId}`;
      let agg = bySession.get(key);
      if (!agg) {
        agg = { tiemposSeg: [], distanciasKm: [] };
        bySession.set(key, agg);
        sessionFecha.set(key, fecha);
      }

      if (durSeg != null && !Number.isNaN(durSeg)) agg.tiemposSeg.push(durSeg);
      if (distKm != null && !Number.isNaN(distKm)) agg.distanciasKm.push(distKm);
    }

    type AggDay = { mejorTiempoSeg: number; mayorDistanciaKm: number; totalTiempoSeg: number };
    const byDay = new Map<string, AggDay>();

    for (const [key, agg] of bySession.entries()) {
      const fecha = sessionFecha.get(key)!;
      const mejorTiempoSesion = agg.tiemposSeg.length ? Math.max(...agg.tiemposSeg) : 0;
      const mayorDistSesion = agg.distanciasKm.length ? Math.max(...agg.distanciasKm) : 0;
      const totalTiempoSesion = agg.tiemposSeg.reduce((a, b) => a + b, 0);

      const prev = byDay.get(fecha);
      if (!prev) {
        byDay.set(fecha, { mejorTiempoSeg: mejorTiempoSesion, mayorDistanciaKm: mayorDistSesion, totalTiempoSeg: totalTiempoSesion });
      } else {
        byDay.set(fecha, {
          mejorTiempoSeg: Math.max(prev.mejorTiempoSeg, mejorTiempoSesion),
          mayorDistanciaKm: Math.max(prev.mayorDistanciaKm, mayorDistSesion),
          totalTiempoSeg: Math.max(prev.totalTiempoSeg, totalTiempoSesion),
        });
      }
    }

    return [...byDay.entries()]
      .map(([fecha, agg]) => ({ fecha, ...agg }))
      .filter((r) => r.mejorTiempoSeg > 0 || r.mayorDistanciaKm > 0)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  },

  async obtenerRecordsCardioEjercicio(exerciseId: string, userId: string): Promise<RecordsCardioEjercicio> {
    const { data, error } = await supabase
      .from('workout_sets')
      .select(
        'duracion_seg, distancia_km, workout_session_exercises!inner ( exercise_id, workout_sessions!inner ( user_id ) )',
      )
      .eq('completada', true)
      .eq('workout_session_exercises.exercise_id', exerciseId)
      .eq('workout_session_exercises.workout_sessions.user_id', userId);
    if (error) throw error;

    let mejorTiempoSeg = 0;
    let mayorDistanciaKm = 0;

    for (const row of data ?? []) {
      const dur = (row as { duracion_seg?: unknown }).duracion_seg;
      const dist = (row as { distancia_km?: unknown }).distancia_km;
      const durSeg = dur != null && dur !== '' ? Number(dur) : null;
      const distKm = dist != null && dist !== '' ? Number(dist) : null;
      if (durSeg != null && !Number.isNaN(durSeg)) mejorTiempoSeg = Math.max(mejorTiempoSeg, durSeg);
      if (distKm != null && !Number.isNaN(distKm)) mayorDistanciaKm = Math.max(mayorDistanciaKm, distKm);
    }

    return { mejorTiempoSeg, mayorDistanciaKm };
  },

  async obtenerHistorialEjercicio(
    exerciseId: string,
    userId: string,
  ): Promise<SesionEjercicioHistorial[]> {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select(
        'id, nombre, fecha, hora_inicio, workout_session_exercises!inner ( exercise_id, workout_sets ( numero_serie, tipo_serie, peso_kg, repeticiones, tipo_peso, duracion_seg, distancia_km, completada ) )',
      )
      .eq('user_id', userId)
      .eq('workout_session_exercises.exercise_id', exerciseId);
    if (error) throw error;

    type WseRow = {
      exercise_id?: string;
      workout_sets?: {
        numero_serie?: number;
        tipo_serie?: string;
        peso_kg?: unknown;
        repeticiones?: unknown;
        tipo_peso?: string;
        duracion_seg?: unknown;
        distancia_km?: unknown;
        completada?: boolean;
      }[];
    };

    const sesiones: SesionEjercicioHistorial[] = [];

    for (const sess of data ?? []) {
      const sessionId = String((sess as { id?: string }).id ?? '');
      const nombre = (sess as { nombre?: string | null }).nombre ?? null;
      const fecha = String((sess as { fecha?: string }).fecha ?? '');
      const horaInicio = (sess as { hora_inicio?: string | null }).hora_inicio ?? null;
      const wseList = (sess as { workout_session_exercises?: WseRow | WseRow[] }).workout_session_exercises;
      const list = Array.isArray(wseList) ? wseList : wseList != null ? [wseList] : [];

      const setsFlat: SesionEjercicioHistorial['sets'] = [];
      for (const wse of list) {
        const sets = wse.workout_sets ?? [];
        for (const st of sets) {
          if (!st.completada) continue;
          setsFlat.push({
            numeroSerie: Number(st.numero_serie ?? 0),
            tipoSerie: String(st.tipo_serie ?? 'lineal'),
            pesoKg: st.peso_kg != null && st.peso_kg !== '' ? Number(st.peso_kg) : null,
            repeticiones: st.repeticiones != null && st.repeticiones !== '' ? Number(st.repeticiones) : null,
            tipoPeso: String(st.tipo_peso ?? 'kg'),
            duracionSeg: st.duracion_seg != null && st.duracion_seg !== '' ? Number(st.duracion_seg) : null,
            distanciaKm: st.distancia_km != null && st.distancia_km !== '' ? Number(st.distancia_km) : null,
          });
        }
      }

      setsFlat.sort((a, b) => a.numeroSerie - b.numeroSerie);

      if (setsFlat.length === 0) continue;

      sesiones.push({
        sessionId,
        sessionNombre: nombre,
        fecha,
        horaInicio,
        sets: setsFlat,
      });
    }

    function cmpHora(a: string | null, b: string | null): number {
      const sa = a ?? '';
      const sb = b ?? '';
      return sb.localeCompare(sa);
    }

    sesiones.sort((a, b) => {
      const cf = b.fecha.localeCompare(a.fecha);
      if (cf !== 0) return cf;
      return cmpHora(a.horaInicio, b.horaInicio);
    });

    return sesiones;
  },
};

function fechaMinimaPeriodoEjercicioDetalle(periodo: 'trimestre' | 'anio' | 'todo'): string | null {
  if (periodo === 'todo') return null;
  const d = new Date();
  if (periodo === 'trimestre') {
    d.setMonth(d.getMonth() - 3);
  } else {
    d.setFullYear(d.getFullYear() - 1);
  }
  return fechaIsoDesdeDate(d);
}

export function fechaInicioRangoProgreso(
  tipo: '7d' | '3m' | '1y' | 'all',
  fechaRegistroIso: string,
): string {
  const hoy = new Date();
  if (tipo === 'all') {
    return fechaRegistroIso;
  }
  const d = new Date(hoy);
  if (tipo === '7d') {
    d.setDate(d.getDate() - 7);
  } else if (tipo === '3m') {
    d.setMonth(d.getMonth() - 3);
  } else {
    d.setFullYear(d.getFullYear() - 1);
  }
  const candidata = fechaIsoDesdeDate(d);
  return clampFechaMin(candidata, fechaRegistroIso);
}
