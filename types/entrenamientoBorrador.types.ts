import type { TipoSerieUi } from '@/lib/entrenamientoSerie';
import type { TrackingMode } from '@/types/database.types';

export type BorradorSerieLinea = {
  setId: string;
  tipoUi: TipoSerieUi;
  kg: string;
  reps: string;
  duracionSeg?: string;
  distanciaKm?: string;
  /** Solo pantalla entreno activo */
  rir?: string;
  completada?: boolean;
  /** Epoch ms cuando se marcó completada — usado para calcular descanso */
  completada_at?: number;
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
  tracking_mode?: TrackingMode;
  sets: BorradorSerieLinea[];
  /** Solo entreno activo — no rutina; no precargar desde historial */
  nota?: string;
};
