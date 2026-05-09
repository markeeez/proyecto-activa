/**
 * Estado global del entreno activo: sesión, cronómetro (tick), borrador en pantalla y minimizado.
 * Un solo entreno activo por usuario (un único objeto en contexto).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { router } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { tipoSerieDbAUi } from '@/lib/entrenamientoSerie';
import { lid, registroCardioPorDefecto, seriePorDefecto } from '@/lib/entrenamientoUtils';
import type { BorradorEjercicioLinea, BorradorSerieLinea } from '@/types/entrenamientoBorrador.types';
import type { TipoSerie, TrackingMode } from '@/types/database.types';
import {
  entrenamientoService,
  type EjercicioBorrador,
  type UltimaSesionRutina,
} from '@/services/entrenamiento.service';

/** Plantilla original al iniciar desde rutina (para detectar cambios estructurales al terminar). */
export type SnapshotRutina = {
  ejercicios: {
    exercise_id: string;
    orden: number;
    sets: {
      numero_serie: number;
      tipo_serie: string;
      reps: number | null;
      peso_kg: number | null;
      tipo_peso: string;
      duracion_seg?: number | null;
      distancia_km?: number | null;
    }[];
  }[];
};

function snapshotRutinaDesdeCargados(cargados: EjercicioBorrador[]): SnapshotRutina {
  return {
    ejercicios: cargados.map((ej) => ({
      exercise_id: ej.exercise_id,
      orden: ej.orden,
      sets: ej.sets.map((s) => ({
        numero_serie: s.numero_serie,
        tipo_serie: s.tipo_serie,
        reps: s.repeticiones,
        peso_kg: s.peso_kg,
        tipo_peso: s.tipo_peso,
        duracion_seg: s.duracion_seg ?? null,
        distancia_km: s.distancia_km ?? null,
      })),
    })),
  };
}

function esCardio(trackingMode: TrackingMode | null | undefined): boolean {
  return trackingMode === 'cardio_time' || trackingMode === 'cardio_time_distance';
}

function formatearDuracionInput(seg: number | null | undefined): string {
  if (seg == null || !Number.isFinite(Number(seg)) || Number(seg) <= 0) return '';
  return String(Math.round(Number(seg) / 60));
}

function mapCargadoALineaDesdeUltima(ej: EjercicioBorrador, ultima: UltimaSesionRutina | null): BorradorEjercicioLinea {
  if (esCardio(ej.tracking_mode)) {
    return {
      lineId: lid(),
      exerciseId: ej.exercise_id,
      orden: ej.orden,
      nombre: ej.nombre,
      musculo_primario: ej.musculo_primario,
      tracking_mode: ej.tracking_mode,
      sets: [
        {
          ...registroCardioPorDefecto(),
          duracionSeg: formatearDuracionInput(ej.sets[0]?.duracion_seg),
          distanciaKm: ej.sets[0]?.distancia_km != null ? String(ej.sets[0]!.distancia_km) : '',
        },
      ],
    };
  }

  const sets: BorradorSerieLinea[] =
    ej.sets.length > 0
      ? ej.sets.map((s) => {
          let kg = s.peso_kg != null ? String(s.peso_kg) : '';
          let reps = s.repeticiones != null ? String(s.repeticiones) : '';
          if (ultima) {
            const block = ultima.ejercicios.find(
              (e) => e.exercise_id === ej.exercise_id && e.orden === ej.orden,
            );
            const prev = block?.sets.find((st) => st.numero_serie === s.numero_serie);
            if (prev) {
              kg = prev.peso_kg != null ? String(prev.peso_kg) : '';
              reps = prev.repeticiones != null ? String(prev.repeticiones) : '';
            } else {
              kg = '';
              reps = '';
            }
          }
          return {
            setId: lid(),
            tipoUi: tipoSerieDbAUi(s.tipo_serie),
            kg,
            reps,
            rir: '',
            completada: false,
          };
        })
      : [seriePorDefecto()];

  return {
    lineId: lid(),
    exerciseId: ej.exercise_id,
    orden: ej.orden,
    nombre: ej.nombre,
    musculo_primario: ej.musculo_primario,
    tracking_mode: ej.tracking_mode,
    sets,
  };
}

