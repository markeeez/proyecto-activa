/**
 * HOOK: useNutricion
 *
 * Gestiona el log diario de nutrición del usuario.
 *
 * Retorna:
 *   - resumen: ResumenDiarioNutricion | null
 *   - objetivos: UserGoal | null
 *   - cargando: boolean
 *   - fecha: string (ISO date)
 *   - cambiarFecha: (fecha: string) => void
 *   - añadirAlimento: (mealId, foodId, gramos) => Promise<void>
 *   - eliminarAlimento: (itemId) => Promise<void>
 *
 * TODO: implementar con nutricionService
 * TODO: optimistic updates al añadir/eliminar alimentos
 */

import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { DeviceEventEmitter } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { fechaHoyIsoLocal } from '@/lib/fechaNutricion';
import { NUTRICION_LOG_ACTUALIZADO } from '@/lib/nutricionEvents';
import { nutricionService } from '@/services/nutricion.service';
import type { LineaCopiadaNutricion, ResumenDiarioNutricion } from '@/types/app.types';
import type { UserGoal } from '@/types/database.types';

export function useNutricion() {
  const { user } = useAuth();
  const [fecha, setFecha] = useState(fechaHoyIsoLocal);
  const [resumen, setResumen] = useState<ResumenDiarioNutricion | null>(null);
  const [objetivos, setObjetivos] = useState<UserGoal | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    if (!user?.id) return;
    setCargando(true);
    try {
      const [resumenDia, objetivosUsuario] = await Promise.all([
        nutricionService.obtenerOCrearLogDiario(user.id, fecha),
        nutricionService.obtenerObjetivos(user.id),
      ]);
      setResumen(resumenDia);
      setObjetivos(objetivosUsuario);
    } catch (e) {
      console.error('[useNutricion] cargar', e);
      setResumen(null);
    } finally {
      setCargando(false);
    }
  }, [user?.id, fecha]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(NUTRICION_LOG_ACTUALIZADO, () => {
      void cargar();
    });
    return () => sub.remove();
  }, [cargar]);

  return {
    resumen,
    objetivos,
    cargando,
    fecha,
    cambiarFecha: setFecha,
    recargar: cargar,
    añadirAlimento: async (mealId: string, foodId: string, gramos: number, food: { calorias: number; proteinas: number; carbohidratos: number; grasas: number }) => {
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
    crearComidaPersonalizada: async (logId: string, nombre: string) => {
      if (!user?.id) return;
      await nutricionService.crearTipoComidaPersonalizado(user.id, logId, nombre);
      await cargar();
    },
    pegarAlimentosEnComida: async (mealId: string, lineas: LineaCopiadaNutricion[]) => {
      if (!lineas.length) return;
      await nutricionService.pegarAlimentosEnComida(mealId, lineas);
      await cargar();
    },
  };
}
