import type { User } from '@supabase/supabase-js';

import type { DetalleSesion } from '@/services/entrenamiento.service';

export type WorkoutShareTheme = 'light' | 'dark';

export type WorkoutShareData = {
  title: string;
  dateLabel: string;
  durationLabel: string;
  durationUnit: string;
  exerciseCount: number;
  kcalLabel: string;
  volumeLabel: string;
  muscles: string[];
  usernameLabel: string;
};

export const WORKOUT_SHARE_CARD_WIDTH = 520;
export const WORKOUT_SHARE_CARD_HEIGHT = 400;

function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatFechaShare(ymd: string): string {
  const dt = parseYmdLocal(ymd);
  return dt.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDuracionShare(
  horaInicio: string | null,
  horaFin: string | null,
): { label: string; unit: string } {
  if (!horaInicio || !horaFin) return { label: '-', unit: '' };
  const inicioMs = new Date(horaInicio).getTime();
  const finMs = new Date(horaFin).getTime();
  if (Number.isNaN(inicioMs) || Number.isNaN(finMs) || finMs <= inicioMs) return { label: '-', unit: '' };
  const segundos = Math.max(1, Math.round((finMs - inicioMs) / 1000));
  if (segundos < 60) return { label: String(segundos), unit: 'seg' };
  const mins = Math.round(segundos / 60);
  if (mins < 60) return { label: String(mins), unit: 'min' };
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return r === 0 ? { label: `${h}`, unit: 'h' } : { label: `${h}h ${r}m`, unit: 'duración' };
}

function calcularVolumenTotal(detalle: DetalleSesion): number {
  let total = 0;
  for (const ej of detalle.ejercicios) {
    for (const set of ej.sets) {
      if (!set.completada) continue;
      if (set.tipo_serie === 'warm_up') continue;
      const peso = set.peso_kg ?? 0;
      const reps = set.repeticiones ?? 0;
      if (peso > 0 && reps > 0) total += peso * reps;
    }
  }
  return Math.round(total);
}

function formatVolumen(kg: number): string {
  if (kg <= 0) return '-';
  if (kg >= 1000) return `${(kg / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })}k`;
  return String(kg);
}

function normalizeMuscle(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const normalized = value.toLocaleLowerCase('es');
  if (normalized === 'sistema cardiovascular' || normalized === 'cardiovascular') return 'Cardio';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function uniquePrimaryMuscles(detalle: DetalleSesion): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ejercicio of detalle.ejercicios) {
    const muscle = normalizeMuscle(ejercicio.musculo_primario);
    if (!muscle) continue;
    const key = muscle.toLocaleLowerCase('es');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(muscle);
  }
  return out.slice(0, 4);
}

export function crearWorkoutShareData(
  detalle: DetalleSesion,
  tituloSesion: string,
  kcalEstimadas: number | null,
  user: User | null | undefined,
  profileUsername?: string | null,
): WorkoutShareData {
  const metadata = user?.user_metadata as { username?: string } | undefined;
  const username =
    profileUsername?.trim() ||
    metadata?.username?.trim() ||
    user?.email?.split('@')[0]?.trim() ||
    'usuario';

  const duracion = formatDuracionShare(detalle.hora_inicio, detalle.hora_fin);
  const volumenKg = calcularVolumenTotal(detalle);

  return {
    title: tituloSesion.trim() || 'Entreno',
    dateLabel: formatFechaShare(detalle.fecha),
    durationLabel: duracion.label,
    durationUnit: duracion.unit,
    exerciseCount: detalle.ejercicios.length,
    kcalLabel: kcalEstimadas != null ? String(kcalEstimadas) : '-',
    volumeLabel: formatVolumen(volumenKg),
    muscles: uniquePrimaryMuscles(detalle),
    usernameLabel: `@${username}`,
  };
}
