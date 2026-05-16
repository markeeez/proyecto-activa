/**
 * HOOK: useNutricion
 *
 * Carga el resumen del día (log + nutrition_log_meals con nombre/orden en BD).
 */

import { useAuth } from '@/hooks/useAuth';
import { fechaHoyIsoLocal } from '@/lib/fechaNutricion';
import { NUTRICION_LOG_ACTUALIZADO, type NutricionLogActualizadoPayload } from '@/lib/nutricionEvents';
import { alimentosService } from '@/services/alimentos.service';
import { nutricionService } from '@/services/nutricion.service';
import type {
  LineaCopiadaNutricion,
  ResumenDiarioNutricion,
  UltimaComidaAnteriorNutricion,
} from '@/types/app.types';
import type { Food, UserGoal } from '@/types/database.types';
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

  // Cache en memoria: días ya cargados → se muestran inmediatamente al volver a ellos.
  // Máximo 14 entradas (2 semanas) para evitar crecimiento indefinido de memoria.
  const CACHE_MAX = 14;
  const resumenCache = useRef<Map<string, ResumenDiarioNutricion>>(new Map());

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
      if (resumenDia) {
        if (resumenCache.current.size >= CACHE_MAX) {
          const oldest = resumenCache.current.keys().next().value;
          if (oldest) resumenCache.current.delete(oldest);
        }
        resumenCache.current.set(f, resumenDia);
      }
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
    // Mostrar datos cacheados del día inmediatamente si existen (stale-while-revalidate).
    // Si no hay caché, limpiar para no mostrar datos del día anterior.
    const cached = resumenCache.current.get(nueva);
    setResumen(cached ?? null);
    setFecha(nueva);
  }, []);

  const obtenerUltimaComidaAnterior = useCallback(
    async (nombreComida: string): Promise<UltimaComidaAnteriorNutricion | null> => {
      if (!user?.id) return null;
      return nutricionService.obtenerUltimaComidaAnterior(user.id, fechaRef.current, nombreComida);
    },
    [user?.id],
  );

  const copiarComidaAnteriorEnComida = useCallback(
    async (mealId: string, nombreComida: string): Promise<boolean> => {
      if (!user?.id) return false;
      const anterior = await nutricionService.obtenerUltimaComidaAnterior(
        user.id,
        fechaRef.current,
        nombreComida,
      );
      if (!anterior?.lineas.length) return false;
      await nutricionService.pegarAlimentosEnComida(mealId, anterior.lineas);
      await cargar();
      return true;
    },
    [cargar, user?.id],
  );

  return {
    resumen,
    objetivos,
    cargando,
    fecha,
    cambiarFecha,
    recargar: cargar,
    obtenerUltimaComidaAnterior,
    copiarComidaAnteriorEnComida,
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
    reemplazarAlimento: async (item: { id: string; meal_id: string }, food: Food, gramos: number) => {
      const foodReal = await alimentosService.asegurarFoodParaLog(food);
      await nutricionService.eliminarAlimentoDeComida(item.id);
      await nutricionService.añadirAlimentoAComida({
        mealId: item.meal_id,
        foodId: foodReal.id,
        gramos,
        food: {
          calorias: foodReal.calorias,
          proteinas: foodReal.proteinas,
          carbohidratos: foodReal.carbohidratos,
          grasas: foodReal.grasas,
        },
      });
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
    crearComidaPersonalizada: async (nombre: string): Promise<string | null> => {
      if (!user?.id) return null;
      const mealId = await nutricionService.crearComidaPersonalizada(user.id, fecha, nombre);
      await cargar();
      return mealId;
    },
    pegarAlimentosEnComida: async (mealId: string, lineas: LineaCopiadaNutricion[]) => {
      if (!lineas.length) return;
      await nutricionService.pegarAlimentosEnComida(mealId, lineas);
      await cargar();
    },
  };
}
