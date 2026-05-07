import type { BorradorSerieLinea } from '@/types/entrenamientoBorrador.types';

/** Genera un ID local único para series/ejercicios del borrador (no se persiste en BD). */
export function lid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Crea una serie vacía con valores por defecto para el borrador de entreno. */
export function seriePorDefecto(): BorradorSerieLinea {
  return { setId: lid(), tipoUi: 'lineal', kg: '', reps: '', rir: '', completada: false };
}
