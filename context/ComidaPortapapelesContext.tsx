import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { AlimentoEnLog, LineaCopiadaNutricion } from '@/types/app.types';

export type LineaCopiada = LineaCopiadaNutricion;

function itemsALineas(items: AlimentoEnLog[]): LineaCopiada[] {
  return items.map((i) => {
    const factor = i.gramos > 0 ? i.gramos / 100 : 1;
    return {
      foodId: i.food_id,
      gramos: i.gramos,
      food: {
        calorias: i.calorias_calculadas / factor,
        proteinas: i.proteinas_calculadas / factor,
        carbohidratos: i.carbos_calculados / factor,
        grasas: i.grasas_calculadas / factor,
      },
    };
  });
}

type Ctx = {
  lineas: LineaCopiada[] | null;
  copiarDesdeComida: (items: AlimentoEnLog[]) => void;
  limpiarPortapapeles: () => void;
  tieneCopia: boolean;
};

const ComidaPortapapelesContext = createContext<Ctx | null>(null);

export function ComidaPortapapelesProvider({ children }: { children: React.ReactNode }) {
  const [lineas, setLineas] = useState<LineaCopiada[] | null>(null);

  const copiarDesdeComida = useCallback((items: AlimentoEnLog[]) => {
    if (!items.length) {
      setLineas(null);
      return;
    }
    setLineas(itemsALineas(items));
  }, []);

  const limpiarPortapapeles = useCallback(() => setLineas(null), []);

  const value = useMemo(
    () => ({
      lineas,
      copiarDesdeComida,
      limpiarPortapapeles,
      tieneCopia: (lineas?.length ?? 0) > 0,
    }),
    [lineas, copiarDesdeComida, limpiarPortapapeles],
  );

  return (
    <ComidaPortapapelesContext.Provider value={value}>{children}</ComidaPortapapelesContext.Provider>
  );
}

export function useComidaPortapapeles() {
  const ctx = useContext(ComidaPortapapelesContext);
  if (!ctx) {
    throw new Error('useComidaPortapapeles debe usarse dentro de ComidaPortapapelesProvider');
  }
  return ctx;
}
