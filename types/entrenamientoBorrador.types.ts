import type { TipoSerieUi } from '@/lib/entrenamientoSerie';

export type BorradorSerieLinea = {
  setId: string;
  tipoUi: TipoSerieUi;
  kg: string;
  reps: string;
  /** Solo pantalla entreno activo */
  completada?: boolean;
};

export type BorradorEjercicioLinea = {
  lineId: string;
  exerciseId: string;
  /** Orden en plantilla/sesión (p. ej. última sesión misma rutina). */
  orden?: number;
  nombre: string;
  musculo_primario: string;
  /** Miniatura en entreno activo (tabla `exercises.foto_url`). */
  foto_url?: string | null;
  sets: BorradorSerieLinea[];
  /** Solo entreno activo — no rutina; no precargar desde historial */
  nota?: string;
};