type WseRecuperacionRow = {
  orden: number;
  exercise_id: string;
  exercises:
    | { nombre: string; musculo_primario: string; tracking_mode: TrackingMode | null }
    | { nombre: string; musculo_primario: string; tracking_mode: TrackingMode | null }[]
    | null;
  workout_sets:
    | {
        numero_serie: number;
        tipo_serie: TipoSerie;
        peso_kg: number | null;
        repeticiones: number | null;
        rir: number | null;
        tipo_peso: string;
        duracion_seg: number | null;
        distancia_km: number | null;
        completada: boolean;
      }[]
    | null;
};

type SessionRecuperacionRow = {
  id: string;
  nombre: string | null;
  routine_id: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  workout_session_exercises: WseRecuperacionRow[] | null;
};

function mapWseRecuperadoALinea(wse: WseRecuperacionRow): BorradorEjercicioLinea {
  const exRaw = wse.exercises;
  const exOne = Array.isArray(exRaw) ? exRaw[0] : exRaw;
  const nombre = exOne?.nombre?.trim() ?? 'Ejercicio';
  const musculo = exOne?.musculo_primario?.trim() ?? '';
  const tracking_mode =
    exOne?.tracking_mode === 'cardio_time' || exOne?.tracking_mode === 'cardio_time_distance'
      ? exOne.tracking_mode
      : 'strength';
  const sorted = (wse.workout_sets ?? []).slice().sort((a, b) => a.numero_serie - b.numero_serie);
  const sets: BorradorSerieLinea[] =
    esCardio(tracking_mode)
      ? [
          {
            ...registroCardioPorDefecto(),
            duracionSeg: formatearDuracionInput(sorted[0]?.duracion_seg),
            distanciaKm: sorted[0]?.distancia_km != null ? String(sorted[0].distancia_km) : '',
            completada: Boolean(sorted[0]?.completada),
          },
        ]
      : sorted.length > 0
      ? sorted.map((st) => ({
          setId: lid(),
          tipoUi: tipoSerieDbAUi(st.tipo_serie),
          kg: st.peso_kg != null ? String(st.peso_kg) : '',
          reps: st.repeticiones != null ? String(st.repeticiones) : '',
          rir: st.rir != null ? String(st.rir) : '',
          completada: st.completada,
        }))
      : [seriePorDefecto()];
  return {
    lineId: lid(),
    exerciseId: wse.exercise_id,
    orden: wse.orden,
    nombre,
    musculo_primario: musculo,
    tracking_mode,
    sets,
  };
}

export type EntrenoActivo = {
  sessionId: string;
  nombre: string;
  routineId: string | null;
  horaInicioMs: number;
  minimizado: boolean;
  lineas: BorradorEjercicioLinea[];
  snapshotRutina: SnapshotRutina | null;
  ultimaSesionRutina: UltimaSesionRutina | null;
};

type EntrenoContextValue = {
  entrenoActivo: EntrenoActivo | null;
  /** Segundos desde horaInicioMs; se actualiza cada segundo mientras hay entreno */
  segundosTranscurridos: number;
  iniciarEntrenoVacio: (nombre: string) => Promise<void>;
  iniciarDesdeRutina: (routineId: string, nombreRutina: string) => Promise<void>;
  minimizar: () => void;
  maximizar: () => void;
  /** Marca hora_fin en BD y limpia el contexto (tras guardar series en pantalla). */
  terminarEntreno: () => Promise<void>;
  /** Elimina la sesión en BD y limpia el contexto. */
  descartarEntreno: () => Promise<void>;
  /** Restaura entrenoActivo desde BD y navega a entreno-activo (sesión sin hora_fin). */
  recuperarEntreno: (sessionId: string) => Promise<void>;
  setLineas: (next: BorradorEjercicioLinea[] | ((prev: BorradorEjercicioLinea[]) => BorradorEjercicioLinea[])) => void;
  actualizarLinea: (lineId: string, next: BorradorEjercicioLinea) => void;
};

const EntrenoContext = createContext<EntrenoContextValue | null>(null);

