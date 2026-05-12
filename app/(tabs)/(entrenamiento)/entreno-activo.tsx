/**
 * Pantalla del entreno en curso: borrador en contexto, series completadas, terminar / minimizar.
 */

import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgregarEjercicioSheet } from '@/components/entrenamiento/AgregarEjercicioSheet';
import { ChipCronometrando } from '@/components/entrenamiento/ChipCronometrando';
import { CrearEjercicioModal } from '@/components/entrenamiento/CrearEjercicioModal';
import { EjercicioRutinaCard } from '@/components/entrenamiento/EjercicioRutinaCard';
import { TimerDescansoInline } from '@/components/entrenamiento/TimerDescansoInline';
import { GlowButton } from '@/components/ui/GlowButton';
import type { Theme } from '@/constants/theme';
import { useEntreno, useEntrenoDuracionTexto, type SnapshotRutina } from '@/context/EntrenoContext';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { tipoSerieUiADb } from '@/lib/entrenamientoSerie';
import {
  buildRecordBaselineMap,
  calcularRecordFlagsPorLinea,
  type RecordBaselineMap,
} from '@/lib/entrenamientoRecords';
import { lid, registroCardioPorDefecto, seriePorDefecto } from '@/lib/entrenamientoUtils';
import { ejerciciosService } from '@/services/ejercicios.service';
import {
  entrenamientoService,
  type BorradorEjercicioRutina,
  type EntrenoEjercicioPersistido,
  type UltimaSesionRutina,
} from '@/services/entrenamiento.service';
import type { Exercise, TrackingMode } from '@/types/database.types';
import type { BorradorEjercicioLinea } from '@/types/entrenamientoBorrador.types';
import { useTimerDescanso } from '@/hooks/useTimerDescanso';


