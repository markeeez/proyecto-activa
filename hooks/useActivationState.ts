import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { NUTRICION_LOG_ACTUALIZADO } from '@/lib/nutricionEvents';
import { trackOnboardingEvent } from '@/lib/onboardingAnalytics';
import { activacionService, type EstadoActivacion } from '@/services/activacion.service';

const ESTADO_INICIAL: EstadoActivacion = {
  tieneObjetivos: false,
  haRegistradoComida: false,
  tieneRutinaInicial: false,
  haIniciadoEntreno: false,
  completada: false,
};

export function useActivationState() {
  const { user } = useAuth();
  const [estado, setEstado] = useState<EstadoActivacion>(ESTADO_INICIAL);
  const [cargando, setCargando] = useState(false);
  const [inicializado, setInicializado] = useState(false);

  const recargar = useCallback(async () => {
    if (!user?.id) {
      setInicializado(true);
      return;
    }
    setCargando(true);
    try {
      let next = await activacionService.obtenerEstado(user.id);

      // Auto-reparar: si el onboarding terminó pero la rutina inicial no se
      // creó (p.ej. fallo de red en el paso final), reintentamos aquí.
      // La RPC es idempotente, así que llamarla de más es seguro.
      if (next.tieneObjetivos && !next.tieneRutinaInicial) {
        const routineId = await activacionService.asegurarRutinaInicial(user.id);
        if (routineId) {
          next = { ...next, tieneRutinaInicial: true };
        }
      }

      setEstado((prev) => {
        if (!prev.haRegistradoComida && next.haRegistradoComida) {
          trackOnboardingEvent('first_meal_logged');
        }
        if (!prev.haIniciadoEntreno && next.haIniciadoEntreno) {
          trackOnboardingEvent('first_workout_started');
        }
        if (!prev.completada && next.completada) {
          trackOnboardingEvent('activation_completed');
        }
        return next;
      });
    } finally {
      setCargando(false);
      setInicializado(true);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void recargar();
    }, [recargar]),
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(NUTRICION_LOG_ACTUALIZADO, () => {
      void recargar();
    });
    return () => sub.remove();
  }, [recargar]);

  return { estado, cargando, inicializado, recargar };
}
