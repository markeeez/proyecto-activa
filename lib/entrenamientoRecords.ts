import type { TrackingMode } from '@/types/database.types';
import type { BorradorEjercicioLinea, BorradorSerieLinea } from '@/types/entrenamientoBorrador.types';

export type RecordType = 'max_weight' | 'max_volume' | 'max_duration' | 'max_distance';

export type SetRecordFlags = {
  maxWeight?: boolean;
  maxVolume?: boolean;
  maxDuration?: boolean;
  maxDistance?: boolean;
};

export type RecordBaseline = {
  exerciseId: string;
  recordType: RecordType;
  value: number;
};

export type RecordEvent = RecordBaseline & {
  workoutSetId: string;
};

export type RecordBaselineMap = Record<string, Partial<Record<RecordType, number>>>;

const EPSILON = 0.000001;

function toPositiveNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'string' ? Number(value.trim().replace(/,/g, '.')) : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseRecordDecimal(value: unknown): number | null {
  return toPositiveNumber(value);
}

export function parseRecordInteger(value: unknown): number | null {
  const n = toPositiveNumber(value);
  if (n == null) return null;
  return Number.isInteger(n) ? n : Math.trunc(n);
}

export function esTrackingCardioRecords(mode: TrackingMode | null | undefined): boolean {
  return mode === 'cardio_time' || mode === 'cardio_time_distance';
}

export function valorRecordFuerza(
  set: Pick<BorradorSerieLinea, 'kg' | 'reps' | 'completada'>,
  recordType: Extract<RecordType, 'max_weight' | 'max_volume'>,
): number | null {
  if (!set.completada) return null;
  const peso = parseRecordDecimal(set.kg);
  if (peso == null) return null;
  if (recordType === 'max_weight') return peso;
  const reps = parseRecordInteger(set.reps);
  return reps == null ? null : peso * reps;
}

export function valorRecordCardio(
  set: Pick<BorradorSerieLinea, 'duracionSeg' | 'distanciaKm' | 'completada'>,
  recordType: Extract<RecordType, 'max_duration' | 'max_distance'>,
): number | null {
  if (!set.completada) return null;
  if (recordType === 'max_duration') {
    const minutos = parseRecordInteger(set.duracionSeg);
    return minutos == null ? null : minutos * 60;
  }
  return parseRecordDecimal(set.distanciaKm);
}

export function buildRecordBaselineMap(records: RecordBaseline[]): RecordBaselineMap {
  const out: RecordBaselineMap = {};
  for (const record of records) {
    if (!out[record.exerciseId]) out[record.exerciseId] = {};
    out[record.exerciseId]![record.recordType] = record.value;
  }
  return out;
}

function beatsBaseline(value: number, baseline: number | null | undefined): boolean {
  return baseline == null ? value > 0 : value > baseline + EPSILON;
}

function markBestRecord(
  sets: BorradorSerieLinea[],
  flags: SetRecordFlags[],
  readValue: (set: BorradorSerieLinea) => number | null,
  baseline: number | null | undefined,
  flag: keyof SetRecordFlags,
): void {
  let bestIndex = -1;
  let bestValue: number | null = null;
  sets.forEach((set, index) => {
    const value = readValue(set);
    if (value == null || !beatsBaseline(value, baseline)) return;
    if (bestValue == null || value > bestValue + EPSILON) {
      bestValue = value;
      bestIndex = index;
    }
  });
  if (bestIndex >= 0) flags[bestIndex] = { ...flags[bestIndex], [flag]: true };
}

export function calcularRecordFlagsPorLinea(
  line: Pick<BorradorEjercicioLinea, 'exerciseId' | 'tracking_mode' | 'sets'>,
  baselines: RecordBaselineMap,
): SetRecordFlags[] {
  const flags = line.sets.map(() => ({} as SetRecordFlags));
  const baseline = baselines[line.exerciseId] ?? {};

  if (esTrackingCardioRecords(line.tracking_mode)) {
    markBestRecord(
      line.sets,
      flags,
      (set) => valorRecordCardio(set, 'max_duration'),
      baseline.max_duration,
      'maxDuration',
    );
    markBestRecord(
      line.sets,
      flags,
      (set) => valorRecordCardio(set, 'max_distance'),
      baseline.max_distance,
      'maxDistance',
    );
    return flags;
  }

  markBestRecord(
    line.sets,
    flags,
    (set) => valorRecordFuerza(set, 'max_weight'),
    baseline.max_weight,
    'maxWeight',
  );
  markBestRecord(
    line.sets,
    flags,
    (set) => valorRecordFuerza(set, 'max_volume'),
    baseline.max_volume,
    'maxVolume',
  );
  return flags;
}

export function calcularRecordFlagsPorSetIds(events: RecordEvent[]): Map<string, SetRecordFlags> {
  const out = new Map<string, SetRecordFlags>();
  for (const event of events) {
    const current = out.get(event.workoutSetId) ?? {};
    if (event.recordType === 'max_weight') current.maxWeight = true;
    if (event.recordType === 'max_volume') current.maxVolume = true;
    if (event.recordType === 'max_duration') current.maxDuration = true;
    if (event.recordType === 'max_distance') current.maxDistance = true;
    out.set(event.workoutSetId, current);
  }
  return out;
}

export function tieneRecordFlags(flags: SetRecordFlags | null | undefined): boolean {
  return Boolean(flags?.maxWeight || flags?.maxVolume || flags?.maxDuration || flags?.maxDistance);
}

export type RecordUsuario = {
  id: string;
  exerciseId: string;
  exerciseNombre: string;
  trackingMode: TrackingMode | null;
  recordType: RecordType;
  value: number;
  achievedAt: string;
  serie: {
    repeticiones: number | null;
    pesoKg: number | null;
    tipoPeso: string;
    duracionSeg: number | null;
    distanciaKm: number | null;
  } | null;
};