function parseOptFloat(s: string): number | null {
  const t = s.trim().replace(/,/g, '.');
  if (!t || t === '—') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseOptInt(s: string): number | null {
  const t = s.trim();
  if (!t || t === '—') return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

function esCardio(trackingMode: TrackingMode | null | undefined): boolean {
  return trackingMode === 'cardio_time' || trackingMode === 'cardio_time_distance';
}

function parseDuracionMinASeg(s: string | undefined): number | null {
  const t = (s ?? '').trim();
  if (!/^\d+$/.test(t)) return null;
  const minutosEnteros = parseInt(t, 10);
  if (Number.isFinite(minutosEnteros) && minutosEnteros > 0) return minutosEnteros * 60;
  if (!t || t === '—' || t === 'â€”') return null;
  if (t.includes(':')) {
    const parts = t.split(':').map((p) => parseInt(p, 10));
    if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
    if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
    if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
    return null;
  }
  const min = Number(t);
  return Number.isFinite(min) && min > 0 ? Math.round(min * 60) : null;
}

function formatearDuracionCardio(seg: number | null | undefined): string {
  if (seg == null || !Number.isFinite(Number(seg)) || Number(seg) <= 0) return '—';
  const total = Math.round(Number(seg));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function textoAnteriorCardio(duracionSeg: number | null | undefined, distanciaKm: number | null | undefined): string {
  const tiempo = formatearDuracionCardio(duracionSeg);
  if (distanciaKm != null && Number.isFinite(Number(distanciaKm)) && Number(distanciaKm) > 0) {
    return `${tiempo} · ${Number(distanciaKm).toLocaleString('es-ES', { maximumFractionDigits: 2 })} km`;
  }
  return tiempo;
}

function lineasAPersistido(lineas: BorradorEjercicioLinea[]): EntrenoEjercicioPersistido[] {
  const out: EntrenoEjercicioPersistido[] = [];
  let ordenEj = 1;
  for (const line of lineas) {
    if (esCardio(line.tracking_mode)) {
      const registro = line.sets[0];
      if (!registro?.completada) continue;
      const duracion_seg = parseDuracionMinASeg(registro.duracionSeg);
      if (duracion_seg == null) continue;
      out.push({
        exercise_id: line.exerciseId,
        orden: ordenEj++,
        notas: (line.nota ?? '').trim() || null,
        sets: [{
          numero_serie: 1,
          tipo_serie: 'lineal',
          repeticiones: null,
          rir: null,
          peso_kg: null,
          tipo_peso: 'bodyweight',
          duracion_seg,
          distancia_km: line.tracking_mode === 'cardio_time_distance' ? parseOptFloat(registro.distanciaKm ?? '') : null,
          descanso_seg: null,
        }],
      });
      continue;
    }
    const setsComp = line.sets.filter((s) => s.completada);
    if (!setsComp.length) continue;
    out.push({
      exercise_id: line.exerciseId,
      orden: ordenEj++,
      notas: (line.nota ?? '').trim() || null,
      sets: setsComp.map((s, i) => {
        const pesoKg = parseOptFloat(s.kg);
        let descanso_seg: number | null = null;
        if (i > 0) {
          const prev = setsComp[i - 1];
          if (prev?.completada_at && s.completada_at) {
            descanso_seg = Math.round((s.completada_at - prev.completada_at) / 1000);
          }
        }
        return {
          numero_serie: i + 1,
          tipo_serie: tipoSerieUiADb(s.tipoUi),
          repeticiones: parseOptInt(s.reps),
          rir: parseOptInt(s.rir ?? ''),
          peso_kg: pesoKg,
          tipo_peso: pesoKg === null ? 'bodyweight' : 'kg',
          descanso_seg,
        };
      }),
    });
  }
  return out;
}

function lineasARutinaSoloCompletadas(lineas: BorradorEjercicioLinea[]): BorradorEjercicioRutina[] {
  const out: BorradorEjercicioRutina[] = [];
  let orden = 1;
  for (const line of lineas) {
    if (esCardio(line.tracking_mode)) {
      const registro = line.sets[0];
      if (!registro?.completada) continue;
      out.push({
        exercise_id: line.exerciseId,
        orden: orden++,
        sets: [{
          numero_serie: 1,
          tipo_serie: 'lineal',
          repeticiones: null,
          peso_kg: null,
          tipo_peso: 'bodyweight',
          duracion_seg: parseDuracionMinASeg(registro.duracionSeg),
          distancia_km: line.tracking_mode === 'cardio_time_distance' ? parseOptFloat(registro.distanciaKm ?? '') : null,
        }],
      });
      continue;
    }
    const setsComp = line.sets.filter((s) => s.completada);
    if (!setsComp.length) continue;
    out.push({
      exercise_id: line.exerciseId,
      orden: orden++,
      sets: setsComp.map((s, i) => {
        const pesoKg = parseOptFloat(s.kg);
        return {
          numero_serie: i + 1,
          tipo_serie: tipoSerieUiADb(s.tipoUi),
          repeticiones: parseOptInt(s.reps),
          peso_kg: pesoKg,
          tipo_peso: pesoKg === null ? 'bodyweight' : 'kg',
        };
      }),
    });
  }
  return out;
}

function lineasARutinaCompleta(lineas: BorradorEjercicioLinea[]): BorradorEjercicioRutina[] {
  return lineas.map((line, idx) => ({
    exercise_id: line.exerciseId,
    orden: idx + 1,
    sets: esCardio(line.tracking_mode)
      ? [{
          numero_serie: 1,
          tipo_serie: 'lineal',
          repeticiones: null,
          peso_kg: null,
          tipo_peso: 'bodyweight',
          duracion_seg: parseDuracionMinASeg(line.sets[0]?.duracionSeg),
          distancia_km: line.tracking_mode === 'cardio_time_distance' ? parseOptFloat(line.sets[0]?.distanciaKm ?? '') : null,
        }]
      : line.sets.map((s, i) => ({
          numero_serie: i + 1,
          tipo_serie: tipoSerieUiADb(s.tipoUi),
          repeticiones: parseOptInt(s.reps),
          peso_kg: parseOptFloat(s.kg),
          tipo_peso: 'kg',
        })),
  }));
}

/** Compara borrador vs plantilla original: ejercicios, orden y tipo de serie (no kg/reps/tiempos). */
function haycambiosEstructurales(lineas: BorradorEjercicioLinea[], snapshot: SnapshotRutina): boolean {
  if (lineas.length !== snapshot.ejercicios.length) return true;
  for (let i = 0; i < lineas.length; i++) {
    const L = lineas[i]!;
    const S = snapshot.ejercicios[i]!;
    if (L.exerciseId !== S.exercise_id) return true;
    if (L.sets.length !== S.sets.length) return true;
    for (let j = 0; j < L.sets.length; j++) {
      if (tipoSerieUiADb(L.sets[j]!.tipoUi) !== S.sets[j]!.tipo_serie) return true;
    }
  }
  return false;
}

function textoAnteriorDesdeValores(
  peso_kg: number | null,
  repeticiones: number | null,
  tipo_peso: string,
): string {
  const r = repeticiones != null ? String(repeticiones) : '—';
  if (tipo_peso === 'bodyweight') return `BW × ${r}`;
  if (tipo_peso === 'assisted') return `Asist. × ${r}`;
  const p = peso_kg != null ? `${peso_kg}kg` : '—';
  return `${p} × ${r}`;
}

function textosAnteriorPorLinea(
  line: BorradorEjercicioLinea,
  ultima: UltimaSesionRutina | null,
  anteriorGlobalPorExercise: Record<string, string>,
): (string | null)[] {
  if (ultima) {
    const block =
      line.orden != null
        ? ultima.ejercicios.find((e) => e.exercise_id === line.exerciseId && e.orden === line.orden)
        : ultima.ejercicios.find((e) => e.exercise_id === line.exerciseId);

    if (block) {
      if (esCardio(line.tracking_mode)) {
        const st = block.sets[0];
        return [st ? textoAnteriorCardio(st.duracion_seg, st.distancia_km) : null];
      }
      return line.sets.map((_, j) => {
        const st = block.sets.find((s) => s.numero_serie === j + 1);
        if (!st) return null;
        return textoAnteriorDesdeValores(st.peso_kg, st.repeticiones, st.tipo_peso);
      });
    }
    // Exercise not in ultimaSesionRutina (e.g. added mid-workout): fall through to global
  }
  const g = anteriorGlobalPorExercise[line.exerciseId];
  return line.sets.map(() => (g ?? null));
}

function makeStyles(c: Theme, f: ReturnType<typeof useTheme>['f'], ts: ReturnType<typeof useTheme>['ts'], s: ReturnType<typeof useTheme>['s'], r: ReturnType<typeof useTheme>['r']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      gap: s.xs,
    },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, minWidth: 0, alignItems: 'center' },
    headerTitle: { ...ts.bodySm, fontFamily: f.sansMedium, color: c.textDisplay },
    cron: { ...ts.caption, fontFamily: f.mono, color: c.textSecondary },
    terminarBtn: {
      paddingHorizontal: s.sm,
      paddingVertical: s.xs,
      borderRadius: r.technical,
      backgroundColor: c.primary,
    },
    terminarTxt: { ...ts.caption, fontFamily: f.sansMedium, color: c.textOnPrimary },
    body: { flex: 1, paddingHorizontal: s.md },
    scrollContent: { paddingTop: s.md, paddingBottom: s.xl },
    footerBtn: {
      paddingVertical: s.md,
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: c.border,
      marginHorizontal: -s.md,
      paddingHorizontal: s.md,
    },
    footerBtnTimer: {
      paddingVertical: 0,
      paddingHorizontal: 0,
      marginHorizontal: 0,
      borderTopWidth: 0,
    },
    footerGlowWrap: {
      width: '100%',
      maxWidth: 360,
      alignSelf: 'center',
      marginBottom: -30
    },
    footerGlowPressable: {
      minHeight: 46,
      borderRadius: r.sm,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: s.md,
      backgroundColor: c.primary,
    },
    footerBtnText: { ...ts.label, fontFamily: f.mono, color: c.textOnPrimary, letterSpacing: 0.7 },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.68)',
      justifyContent: 'center',
      padding: s.lg,
    },
    modalCard: {
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.borderVisible,
      paddingHorizontal: s.md,
      paddingTop: s.lg,
      paddingBottom: s.md,
      overflow: 'hidden',
    },
    modalAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: c.primary,
    },
    modalTitle: {
      ...ts.subheading,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      marginBottom: s.sm,
      letterSpacing: 0,
    },
    modalBody: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textSecondary,
      marginBottom: s.lg,
      lineHeight: 25,
    },
    modalRow: { flexDirection: 'row', gap: s.sm, justifyContent: 'flex-end', flexWrap: 'wrap' },
    modalBtn: {
      paddingVertical: s.sm,
      paddingHorizontal: s.md,
      borderRadius: r.technical,
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    modalBtnPrimary: { backgroundColor: c.primary, borderColor: c.primary },
    modalBtnTxt: { ...ts.bodySm, fontFamily: f.sans, color: c.textDisplay },
    modalBtnTxtOn: { color: c.textOnPrimary, fontFamily: f.sansMedium },
    modalInput: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.sm,
      backgroundColor: c.surfaceElevated,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
      marginBottom: s.lg,
    },
    modalIncompletasColumn: {
      flexDirection: 'column',
      gap: s.sm,
    },
    modalAction: {
      minHeight: 48,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: s.md,
    },
    modalActionPrimary: {
      minHeight: 48,
      borderRadius: r.sm,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: s.md,
      backgroundColor: c.primary,
    },
    modalActionDanger: {
      borderColor: c.danger,
      backgroundColor: c.surface,
    },
    modalActionText: {
      ...ts.body,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      textAlign: 'center' as const,
      letterSpacing: 0,
    },
    modalActionTextPrimary: {
      color: c.textOnPrimary,
      fontFamily: f.sansBold,
    },
    modalActionBusy: {
      opacity: 0.65,
    },
    modalBtnDestructive: {
      borderWidth: 1,
      borderColor: c.danger,
      backgroundColor: c.surface,
    },
    modalBtnTxtDestructive: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.danger,
      textAlign: 'center' as const,
    },
  });
}

