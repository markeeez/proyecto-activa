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
import { useAuth } from '@/hooks/useAuth';
import { nutricionService } from '@/services/nutricion.service';
import type { ResumenDiarioNutricion } from '@/types/app.types';
import type { UserGoal } from '@/types/database.types';

export function useNutricion() {
  const { user } = useAuth();
  const [fecha, setFecha] = useState(
    new Date().toISOString().split('T')[0]
  );
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
    } finally {
      setCargando(false);
    }
  }, [user?.id, fecha]);

  useEffect(() => {
    cargar();
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
  };
}
