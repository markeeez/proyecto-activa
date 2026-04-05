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
  sets: BorradorSerieLinea[];
};
