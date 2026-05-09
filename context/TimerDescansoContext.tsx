import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = '@timer_descanso';

export type ModoDescanso = 'fijo' | 'auto' | 'off';

export type PreferenciaDescanso = {
  modo: ModoDescanso;
  duracionSeg: number;
};

const DEFAULT: PreferenciaDescanso = { modo: 'fijo', duracionSeg: 90 };

type TimerDescansoContextValue = {
  preferencia: PreferenciaDescanso;
  setModo: (modo: ModoDescanso) => void;
  setDuracionSeg: (seg: number) => void;
  cargada: boolean;
};

const TimerDescansoContext = createContext<TimerDescansoContextValue | null>(null);

export function TimerDescansoProvider({ children }: { children: ReactNode }) {
  const [preferencia, setPreferencia] = useState<PreferenciaDescanso>(DEFAULT);
  const [cargada, setCargada] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<PreferenciaDescanso>;
          const modo =
            parsed.modo === 'fijo' || parsed.modo === 'auto' || parsed.modo === 'off'
              ? parsed.modo
              : DEFAULT.modo;
          const duracionSeg =
            typeof parsed.duracionSeg === 'number' && parsed.duracionSeg > 0
              ? parsed.duracionSeg
              : DEFAULT.duracionSeg;
          setPreferencia({ modo, duracionSeg });
        } catch {
          // ignorar JSON malformado
        }
      }
      setCargada(true);
    });
  }, []);

  const guardar = useCallback((next: PreferenciaDescanso) => {
    setPreferencia(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const setModo = useCallback(
    (modo: ModoDescanso) => guardar({ ...preferencia, modo }),
    [guardar, preferencia],
  );

  const setDuracionSeg = useCallback(
    (duracionSeg: number) => guardar({ ...preferencia, duracionSeg }),
    [guardar, preferencia],
  );

  return (
    <TimerDescansoContext.Provider value={{ preferencia, setModo, setDuracionSeg, cargada }}>
      {children}
    </TimerDescansoContext.Provider>
  );
}

export function useTimerDescansoContext(): TimerDescansoContextValue {
  const ctx = useContext(TimerDescansoContext);
  if (!ctx) throw new Error('useTimerDescansoContext must be used inside TimerDescansoProvider');
  return ctx;
}