type PostSnap = {
  sessionId: string;
  lineas: BorradorEjercicioLinea[];
  routineId: string | null;
  nombre: string;
};

const MESES_ENTRENO = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

function nombreEntrenoPorFecha(fecha = new Date()): string {
  return `Entreno ${fecha.getDate()} ${MESES_ENTRENO[fecha.getMonth()]}`;
}

export default function EntrenoActivoScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    entrenoActivo,
    setLineas,
    actualizarLinea,
    terminarEntreno,
    descartarEntreno,
    minimizar,
  } = useEntreno();
  const duracionTxt = useEntrenoDuracionTexto();
  const { c, f, ts, s, r, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [crearEjercicioAbierto, setCrearEjercicioAbierto] = useState(false);
  const [replaceLineId, setReplaceLineId] = useState<string | null>(null);
  const [anteriorPorEjercicio, setAnteriorPorEjercicio] = useState<Record<string, string>>({});
  const [recordBaselines, setRecordBaselines] = useState<RecordBaselineMap>({});
  const [modalIncompletas, setModalIncompletas] = useState(false);
  const [modalConfirmarTerminar, setModalConfirmarTerminar] = useState(false);
  const [modalDescartar, setModalDescartar] = useState(false);
  const [modalGuardarRutina, setModalGuardarRutina] = useState(false);
  const [modalActualizarRutina, setModalActualizarRutina] = useState(false);
  const [nombreNuevaRutina, setNombreNuevaRutina] = useState('');
  const [postSnap, setPostSnap] = useState<PostSnap | null>(null);
  const [guardandoRutina, setGuardandoRutina] = useState(false);
  const allowNavAway = useRef(false);
  const postSnapRef = useRef<PostSnap | null>(null);

  // Timer de descanso
  const { preferencia, cargada: prefCargada } = useTimerDescanso();
  const [timerFinMs, setTimerFinMs] = useState<number | null>(null);
  const [autoInicioMs, setAutoInicioMs] = useState<number | null>(null);

  useEffect(() => {
    if (preferencia.modo !== 'fijo') {
      setTimerFinMs(null);
    }
    if (preferencia.modo !== 'auto') {
      setAutoInicioMs(null);
    }
  }, [preferencia.modo]);

  useEffect(() => {
    if (entrenoActivo || postSnapRef.current) return;
    allowNavAway.current = true;
    router.replace('/(tabs)/(entrenamiento)');
    const t = setTimeout(() => {
      allowNavAway.current = false;
    }, 500);
    return () => clearTimeout(t);
  }, [entrenoActivo, postSnap, router]);

  const lineas = useMemo(
    () => entrenoActivo?.lineas ?? postSnap?.lineas ?? [],
    [entrenoActivo?.lineas, postSnap?.lineas],
  );

  /** Rutas/recuperación no rellenan `foto_url`; se hidrata desde catálogo sin bloquear la UI. */
  const claveFotosPendientes = useMemo(
    () =>
      lineas
        .filter((l) => l.foto_url === undefined && l.exerciseId)
        .map((l) => l.exerciseId)
        .sort()
        .join(','),
    [lineas],
  );

  useEffect(() => {
    if (!claveFotosPendientes) return;
    const ids = [...new Set(claveFotosPendientes.split(',').filter(Boolean))];
    if (!ids.length) return;
    let cancelled = false;
    void (async () => {
      const pairs = await Promise.all(
        ids.map(async (id) => {
          const ex = await ejerciciosService.obtenerEjercicio(id);
          const u = ex?.foto_url != null && String(ex.foto_url).trim() !== '' ? String(ex.foto_url).trim() : null;
          const tracking = ex?.tracking_mode ?? (ex?.categoria === 'cardio' ? 'cardio_time' : 'strength');
          return [id, u, tracking] as const;
        }),
      );
      if (cancelled) return;
      setLineas((prev) =>
        prev.map((l) => {
          if (l.foto_url !== undefined) return l;
          const hit = pairs.find(([id]) => id === l.exerciseId);
          if (!hit) return { ...l, foto_url: null, tracking_mode: l.tracking_mode ?? 'strength' };
          const [, url, tracking] = hit;
          return { ...l, foto_url: url, tracking_mode: l.tracking_mode ?? tracking };
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [claveFotosPendientes, setLineas]);

  useEffect(() => {
    if (!user?.id || !lineas.length) {
      setAnteriorPorEjercicio({});
      return;
    }
    const ultima = entrenoActivo?.ultimaSesionRutina ?? null;
    // Only fetch from DB for exercises not covered by ultimaSesionRutina
    const lineasSinCobertura = lineas.filter((l) => {
      if (!ultima) return true;
      return !ultima.ejercicios.some(
        (e) =>
          e.exercise_id === l.exerciseId &&
          (l.orden == null || e.orden === l.orden),
      );
    });
    if (!lineasSinCobertura.length) {
      setAnteriorPorEjercicio({});
      return;
    }
    let cancel = false;
    void (async () => {
      const entries = await Promise.all(
        lineasSinCobertura.map(async (l) => {
          const t = await entrenamientoService.obtenerAnteriorPorEjercicio(user.id, l.exerciseId);
          return [l.exerciseId, t ?? ''] as const;
        }),
      );
      if (cancel) return;
      const next: Record<string, string> = {};
      for (const [id, t] of entries) {
        if (t) next[id] = t;
      }
      setAnteriorPorEjercicio(next);
    })();
    return () => {
      cancel = true;
    };
  }, [user?.id, lineas, entrenoActivo?.ultimaSesionRutina]);

  const textosAnteriorPorLineId = useMemo(() => {
    const ultima = entrenoActivo?.ultimaSesionRutina ?? null;
    const m = new Map<string, (string | null)[]>();
    for (const line of lineas) {
      m.set(line.lineId, textosAnteriorPorLinea(line, ultima, anteriorPorEjercicio));
    }
    return m;
  }, [lineas, entrenoActivo?.ultimaSesionRutina, anteriorPorEjercicio]);

  const claveRecordsEjercicios = useMemo(
    () => [...new Set(lineas.map((l) => l.exerciseId).filter(Boolean))].sort().join(','),
    [lineas],
  );

  useEffect(() => {
    if (!user?.id || !claveRecordsEjercicios) {
      setRecordBaselines({});
      return;
    }
    const exerciseIds = claveRecordsEjercicios.split(',').filter(Boolean);
    let cancel = false;
    void (async () => {
      const records = await entrenamientoService.obtenerRecordsVigentesEjercicios(user.id, exerciseIds);
      if (!cancel) setRecordBaselines(buildRecordBaselineMap(records));
    })();
    return () => {
      cancel = true;
    };
  }, [user?.id, claveRecordsEjercicios]);

  const recordFlagsPorLineId = useMemo(() => {
    const m = new Map<string, ReturnType<typeof calcularRecordFlagsPorLinea>>();
    for (const line of lineas) {
      m.set(line.lineId, calcularRecordFlagsPorLinea(line, recordBaselines));
    }
    return m;
  }, [lineas, recordBaselines]);

  const hayIncompletas = useMemo(
    () => lineas.some((l) => l.sets.some((s) => !s.completada)),
    [lineas],
  );

  const incorporarEjercicio = useCallback(
    (ex: Exercise) => {
      const fotoRaw = ex.foto_url;
      const foto_url =
        fotoRaw != null && String(fotoRaw).trim() !== '' ? String(fotoRaw).trim() : null;
      const tracking_mode = ex.tracking_mode ?? (ex.categoria === 'cardio' ? 'cardio_time' : 'strength');
      const setsIniciales = esCardio(tracking_mode) ? [registroCardioPorDefecto()] : [seriePorDefecto()];
      setLineas((prev) => {
        const repId = replaceLineId;
        if (repId) {
          return prev.map((l) =>
            l.lineId === repId
              ? {
                  ...l,
                  exerciseId: ex.id,
                  nombre: ex.nombre,
                  musculo_primario: ex.musculo_primario,
                  foto_url,
                  tracking_mode,
                  sets: setsIniciales,
                }
              : l,
          );
        }
        return [
          ...prev,
          {
            lineId: lid(),
            exerciseId: ex.id,
            nombre: ex.nombre,
            musculo_primario: ex.musculo_primario,
            foto_url,
            tracking_mode,
            sets: setsIniciales,
          },
        ];
      });
      setReplaceLineId(null);
    },
    [replaceLineId, setLineas],
  );

  const moverLinea = useCallback(
    (index: number, delta: number) => {
      setLineas((prev) => {
        const j = index + delta;
        if (j < 0 || j >= prev.length) return prev;
        const copia = [...prev];
        const [x] = copia.splice(index, 1);
        copia.splice(j, 0, x);
        return copia;
      });
    },
    [setLineas],
  );

  const eliminarLinea = useCallback(
    (lineId: string) => {
      setLineas((prev) => prev.filter((l) => l.lineId !== lineId));
    },
    [setLineas],
  );

  const abrirSheetReemplazar = useCallback((lineId: string) => {
    setReplaceLineId(lineId);
    setSheetAbierto(true);
  }, []);

  const dismissTimer = useCallback(() => {
    setTimerFinMs(null);
  }, []);

  const ajustarTimer = useCallback((deltaSeg: number) => {
    setTimerFinMs((prev) =>
      prev === null ? null : Math.max(Date.now() + 1000, prev + deltaSeg * 1000),
    );
  }, []);

  const actualizarNotaLinea = useCallback(
    (lineId: string, nota: string) => {
      setLineas((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, nota } : l)));
    },
    [setLineas],
  );

  const crearPersonalizado = useCallback(
    async (nombre: string, musculo: string) => {
      if (!user?.id) {
        Alert.alert('Sesión', 'Inicia sesión para crear ejercicios.');
        return null;
      }
      return ejerciciosService.crearEjercicioPersonalizado(user.id, {
        nombre,
        musculo_primario: musculo,
      });
    },
    [user?.id],
  );

  const onCrearEjercicioListo = useCallback(
    async (nombre: string, musculo: string) => {
      const ex = await crearPersonalizado(nombre, musculo);
      if (ex) {
        incorporarEjercicio(ex);
        setCrearEjercicioAbierto(false);
        setSheetAbierto(false);
      }
      return ex;
    },
    [crearPersonalizado, incorporarEjercicio],
  );

  const ejecutarTerminar = useCallback(async () => {
    if (!entrenoActivo || !user?.id) return;
    const snapshot = entrenoActivo.snapshotRutina;
    const snap: PostSnap = {
      sessionId: entrenoActivo.sessionId,
      lineas: entrenoActivo.lineas.map((l) => ({
        ...l,
        sets: l.sets.map((s) => ({ ...s })),
      })),
      routineId: entrenoActivo.routineId,
      nombre: entrenoActivo.nombre,
    };
    const hayModificaciones = snapshot != null && haycambiosEstructurales(snap.lineas, snapshot);
    const cardioInvalido = entrenoActivo.lineas.some((line) => {
      if (!esCardio(line.tracking_mode)) return false;
      const registro = line.sets[0];
      return Boolean(registro?.completada) && parseDuracionMinASeg(registro.duracionSeg) == null;
    });
    if (cardioInvalido) {
      Alert.alert('Tiempo requerido', 'Los ejercicios de cardio completados necesitan un tiempo válido.');
      return;
    }
    const payload = lineasAPersistido(entrenoActivo.lineas);
    try {
      await entrenamientoService.guardarSetsCompletados(entrenoActivo.sessionId, payload);
      if (snap.routineId == null || hayModificaciones) {
        postSnapRef.current = snap;
        setPostSnap(snap);
      }
      await terminarEntreno();
      setNombreNuevaRutina(snap.nombre || 'Mi rutina');
      if (snap.routineId == null) {
        setModalGuardarRutina(true);
      } else if (hayModificaciones) {
        setModalActualizarRutina(true);
      } else {
        // Sin cambios estructurales: actualizar valores (kg/reps/tiempos) silenciosamente
        const borrador = lineasARutinaCompleta(snap.lineas);
        try {
          await entrenamientoService.actualizarRutinaDesdeEntreno(snap.routineId, borrador);
        } catch {
          // Fallo silencioso: los valores del entreno ya están guardados
        }
        postSnapRef.current = null;
        setPostSnap(null);
      }
    } catch {
      postSnapRef.current = null;
      Alert.alert('Error', 'No se pudo guardar el entreno.');
    }
  }, [entrenoActivo, user?.id, terminarEntreno]);

  const onTerminar = useCallback(() => {
    if (hayIncompletas) {
      setModalIncompletas(true);
      return;
    }
    setModalConfirmarTerminar(true);
  }, [hayIncompletas]);

  const onMinimizar = useCallback(() => {
    minimizar();
    allowNavAway.current = true;
    router.replace('/(tabs)/(entrenamiento)');
    setTimeout(() => {
      allowNavAway.current = false;
    }, 400);
  }, [minimizar, router]);

  const cerrarPostModalsYSalir = useCallback(() => {
    setModalGuardarRutina(false);
    setModalActualizarRutina(false);
    postSnapRef.current = null;
    setPostSnap(null);
  }, []);

  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      if (allowNavAway.current) return;
      if (postSnapRef.current) {
        e.preventDefault();
        cerrarPostModalsYSalir();
        return;
      }
      e.preventDefault();
      setModalDescartar(true);
    });
    return sub;
  }, [navigation, cerrarPostModalsYSalir]);

  const onConfirmarGuardarRutina = useCallback(async () => {
    if (!user?.id || !postSnap) return;
    const borrador = lineasARutinaSoloCompletadas(postSnap.lineas);
    if (!borrador.length) {
      Alert.alert('Sin datos', 'No hay series completadas para guardar como rutina.');
      cerrarPostModalsYSalir();
      return;
    }
    const titulo = nombreNuevaRutina.trim();
    if (!titulo) {
      Alert.alert('Nombre', 'Indica un nombre para la rutina.');
      return;
    }
    setGuardandoRutina(true);
    try {
      const res = await entrenamientoService.guardarRutinaDesdeBorrador(user.id, titulo, borrador);
      if (res.ok) {
        await entrenamientoService.actualizarWorkoutSession(postSnap.sessionId, {
          nombre: titulo,
          routine_id: res.routineId,
        });
        cerrarPostModalsYSalir();
      }
      else Alert.alert('Error', res.error);
    } finally {
      setGuardandoRutina(false);
    }
  }, [user?.id, postSnap, nombreNuevaRutina, cerrarPostModalsYSalir]);

  const onConfirmarActualizarRutina = useCallback(async () => {
    if (!postSnap?.routineId) return;
    const borrador = lineasARutinaCompleta(postSnap.lineas);
    setGuardandoRutina(true);
    try {
      await entrenamientoService.actualizarRutinaDesdeEntreno(postSnap.routineId, borrador);
      cerrarPostModalsYSalir();
    } finally {
      setGuardandoRutina(false);
    }
  }, [postSnap, cerrarPostModalsYSalir]);

  const onCerrarGuardarRutinaSinGuardar = useCallback(async () => {
    const snap = postSnapRef.current;
    if (snap?.sessionId && snap.routineId == null) {
      await entrenamientoService.actualizarWorkoutSession(snap.sessionId, {
        nombre: nombreEntrenoPorFecha(),
      });
    }
    cerrarPostModalsYSalir();
  }, [cerrarPostModalsYSalir]);

  const descartarEntrenoYSalir = useCallback(async () => {
    try {
      await descartarEntreno();
    } catch {
      Alert.alert('Error', 'No se pudo descartar el entreno.');
      return;
    }
    allowNavAway.current = true;
    router.replace('/(tabs)/(entrenamiento)');
    setTimeout(() => {
      allowNavAway.current = false;
    }, 500);
  }, [descartarEntreno, router]);

  const onDescartarEntreno = useCallback(async () => {
    setModalDescartar(false);
    await descartarEntrenoYSalir();
  }, [descartarEntrenoYSalir]);

  const onDescartarEntrenoDesdeIncompletas = useCallback(async () => {
    setModalIncompletas(false);
    await descartarEntrenoYSalir();
  }, [descartarEntrenoYSalir]);

  if (!entrenoActivo && !postSnap) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, justifyContent: 'center' }]}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  const cuerpoEntreno = entrenoActivo != null || postSnap != null;
  const fondoPostEntreno = entrenoActivo == null && postSnap != null;
  const nombrePantalla = entrenoActivo?.nombre ?? postSnap?.nombre ?? 'Entreno';

  return (
    <>
      {cuerpoEntreno ? (
        <KeyboardAvoidingView
          style={[styles.root, { paddingTop: insets.top }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
      <View style={styles.header}>
        <Pressable
          style={styles.headerBtn}
          onPress={onMinimizar}
          disabled={fondoPostEntreno}
          accessibilityLabel="Minimizar entreno"
        >
          <Ionicons name="chevron-down" size={26} color={c.textDisplay} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {nombrePantalla}
          </Text>
          <Text style={styles.cron}>{duracionTxt}</Text>
        </View>
        <Pressable
          style={styles.terminarBtn}
          onPress={onTerminar}
          disabled={fondoPostEntreno}
          accessibilityLabel="Terminar entreno"
        >
          <Text style={styles.terminarTxt}>Terminar</Text>
        </Pressable>
      </View>

      <View style={[styles.body, { paddingBottom: insets.bottom }]}>
        {lineas.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: s.md }}>
            <Text style={{ ...ts.body, fontFamily: f.sans, color: c.textSecondary, textAlign: 'center' }}>
              Añade ejercicios para empezar
            </Text>
            <View style={styles.footerGlowWrap}>
              {isDark ? (
                <GlowButton borderRadius={r.sm} glowPadding={24}>
                  <Pressable
                    style={styles.footerGlowPressable}
                    onPress={() => setSheetAbierto(true)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.footerBtnText}>+ AGREGAR EJERCICIO</Text>
                  </Pressable>
                </GlowButton>
              ) : (
                <Pressable
                  style={styles.footerGlowPressable}
                  onPress={() => setSheetAbierto(true)}
                  accessibilityRole="button"
                >
                  <Text style={styles.footerBtnText}>+ AGREGAR EJERCICIO</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {lineas.map((line, index) => (
                <EjercicioRutinaCard
                  key={line.lineId}
                  modo="entreno"
                  nota={line.nota ?? ''}
                  onNotaChange={(texto: string) => {
                    if (!fondoPostEntreno) actualizarNotaLinea(line.lineId, texto);
                  }}
                  textoAnteriorSeries={textosAnteriorPorLineId.get(line.lineId)}
                  recordFlagsSeries={recordFlagsPorLineId.get(line.lineId)}
                  data={line}
                  onChange={(next) => {
                    if (fondoPostEntreno) return;
                    if (esCardio(line.tracking_mode)) {
                      actualizarLinea(line.lineId, next);
                      return;
                    }
                    // Detectar set recién completado para disparar el timer
                    let nextMutado = next;
                    for (let i = 0; i < next.sets.length; i++) {
                      const prev = line.sets[i];
                      const curr = next.sets[i];
                      if (!prev || !curr) continue;
                      if (!prev.completada && curr.completada) {
                        const ahora = Date.now();
                        nextMutado = {
                          ...nextMutado,
                          sets: nextMutado.sets.map((s, idx) =>
                            idx === i ? { ...s, completada_at: ahora } : s,
                          ),
                        };
                        if (prefCargada && preferencia.modo === 'fijo') {
                          setTimerFinMs(ahora + preferencia.duracionSeg * 1000);
                        }
                        if (preferencia.modo === 'auto') {
                          setAutoInicioMs(ahora);
                        }
                      }
                      if (prev.completada && !curr.completada && preferencia.modo === 'auto') {
                        setAutoInicioMs(null);
                      }
                    }
                    actualizarLinea(line.lineId, nextMutado);
                  }}
                  onMoveUp={() => {
                    if (!fondoPostEntreno) moverLinea(index, -1);
                  }}
                  onMoveDown={() => {
                    if (!fondoPostEntreno) moverLinea(index, 1);
                  }}
                  onReplace={() => {
                    if (!fondoPostEntreno) abrirSheetReemplazar(line.lineId);
                  }}
                  onDelete={() => {
                    if (!fondoPostEntreno) eliminarLinea(line.lineId);
                  }}
                  canMoveUp={!fondoPostEntreno && index > 0}
                  canMoveDown={!fondoPostEntreno && index < lineas.length - 1}
                />
              ))}
            </ScrollView>
            {!fondoPostEntreno ? (
              <View style={[styles.footerBtn, prefCargada && preferencia.modo === 'fijo' && timerFinMs !== null && styles.footerBtnTimer]}>
                {prefCargada && preferencia.modo === 'fijo' && timerFinMs !== null ? (
                  <TimerDescansoInline
                    finMs={timerFinMs}
                    onSkip={dismissTimer}
                    onAddTime={ajustarTimer}
                  />
                ) : (
                  <View style={styles.footerGlowWrap}>
                    {isDark ? (
                      <GlowButton borderRadius={r.sm} glowPadding={24}>
                        <Pressable
                          style={styles.footerGlowPressable}
                          onPress={() => setSheetAbierto(true)}
                          accessibilityRole="button"
                        >
                          <Text style={styles.footerBtnText}>+ AGREGAR EJERCICIO</Text>
                        </Pressable>
                      </GlowButton>
                    ) : (
                      <Pressable
                        style={styles.footerGlowPressable}
                        onPress={() => setSheetAbierto(true)}
                        accessibilityRole="button"
                      >
                        <Text style={styles.footerBtnText}>+ AGREGAR EJERCICIO</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            ) : null}
          </>
        )}
      </View>

      <AgregarEjercicioSheet
        visible={sheetAbierto}
        onClose={() => {
          setSheetAbierto(false);
          setReplaceLineId(null);
        }}
        onSeleccionar={incorporarEjercicio}
        onCrearPersonalizado={() => setCrearEjercicioAbierto(true)}
      />

      <CrearEjercicioModal
        visible={crearEjercicioAbierto}
        onClose={() => setCrearEjercicioAbierto(false)}
        onSubmit={onCrearEjercicioListo}
      />
        </KeyboardAvoidingView>
      ) : null}

      {/* Chip cronómetro — modo auto */}
      <View
        style={{
          position: 'absolute',
          bottom: insets.bottom + 72,
          left: 0,
          right: 0,
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <ChipCronometrando
          visible={prefCargada && preferencia.modo === 'auto' && autoInicioMs !== null}
          inicioMs={autoInicioMs}
        />
      </View>

      <Modal visible={modalIncompletas} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalAccent} />
            <Text style={styles.modalTitle}>Series sin completar</Text>
            <Text style={styles.modalBody}>
              Hay series que no marcaste como hechas. Puedes revisarlas o terminar y descartar las incompletas del
              registro.
            </Text>
            <View style={styles.modalIncompletasColumn}>
              <Pressable
                style={styles.modalAction}
                onPress={() => setModalIncompletas(false)}
                accessibilityRole="button"
              >
                <Text style={styles.modalActionText}>Revisar</Text>
              </Pressable>
              <Pressable
                style={styles.modalActionPrimary}
                onPress={() => {
                  setModalIncompletas(false);
                  void ejecutarTerminar();
                }}
                accessibilityRole="button"
              >
                <Text style={[styles.modalActionText, styles.modalActionTextPrimary]}>
                  Descartar incompletas
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalAction, styles.modalActionDanger]}
                onPress={() => void onDescartarEntrenoDesdeIncompletas()}
                accessibilityRole="button"
              >
                <Text style={styles.modalBtnTxtDestructive}>Descartar entreno</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalConfirmarTerminar} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalAccent} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: s.sm }}>
              <Text style={[styles.modalTitle, { marginBottom: 0, flex: 1 }]}>¿Terminar entreno?</Text>
              <Pressable onPress={() => setModalConfirmarTerminar(false)} hitSlop={10} accessibilityLabel="Cerrar">
                <Text style={{ fontFamily: f.sans, color: c.textMuted, fontSize: 18, lineHeight: 22 }}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.modalBody}>
              Se guardarán las series completadas y podrás guardar o actualizar la rutina si aplica.
            </Text>
            <View style={styles.modalIncompletasColumn}>
              <Pressable
                style={styles.modalActionPrimary}
                onPress={() => {
                  setModalConfirmarTerminar(false);
                  void ejecutarTerminar();
                }}
                accessibilityRole="button"
              >
                <Text style={[styles.modalActionText, styles.modalActionTextPrimary]}>Terminar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalAction, styles.modalActionDanger]}
                onPress={() => {
                  setModalConfirmarTerminar(false);
                  void onDescartarEntrenoDesdeIncompletas();
                }}
                accessibilityRole="button"
              >
                <Text style={styles.modalBtnTxtDestructive}>Descartar entreno</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalDescartar} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>¿Descartar entreno?</Text>
            <Text style={styles.modalBody}>Se eliminará la sesión sin guardar el progreso en el historial.</Text>
            <View style={styles.modalRow}>
              <Pressable style={styles.modalBtn} onPress={() => setModalDescartar(false)}>
                <Text style={styles.modalBtnTxt}>Continuar</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { borderColor: c.danger }]} onPress={onDescartarEntreno}>
                <Text style={[styles.modalBtnTxt, { color: c.danger }]}>Descartar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalGuardarRutina} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalAccent} />
            <Text style={styles.modalTitle}>¿Guardar como rutina?</Text>
            <Text style={styles.modalBody}>Se creará una plantilla con las series que completaste.</Text>
            <TextInput
              style={styles.modalInput}
              value={nombreNuevaRutina}
              onChangeText={setNombreNuevaRutina}
              placeholder="Nombre de la rutina"
              placeholderTextColor={c.textMuted}
            />
            <View style={styles.modalIncompletasColumn}>
              <Pressable
                style={[styles.modalAction, guardandoRutina ? styles.modalActionBusy : null]}
                onPress={() => void onCerrarGuardarRutinaSinGuardar()}
                disabled={guardandoRutina}
                accessibilityRole="button"
              >
                <Text style={styles.modalActionText}>Ahora no</Text>
              </Pressable>
              <Pressable
                style={[styles.modalActionPrimary, guardandoRutina ? styles.modalActionBusy : null]}
                onPress={() => void onConfirmarGuardarRutina()}
                disabled={guardandoRutina}
                accessibilityRole="button"
              >
                {guardandoRutina ? (
                  <ActivityIndicator color={c.textOnPrimary} />
                ) : (
                  <Text style={[styles.modalActionText, styles.modalActionTextPrimary]}>Guardar rutina</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalActualizarRutina} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalAccent} />
            <Text style={styles.modalTitle}>¿Actualizar rutina?</Text>
            <Text style={styles.modalBody}>
              La plantilla de la rutina se reemplazará por los ejercicios y series que tienes ahora en pantalla.
            </Text>
            <View style={styles.modalIncompletasColumn}>
              <Pressable
                style={[styles.modalAction, guardandoRutina ? styles.modalActionBusy : null]}
                onPress={() => void onConfirmarActualizarRutina()}
                disabled={guardandoRutina}
                accessibilityRole="button"
              >
                {guardandoRutina ? (
                  <ActivityIndicator color={c.primary} />
                ) : (
                  <Text style={styles.modalActionText}>Actualizar rutina</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.modalActionPrimary, guardandoRutina ? styles.modalActionBusy : null]}
                onPress={cerrarPostModalsYSalir}
                disabled={guardandoRutina}
                accessibilityRole="button"
              >
                <Text style={[styles.modalActionText, styles.modalActionTextPrimary]}>
                  Continuar
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