function formatearDuracion(totalSeg: number): string {
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function EntrenoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isDark } = useThemeMode();
  const [entreno, setEntreno] = useState<EntrenoActivo | null>(null);
  const [tick, setTick] = useState(0);
  const entrenoRef = useRef(entreno);
  entrenoRef.current = entreno;
  const [sesionHuerfana, setSesionHuerfana] = useState<{ id: string; nombre: string } | null>(null);
  const [accionando, setAccionando] = useState(false);

  useEffect(() => {
    if (!entreno) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [entreno?.sessionId]);

  useEffect(() => {
    if (!user?.id || entreno) return;
    (async () => {
      const { data } = await supabase
        .from('workout_sessions')
        .select('id, nombre')
        .eq('user_id', user.id)
        .is('hora_fin', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setSesionHuerfana({ id: data.id, nombre: (data.nombre ?? 'Entreno').trim() || 'Entreno' });
    })();
  }, [user?.id]);

  const segundosTranscurridos = useMemo(() => {
    if (!entreno) return 0;
    return Math.max(0, Math.floor((Date.now() - entreno.horaInicioMs) / 1000));
  }, [entreno?.horaInicioMs, entreno?.sessionId, tick]);

  const iniciarEntrenoVacio = useCallback(
    async (nombre: string) => {
      if (!user?.id) return;
      const sessionId = await entrenamientoService.crearWorkoutSession(user.id, nombre.trim() || 'Entreno', null);
      const horaInicioMs = Date.now();
      setEntreno({
        sessionId,
        nombre: nombre.trim() || 'Entreno',
        routineId: null,
        horaInicioMs,
        minimizado: false,
        lineas: [],
        snapshotRutina: null,
        ultimaSesionRutina: null,
      });
    },
    [user?.id],
  );

  const iniciarDesdeRutina = useCallback(
    async (routineId: string, nombreRutina: string) => {
      if (!user?.id) return;
      const cargados = await entrenamientoService.cargarEjerciciosDesdeRutina(routineId);
      const ultimaSesionRutina = await entrenamientoService.obtenerUltimaSesionRutina(user.id, routineId);
      const snapshotRutina = snapshotRutinaDesdeCargados(cargados);
      const sessionId = await entrenamientoService.crearWorkoutSession(
        user.id,
        nombreRutina.trim() || 'Entreno',
        routineId,
      );
      const lineas = cargados.map((ej) => mapCargadoALineaDesdeUltima(ej, ultimaSesionRutina));
      setEntreno({
        sessionId,
        nombre: nombreRutina.trim() || 'Entreno',
        routineId,
        horaInicioMs: Date.now(),
        minimizado: false,
        lineas,
        snapshotRutina,
        ultimaSesionRutina,
      });
    },
    [user?.id],
  );

  const minimizar = useCallback(() => {
    setEntreno((e) => (e ? { ...e, minimizado: true } : e));
  }, []);

  const maximizar = useCallback(() => {
    setEntreno((e) => (e ? { ...e, minimizado: false } : e));
  }, []);

  const terminarEntreno = useCallback(async () => {
    const id = entrenoRef.current?.sessionId;
    if (!id) return;
    await entrenamientoService.marcarHoraFinWorkoutSession(id);
    setEntreno(null);
  }, []);

  const descartarEntreno = useCallback(async () => {
    const id = entrenoRef.current?.sessionId;
    if (!id) {
      setEntreno(null);
      return;
    }
    await entrenamientoService.descartarWorkoutSession(id);
    setEntreno(null);
  }, []);

  const recuperarEntreno = useCallback(async (sessionId: string) => {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select(
        `id, nombre, routine_id, hora_inicio, hora_fin,
        workout_session_exercises (
          orden, exercise_id,
          exercises ( nombre, musculo_primario, tracking_mode ),
          workout_sets ( numero_serie, tipo_serie, peso_kg, repeticiones, rir, tipo_peso, duracion_seg, distancia_km, completada )
        )`,
      )
      .eq('id', sessionId)
      .maybeSingle();

    if (error || !data) {
      console.error('[recuperarEntreno]', error?.message ?? 'sin datos');
      return;
    }

    const row = data as SessionRecuperacionRow;
    const wseList = (row.workout_session_exercises ?? []).slice().sort((a, b) => a.orden - b.orden);
    const lineas = wseList.map(mapWseRecuperadoALinea);
    const horaInicioMs = row.hora_inicio ? new Date(row.hora_inicio).getTime() : Date.now();

    setEntreno({
      sessionId: row.id,
      nombre: (row.nombre ?? 'Entreno').trim() || 'Entreno',
      routineId: row.routine_id,
      horaInicioMs,
      minimizado: false,
      lineas,
      snapshotRutina: null,
      ultimaSesionRutina: null,
    });

    router.push('/(tabs)/(entrenamiento)/entreno-activo');
  }, []);

  const setLineas = useCallback(
    (next: BorradorEjercicioLinea[] | ((prev: BorradorEjercicioLinea[]) => BorradorEjercicioLinea[])) => {
      setEntreno((e) => {
        if (!e) return e;
        const lineas = typeof next === 'function' ? next(e.lineas) : next;
        return { ...e, lineas };
      });
    },
    [],
  );

  const actualizarLinea = useCallback((lineId: string, next: BorradorEjercicioLinea) => {
    setEntreno((e) => {
      if (!e) return e;
      return { ...e, lineas: e.lineas.map((l) => (l.lineId === lineId ? next : l)) };
    });
  }, []);

  const value = useMemo<EntrenoContextValue>(
    () => ({
      entrenoActivo: entreno,
      segundosTranscurridos,
      iniciarEntrenoVacio,
      iniciarDesdeRutina,
      minimizar,
      maximizar,
      terminarEntreno,
      descartarEntreno,
      recuperarEntreno,
      setLineas,
      actualizarLinea,
    }),
    [
      entreno,
      segundosTranscurridos,
      iniciarEntrenoVacio,
      iniciarDesdeRutina,
      minimizar,
      maximizar,
      terminarEntreno,
      descartarEntreno,
      recuperarEntreno,
      setLineas,
      actualizarLinea,
    ],
  );

  return (
    <EntrenoContext.Provider value={value}>
      {children}
      <Modal
        visible={sesionHuerfana != null}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={[em.backdrop, { backgroundColor: isDark ? 'rgba(0,0,0,0.68)' : 'rgba(0,0,0,0.32)' }]}>
          <View style={[em.card, { backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF', borderColor: isDark ? '#2A2A2A' : '#D8D8D8' }]}>
            <View style={em.accentBar} />
            <Text style={[em.titulo, { color: isDark ? '#FFFFFF' : '#0F0F0F' }]}>Entreno sin terminar</Text>
            <Text style={[em.cuerpo, { color: isDark ? '#888888' : '#666666' }]}>
              Tienes un entreno sin finalizar:{'\n'}
              <Text style={[em.nombre, { color: isDark ? '#FFFFFF' : '#0F0F0F' }]}>{sesionHuerfana?.nombre}</Text>
            </Text>
            <View style={em.acciones}>
              <Pressable
                style={[em.btnPrimario, accionando && em.btnDesactivado]}
                disabled={accionando}
                onPress={async () => {
                  if (!sesionHuerfana) return;
                  setAccionando(true);
                  try {
                    await recuperarEntreno(sesionHuerfana.id);
                    setSesionHuerfana(null);
                  } finally {
                    setAccionando(false);
                  }
                }}
              >
                <Text style={em.btnPrimarioTxt}>CONTINUAR ENTRENO</Text>
              </Pressable>
              <Pressable
                style={[em.btnPeligro, accionando && em.btnDesactivado, { borderColor: isDark ? '#D71921' : '#D71921' }]}
                disabled={accionando}
                onPress={async () => {
                  if (!sesionHuerfana) return;
                  setAccionando(true);
                  try {
                    await entrenamientoService.descartarSesionHuerfana(sesionHuerfana.id);
                    setSesionHuerfana(null);
                  } finally {
                    setAccionando(false);
                  }
                }}
              >
                <Text style={[em.btnPeligroTxt, { color: isDark ? '#F08080' : '#B00020' }]}>DESCARTAR</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </EntrenoContext.Provider>
  );
}

export function useEntreno(): EntrenoContextValue {
  const ctx = useContext(EntrenoContext);
  if (!ctx) {
    throw new Error('useEntreno debe usarse dentro de EntrenoProvider');
  }
  return ctx;
}

/** Duración legible para headers / barra (depende del tick del provider). */
export function useEntrenoDuracionTexto(): string {
  const { segundosTranscurridos, entrenoActivo } = useEntreno();
  if (!entrenoActivo) return '0:00';
  return formatearDuracion(segundosTranscurridos);
}

const em = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#00D4FF',
  },
  titulo: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    lineHeight: 23,
    marginTop: 8,
    marginBottom: 8,
  },
  cuerpo: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  nombre: {
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  acciones: {
    gap: 8,
  },
  btnPrimario: {
    minHeight: 42,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D4FF',
  },
  btnPrimarioTxt: {
    fontFamily: 'SpaceMono_700Bold',
    color: '#001015',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0,
  },
  btnPeligro: {
    minHeight: 42,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPeligroTxt: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0,
  },
  btnDesactivado: {
    opacity: 0.5,
  },
});
