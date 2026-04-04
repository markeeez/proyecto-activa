/**
 * HOOK: useNutricion
 *
 * Carga el resumen del día (log + nutrition_log_meals con nombre/orden en BD).
 */

import { useAuth } from '@/hooks/useAuth';
import { fechaHoyIsoLocal } from '@/lib/fechaNutricion';
import { NUTRICION_LOG_ACTUALIZADO, type NutricionLogActualizadoPayload } from '@/lib/nutricionEvents';
import { nutricionService } from '@/services/nutricion.service';
import type { LineaCopiadaNutricion, ResumenDiarioNutricion } from '@/types/app.types';
import type { UserGoal } from '@/types/database.types';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';

export function useNutricion() {
  const { user } = useAuth();
  const [fecha, setFecha] = useState(fechaHoyIsoLocal);
  const [resumen, setResumen] = useState<ResumenDiarioNutricion | null>(null);
  const [objetivos, setObjetivos] = useState<UserGoal | null>(null);
  const [cargando, setCargando] = useState(false);
  const fechaRef = useRef(fecha);

  useEffect(() => {
    fechaRef.current = fecha;
  }, [fecha]);

  const cargar = useCallback(async () => {
    if (!user?.id) return;
    setCargando(true);
    try {
      const f = fechaRef.current;
      const [resumenDia, objetivosUsuario] = await Promise.all([
        nutricionService.obtenerResumenDiaNutricion(user.id, f),
        nutricionService.obtenerObjetivos(user.id),
      ]);
      if (f !== fechaRef.current) return;
      setResumen(resumenDia);
      setObjetivos(objetivosUsuario);
    } catch (e) {
      console.error('[useNutricion] cargar', e);
      setResumen(null);
    } finally {
      setCargando(false);
    }
  }, [user?.id]);

  /** useFocusEffect no se dispara al solo cambiar de día en el calendario: hay que recargar aquí. */
  useEffect(() => {
    if (!user?.id) return;
    void cargar();
  }, [fecha, user?.id, cargar]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      NUTRICION_LOG_ACTUALIZADO,
      (payload: NutricionLogActualizadoPayload) => {
        if (payload?.fechaLog && payload.fechaLog !== fechaRef.current) return;
        void cargar();
      },
    );
    return () => sub.remove();
  }, [cargar]);

  const cambiarFecha = useCallback((nueva: string) => {
    setFecha(nueva);
  }, []);

  return {
    resumen,
    objetivos,
    cargando,
    fecha,
    cambiarFecha,
    recargar: cargar,
    añadirAlimento: async (
      mealId: string,
      foodId: string,
      gramos: number,
      food: { calorias: number; proteinas: number; carbohidratos: number; grasas: number },
    ) => {
      await nutricionService.añadirAlimentoAComida({ mealId, foodId, gramos, food });
      await cargar();
    },
    eliminarAlimento: async (itemId: string) => {
      await nutricionService.eliminarAlimentoDeComida(itemId);
      await cargar();
    },
    vaciarComida: async (mealId: string) => {
      await nutricionService.vaciarComida(mealId);
      await cargar();
    },
    eliminarComidaDelLog: async (logId: string, mealId: string) => {
      await nutricionService.eliminarComidaDelLog(logId, mealId);
      await cargar();
    },
    crearComidaPersonalizada: async (nombre: string) => {
      if (!user?.id) return;
      await nutricionService.crearComidaPersonalizada(user.id, fecha, nombre);
      await cargar();
    },
    pegarAlimentosEnComida: async (mealId: string, lineas: LineaCopiadaNutricion[]) => {
      if (!lineas.length) return;
      await nutricionService.pegarAlimentosEnComida(mealId, lineas);
      await cargar();
    },
  };
}
