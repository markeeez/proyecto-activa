import { supabase } from '@/lib/supabase';
import { trackOnboardingEvent } from '@/lib/onboardingAnalytics';
import { entrenamientoService } from '@/services/entrenamiento.service';

export type EstadoActivacion = {
  tieneObjetivos: boolean;
  haRegistradoComida: boolean;
  tieneRutinaInicial: boolean;
  haIniciadoEntreno: boolean;
  completada: boolean;
};

const ESTADO_VACIO: EstadoActivacion = {
  tieneObjetivos: false,
  haRegistradoComida: false,
  tieneRutinaInicial: false,
  haIniciadoEntreno: false,
  completada: false,
};

async function existeComidaRegistrada(): Promise<boolean> {
  const { data, error } = await supabase.rpc('usuario_tiene_comida_registrada');
  if (error) {
    if (__DEV__) console.warn('[usuario_tiene_comida_registrada]', error.message);
    return false;
  }
  return Boolean(data);
}

export const activacionService = {
  async obtenerEstado(userId: string): Promise<EstadoActivacion> {
    if (!userId) return ESTADO_VACIO;

    const [goalsRes, routinesRes, sessionsRes, haRegistradoComida] = await Promise.all([
      supabase.from('user_goals').select('id').eq('user_id', userId).limit(1).maybeSingle(),
      supabase.from('routines').select('id').eq('created_by', userId).eq('nombre', 'Rutina inicial').limit(1),
      supabase.from('workout_sessions').select('id').eq('user_id', userId).limit(1),
      existeComidaRegistrada(),
    ]);

    const tieneObjetivos = goalsRes.error == null && goalsRes.data != null;
    const tieneRutinaInicial = (routinesRes.data?.length ?? 0) > 0;
    const haIniciadoEntreno = (sessionsRes.data?.length ?? 0) > 0;
    const completada = tieneObjetivos && haRegistradoComida && haIniciadoEntreno;

    return {
      tieneObjetivos,
      haRegistradoComida,
      tieneRutinaInicial,
      haIniciadoEntreno,
      completada,
    };
  },

  async asegurarRutinaInicial(userId: string): Promise<string | null> {
    const existing = await entrenamientoService.obtenerRutinaInicialUsuario(userId);
    if (existing) return existing.id;

    const routineId = await entrenamientoService.crearRutinaInicialDesdePredeterminada();
    if (routineId) {
      trackOnboardingEvent('starter_routine_created');
    }
    return routineId;
  },
};
