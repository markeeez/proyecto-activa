/**
 * HOOK: useResumenMes
 *
 * Carga el resumen ligero de un mes (calorías por día) y devuelve un Map
 * fecha → calorías + un mapa fecha → estado (dentro / cerca / sobre / sinDatos)
 * usando los objetivos del usuario.
 *
 * Cache por (userId + mesKey) en memoria. Cuando el usuario cambia de mes en
 * el calendario, los meses ya vistos se muestran al instante mientras se
 * revalidan en background.
 */

import { useAuth } from '@/hooks/useAuth';
import { primerDiaMesIso, ultimoDiaMesIso } from '@/lib/fechaNutricion';
import { calcularEstadoDia, type EstadoDiaNutricion } from '@/lib/nutricionEstadoDia';
import { nutricionService } from '@/services/nutricion.service';
import type { UserGoal } from '@/types/database.types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const CACHE_MAX_MESES = 6;

function mesKey(año: number, mesIndex: number): string {
  return `${año}-${String(mesIndex + 1).padStart(2, '0')}`;
}

export function useResumenMes(
  año: number,
  mesIndex: number,
  objetivos: UserGoal | null,
) {
  const { user } = useAuth();
  const [caloriasPorFecha, setCaloriasPorFecha] = useState<Map<string, number>>(new Map());
  const [cargando, setCargando] = useState(false);

  const cache = useRef<Map<string, Map<string, number>>>(new Map());
  const peticionRef = useRef<string | null>(null);

  const cargar = useCallback(async () => {
    if (!user?.id) return;
    const key = mesKey(año, mesIndex);

    // Stale-while-revalidate: pinta cache si existe.
    const cached = cache.current.get(key);
    if (cached) setCaloriasPorFecha(cached);
    else setCaloriasPorFecha(new Map());

    setCargando(true);
    peticionRef.current = key;
    try {
      const desde = primerDiaMesIso(año, mesIndex);
      const hasta = ultimoDiaMesIso(año, mesIndex);
      const totales = await nutricionService.obtenerResumenMes(user.id, desde, hasta);

      // Si el mes pedido cambió mientras esta promesa estaba en vuelo, descartamos.
      if (peticionRef.current !== key) return;

      // LRU mínimo: si superamos el máximo, sacamos el más antiguo.
      if (cache.current.size >= CACHE_MAX_MESES && !cache.current.has(key)) {
        const oldest = cache.current.keys().next().value;
        if (oldest) cache.current.delete(oldest);
      }
      cache.current.set(key, totales);
      setCaloriasPorFecha(totales);
    } catch (e) {
      console.error('[useResumenMes] cargar', e);
    } finally {
      if (peticionRef.current === key) setCargando(false);
    }
  }, [user?.id, año, mesIndex]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /** Mapa fecha → estado, calculado a partir de calorías y objetivo. */
  const estadoPorFecha = useMemo(() => {
    const objetivoCal = objetivos?.calorias_objetivo ?? null;
    const out = new Map<string, EstadoDiaNutricion>();
    caloriasPorFecha.forEach((cal, fecha) => {
      out.set(fecha, calcularEstadoDia(cal, objetivoCal));
    });
    return out;
  }, [caloriasPorFecha, objetivos?.calorias_objetivo]);

  return {
    caloriasPorFecha,
    estadoPorFecha,
    cargando,
    recargar: cargar,
  };
}
