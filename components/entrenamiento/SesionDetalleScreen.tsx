/**
 * Detalle de sesión finalizada — solo lectura.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  entrenamientoService,
  type DetalleSesion,
  type DetalleSesionEjercicio,
  type DetalleSesionSet,
} from '@/services/entrenamiento.service';
import { progresoService } from '@/services/progreso.service';
import type { TipoSerie } from '@/types/database.types';

function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatFechaCabecera(ymd: string): string {
  const dt = parseYmdLocal(ymd);
  const s = dt.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatHora(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

/** Extrae "HH:MM" de un ISO string usando hora local del dispositivo. */
function isoToHHMM(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Formatea la entrada de hora mientras el usuario escribe:
 * solo dígitos, inserta ':' automáticamente tras los 2 primeros,
 * limita a 4 dígitos (→ "HH:MM"). Devuelve el string formateado.
 */
function formatearEntradaHora(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** True si "HH:MM" tiene valores válidos (H 0–23, M 0–59). */
function esHoraValida(hhmm: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return false;
  const h = parseInt(hhmm.slice(0, 2), 10);
  const m = parseInt(hhmm.slice(3, 5), 10);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/**
 * Combina la fecha base (ISO date) con una hora "HH:MM" y devuelve un ISO string
 * usando la zona local del dispositivo.
 */
function hhmmToIso(fechaBase: string, hhmm: string): string | null {
  if (!esHoraValida(hhmm)) return null;
  const h = parseInt(hhmm.slice(0, 2), 10);
  const m = parseInt(hhmm.slice(3, 5), 10);
  const [y, mo, d] = fechaBase.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0).toISOString();
}

function formatDuracionSesion(hora_inicio: string | null, hora_fin: string | null): string {
  if (hora_fin == null) return 'En curso';
  if (!hora_inicio) return '< 1 min';
  const inicioMs = new Date(hora_inicio).getTime();
  const finMs = new Date(hora_fin).getTime();
  if (Number.isNaN(inicioMs) || Number.isNaN(finMs) || finMs <= inicioMs) return '< 1 min';

  const totalSegundos = Math.max(1, Math.round((finMs - inicioMs) / 1000));
  if (totalSegundos < 60) return `${totalSegundos} s`;

  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;
  if (minutos < 60) return segundos === 0 ? `${minutos} min` : `${minutos} min ${segundos} s`;

  const h = Math.floor(minutos / 60);
  const r = minutos % 60;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}min`;
}

function formatDescanso(seg: number | null | undefined): string {
  if (seg == null || !Number.isFinite(Number(seg)) || Number(seg) <= 0) return '—';
  const total = Math.round(Number(seg));
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function calcMediaDescanso(sets: DetalleSesionSet[]): number | null {
  const vals = sets
    .filter((s) => s.completada && s.descanso_seg != null)
    .map((s) => s.descanso_seg as number);
  if (vals.length === 0) return null;
  return vals.reduce((acc, v) => acc + v, 0) / vals.length;
}

function estimarKcalSesion(
  ejercicios: DetalleSesionEjercicio[],
  hora_inicio: string | null,
  hora_fin: string | null,
  pesoKg: number | null,
): number | null {
  if (pesoKg == null || !hora_inicio || !hora_fin) return null;
  const inicioMs = new Date(hora_inicio).getTime();
  const finMs = new Date(hora_fin).getTime();
  if (Number.isNaN(inicioMs) || Number.isNaN(finMs) || finMs <= inicioMs) return null;
  const duracionHoras = (finMs - inicioMs) / 3_600_000;
  if (duracionHoras <= 0 || ejercicios.length === 0) return null;
  const numCardio = ejercicios.filter(
    (ej) => ej.tracking_mode === 'cardio_time' || ej.tracking_mode === 'cardio_time_distance',
  ).length;
  const numFuerza = ejercicios.length - numCardio;
  const metPromedio = (numFuerza * 4.0 + numCardio * 7.0) / ejercicios.length;
  return Math.round(metPromedio * pesoKg * duracionHoras);
}

function badgeTipoSerie(t: TipoSerie): string {
  switch (t) {
    case 'warm_up':
      return 'WU';
    case 'top_set':
      return 'TS';
    case 'back_off':
      return 'BO';
    case 'superset':
      return 'SS';
    case 'lineal':
    default:
      return 'LIN';
  }
}

function celdaKg(set: DetalleSesionSet): string {
  if (set.tipo_peso === 'bodyweight' && set.peso_kg == null) return 'PC';
  if (set.peso_kg == null) return '—';
  return String(set.peso_kg);
}

function celdaRir(set: DetalleSesionSet): string {
  return set.rir != null ? String(set.rir) : '-';
}

function esCardioDetalle(mode: string | null | undefined): boolean {
  return mode === 'cardio_time' || mode === 'cardio_time_distance';
}

function formatDuracionCardio(seg: number | null | undefined): string {
  if (seg == null || !Number.isFinite(Number(seg)) || Number(seg) <= 0) return '—';
  const total = Math.round(Number(seg));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatKm(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(Number(km))) return '—';
  return Number(km).toLocaleString('es-ES', { maximumFractionDigits: 2 });
}

const TIPOS_SERIE_LEYENDA = [
  { siglas: 'LIN', nombre: 'Lineal', desc: 'Serie estándar progresiva' },
  { siglas: 'WU', nombre: 'Warm Up', desc: 'Serie de calentamiento, no cuenta para el volumen' },
  { siglas: 'TS', nombre: 'Top Set', desc: 'Serie de mayor intensidad del ejercicio' },
  { siglas: 'BO', nombre: 'Back Off', desc: 'Serie a menor intensidad tras el top set' },
  { siglas: 'SS', nombre: 'Superset', desc: 'Combinada con el ejercicio siguiente' },
] as const;

export default function DetalleSesionPantalla() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const sessionId = Array.isArray(idParam) ? idParam[0] : idParam;

  const router = useRouter();

  const goBack = useCallback(() => {
    router.back();
  }, [router]);
  const insets = useSafeAreaInsets();
  const { c, f, ts, s, r } = useTheme();
  const { user } = useAuth();

  const [detalle, setDetalle] = useState<DetalleSesion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [modalTipos, setModalTipos] = useState(false);
  const [pesoKg, setPesoKg] = useState<number | null>(null);
  const [modalDuracion, setModalDuracion] = useState(false);
  const [editInicio, setEditInicio] = useState('');
  const [editFin, setEditFin] = useState('');
  const [errorInicio, setErrorInicio] = useState(false);
  const [errorFin, setErrorFin] = useState(false);
  const [guardandoDuracion, setGuardandoDuracion] = useState(false);
  const inputFinRef = useRef<TextInput>(null);

  const cargar = useCallback(async () => {
    if (!sessionId) {
      setError('Sesión no válida.');
      setCargando(false);
      setDetalle(null);
      return;
    }
    setCargando(true);
    setError(null);
    const data = await entrenamientoService.obtenerDetalleSesion(sessionId);
    if (!data) {
      setError('No se pudo cargar la sesión.');
      setDetalle(null);
    } else {
      setDetalle(data);
    }
    setCargando(false);
  }, [sessionId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!user?.id) return;
    progresoService.obtenerPesoUsuario(user.id).then(setPesoKg);
  }, [user?.id]);

  const mediaDescansoPorEjercicio = useMemo<Map<string, number | null>>(() => {
    const map = new Map<string, number | null>();
    if (!detalle) return map;
    for (const ej of detalle.ejercicios) map.set(ej.id, calcMediaDescanso(ej.sets));
    return map;
  }, [detalle]);

  const mediaDescansoSesion = useMemo<number | null>(() => {
    if (!detalle) return null;
    return calcMediaDescanso(detalle.ejercicios.flatMap((ej) => ej.sets));
  }, [detalle]);

  const kcalEstimadas = useMemo<number | null>(() => {
    if (!detalle) return null;
    return estimarKcalSesion(detalle.ejercicios, detalle.hora_inicio, detalle.hora_fin, pesoKg);
  }, [detalle, pesoKg]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
          backgroundColor: c.background,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: insets.top + s.xs,
          paddingBottom: s.sm,
          paddingHorizontal: s.sm,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          backgroundColor: c.background,
        },
        headerSide: {
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
        },
        headerTitle: {
          flex: 1,
          ...ts.subheading,
          fontFamily: f.sansMedium,
          color: c.textDisplay,
          textAlign: 'center',
        },
        gapHeaderMetrics: {
          height: 14,
        },
        metricsWrap: {
          marginHorizontal: s.md,
          marginBottom: 22,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.borderVisible,
          borderRadius: r.md,
          overflow: 'hidden',
        },
        metricsRow: {
          flexDirection: 'row',
        },
        metricsCell: {
          flex: 1,
          minWidth: 0,
          minHeight: 66,
          paddingHorizontal: s.md,
          paddingVertical: 12,
          justifyContent: 'center',
        },
        metricsCellInner: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        metricTextCol: {
          flex: 1,
          minWidth: 0,
        },
        metricsCellSepV: {
          borderRightWidth: 1,
          borderRightColor: c.border,
        },
        metricsCellSepH: {
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        },
        metricLbl: {
          ...ts.label,
          fontFamily: f.monoBold,
          color: c.textSecondary,
          letterSpacing: 0.8,
          marginBottom: 3,
        },
        metricValFecha: {
          ...ts.body,
          fontFamily: f.sansBold,
          color: c.textDisplay,
        },
        metricValDur: {
          ...ts.body,
          fontFamily: f.monoBold,
          color: c.textDisplay,
          letterSpacing: -0.2,
        },
        metricValHora: {
          ...ts.body,
          fontFamily: f.mono,
          color: c.textDisplay,
        },
        metricValEnCurso: {
          ...ts.body,
          fontFamily: f.mono,
          color: c.primary,
          letterSpacing: 0.5,
        },
        metricValDescanso: {
          ...ts.body,
          fontFamily: f.mono,
          color: c.textDisplay,
          letterSpacing: -0.2,
        },
        ejDescansoChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
        },
        ejDescansoChipTxt: {
          ...ts.caption,
          fontFamily: f.mono,
          color: c.textSecondary,
          fontSize: 11,
        },
        scroll: {
          flex: 1,
        },
        scrollContent: {
          paddingHorizontal: s.md,
          paddingTop: 0,
          paddingBottom: insets.bottom + s.xl,
        },
        sectionHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: s.sm,
          gap: s.sm,
        },
        sectionTitleWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: s.xs,
        },
        sectionTitle: {
          ...ts.label,
          fontFamily: f.monoBold,
          color: c.textDisplay,
          letterSpacing: 0.7,
        },
        sectionCount: {
          ...ts.caption,
          fontFamily: f.mono,
          color: c.primary,
          backgroundColor: c.surface,
          borderRadius: r.pill,
          paddingHorizontal: s.sm,
          paddingVertical: 3,
          overflow: 'hidden',
        },
        cardEj: {
          borderWidth: 1,
          borderColor: c.borderVisible,
          borderRadius: r.sm,
          backgroundColor: c.surface,
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 10,
          marginBottom: s.sm,
        },
        ejRowHead: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: s.sm,
          marginBottom: s.xs,
        },
        ejImg48: {
          width: 38,
          height: 38,
          borderRadius: r.technical,
        },
        ejImgPh: {
          width: 38,
          height: 38,
          borderRadius: r.technical,
          backgroundColor: c.surfaceElevated,
          alignItems: 'center',
          justifyContent: 'center',
        },
        ejCabTextCol: {
          flex: 1,
          minWidth: 0,
        },
        ejTitulo: {
          ...ts.bodySm,
          fontFamily: f.sansBold,
          color: c.primary,
          marginBottom: 0,
        },
        ejNombreLink: {
          color: c.primary,
        },
        ejMusculo: {
          ...ts.caption,
          fontFamily: f.mono,
          color: c.textSecondary,
        },
        ejNotaFila: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: s.xs,
          paddingVertical: s.xs,
          marginBottom: s.xs,
        },
        ejNotaTxt: {
          flex: 1,
          minWidth: 0,
          ...ts.caption,
          fontFamily: f.mono,
          color: c.textSecondary,
          fontStyle: 'italic',
        },
        tablaHead: {
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          paddingBottom: s.xs,
          marginBottom: s.xs,
        },
        colSerie: {
          flex: 0.72,
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'center',
        },
        colKg: {
          flex: 0.78,
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'center',
        },
        colReps: {
          flex: 0.88,
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'center',
        },
        colRir: {
          flex: 0.78,
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'center',
        },
        colTipo: {
          flex: 0.8,
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'center',
        },
        colCardioMain: {
          flex: 1.1,
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'center',
        },
        colCardioKm: {
          flex: 0.85,
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'center',
        },
        thTipoHeadRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        thTextTipo: {
          ...ts.caption,
          fontFamily: f.mono,
          color: c.textSecondary,
          letterSpacing: 0.5,
          textAlign: 'center',
        },
        thText: {
          ...ts.caption,
          fontFamily: f.mono,
          color: c.textSecondary,
          letterSpacing: 0.5,
          textAlign: 'center',
          width: '100%',
        },
        fila: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 4,
        },
        tdText: {
          ...ts.bodySm,
          fontFamily: f.mono,
          color: c.textDisplay,
          textAlign: 'center',
          width: '100%',
        },
        setPill: {
          minWidth: 34,
          height: 24,
          paddingHorizontal: 8,
          borderRadius: r.sm,
          backgroundColor: c.surfaceElevated,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center',
        },
        setPillText: {
          fontSize: 13,
          lineHeight: 17,
          letterSpacing: 0,
          fontFamily: f.monoBold,
          color: c.textDisplay,
          textAlign: 'center',
        },
        repsPill: {
          minWidth: 42,
          height: 24,
          paddingHorizontal: 8,
          borderRadius: r.technical,
          backgroundColor: c.surfaceElevated,
          borderWidth: 1,
          borderColor: c.borderVisible,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center',
        },
        repsPillText: {
          fontSize: 12,
          lineHeight: 16,
          letterSpacing: 0,
          fontFamily: f.sansMedium,
          color: c.textDisplay,
          textAlign: 'center',
        },
        rirValueWrap: {
          minWidth: 30,
          height: 24,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center',
        },
        badge: {
          paddingHorizontal: 4,
          paddingVertical: 2,
          borderRadius: r.technical,
          backgroundColor: c.primaryBg,
          borderWidth: 1,
          borderColor: c.primary,
        },
        badgeTxt: {
          ...ts.caption,
          fontFamily: f.monoBold,
          fontSize: 9,
          color: c.primary,
          letterSpacing: 0.3,
        },
        vacioEj: {
          ...ts.bodySm,
          fontFamily: f.sans,
          color: c.textMuted,
          fontStyle: 'italic',
        },
        centerState: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: s.lg,
          gap: s.md,
        },
        errTxt: {
          ...ts.body,
          fontFamily: f.sans,
          color: c.danger,
          textAlign: 'center',
        },
        retryBtn: {
          paddingVertical: s.sm,
          paddingHorizontal: s.lg,
          borderRadius: r.technical,
          borderWidth: 1,
          borderColor: c.primary,
          backgroundColor: c.primaryBg,
        },
        retryTxt: {
          ...ts.label,
          fontFamily: f.mono,
          color: c.primary,
          letterSpacing: 0.6,
        },
        delModalBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          paddingHorizontal: s.lg,
          position: 'relative',
        },
        delModalDismissLayer: {
          ...StyleSheet.absoluteFillObject,
        },
        delModalCard: {
          backgroundColor: c.surface,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: c.borderVisible,
          paddingHorizontal: s.md,
          paddingTop: s.lg,
          paddingBottom: s.md,
          overflow: 'hidden',
          zIndex: 1,
          maxWidth: '100%',
        },
        delModalAccent: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: c.primary,
        },
        delModalTitle: {
          ...ts.subheading,
          fontFamily: f.sansBold,
          color: c.textDisplay,
          marginBottom: s.sm,
          letterSpacing: 0,
        },
        delModalBody: {
          ...ts.body,
          fontFamily: f.sans,
          color: c.textSecondary,
          marginBottom: s.lg,
          lineHeight: 25,
        },
        delModalRow: {
          flexDirection: 'column',
          gap: s.sm,
        },
        delBtnGhost: {
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: s.md,
          borderRadius: r.sm,
          borderWidth: 1,
          borderColor: c.primary,
          backgroundColor: c.surface,
        },
        delBtnGhostTxt: {
          ...ts.body,
          fontFamily: f.sansMedium,
          color: c.primary,
          textAlign: 'center',
          letterSpacing: 0,
        },
        delBtnDanger: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: s.sm,
          minHeight: 48,
          paddingHorizontal: s.md,
          borderRadius: r.sm,
          backgroundColor: c.danger,
        },
        delBtnDangerTxt: {
          ...ts.body,
          fontFamily: f.sansBold,
          color: '#FFFFFF',
          textAlign: 'center',
          letterSpacing: 0,
        },
        tiposModalBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          paddingHorizontal: s.lg,
          position: 'relative',
        },
        tiposModalCard: {
          backgroundColor: c.surface,
          borderRadius: r.lg,
          borderWidth: 1,
          borderColor: c.borderVisible,
          padding: s.lg,
          zIndex: 1,
          maxWidth: '100%',
          maxHeight: '88%',
        },
        tiposModalHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: s.md,
          gap: s.sm,
        },
        tiposModalTitle: {
          ...ts.subheading,
          fontFamily: f.sansMedium,
          color: c.textDisplay,
          flex: 1,
        },
        tiposModalScroll: {
          maxHeight: 360,
        },
        tipoLeyendaFila: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: s.sm,
          marginBottom: s.md,
        },
        tipoLeyendaTxtCol: {
          flex: 1,
          minWidth: 0,
        },
        tipoLeyendaNombre: {
          ...ts.body,
          fontFamily: f.sansMedium,
          color: c.textDisplay,
          marginBottom: 2,
        },
        tipoLeyendaDesc: {
          ...ts.caption,
          fontFamily: f.mono,
          color: c.textSecondary,
          letterSpacing: 0.4,
        },
        tiposModalCerrar: {
          marginTop: s.md,
          paddingVertical: s.sm,
          paddingHorizontal: s.md,
          borderRadius: r.technical,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: 'transparent',
          alignItems: 'center',
        },
        tiposModalCerrarTxt: {
          ...ts.label,
          fontFamily: f.mono,
          color: c.textSecondary,
          letterSpacing: 0.5,
        },
        durModalCard: {
          backgroundColor: c.surface,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: c.borderVisible,
          paddingHorizontal: s.md,
          paddingTop: s.lg,
          paddingBottom: s.md,
          overflow: 'hidden',
          zIndex: 1,
          maxWidth: '100%',
        },
        durModalAccent: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: c.primary,
        },
        durModalTitle: {
          ...ts.subheading,
          fontFamily: f.sansBold,
          color: c.textDisplay,
          marginBottom: 4,
          letterSpacing: 0,
        },
        durModalSubtitle: {
          ...ts.caption,
          fontFamily: f.mono,
          color: c.textSecondary,
          marginBottom: s.lg,
          letterSpacing: 0.3,
        },
        durInputRow: {
          flexDirection: 'row',
          gap: s.sm,
          marginBottom: s.lg,
        },
        durInputWrap: {
          flex: 1,
        },
        durInputLbl: {
          ...ts.label,
          fontFamily: f.monoBold,
          color: c.textSecondary,
          letterSpacing: 0.7,
          marginBottom: s.xs,
        },
        durInput: {
          height: 48,
          borderRadius: r.sm,
          borderWidth: 1,
          borderColor: c.borderVisible,
          backgroundColor: c.surfaceElevated,
          paddingHorizontal: s.md,
          ...ts.body,
          fontFamily: f.mono,
          color: c.textDisplay,
          textAlign: 'center',
          letterSpacing: 1,
        },
        durInputFocused: {
          borderColor: c.primary,
        },
        durInputError: {
          borderColor: c.danger,
          color: c.danger,
        },
        durBtnRow: {
          flexDirection: 'column',
          gap: s.sm,
        },
        durBtnPrimary: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 48,
          paddingHorizontal: s.md,
          borderRadius: r.sm,
          backgroundColor: c.primary,
        },
        durBtnPrimaryTxt: {
          ...ts.body,
          fontFamily: f.sansBold,
          color: '#FFFFFF',
          textAlign: 'center',
        },
        durBtnGhost: {
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: s.md,
          borderRadius: r.sm,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: 'transparent',
        },
        durBtnGhostTxt: {
          ...ts.body,
          fontFamily: f.sansMedium,
          color: c.textSecondary,
          textAlign: 'center',
        },
      }),
    [c, f, ts, s, r, insets.bottom, insets.top],
  );

  const onAbrirModalDuracion = useCallback(() => {
    if (!detalle) return;
    setEditInicio(isoToHHMM(detalle.hora_inicio));
    setEditFin(isoToHHMM(detalle.hora_fin));
    setErrorInicio(false);
    setErrorFin(false);
    setModalDuracion(true);
  }, [detalle]);

  const onGuardarDuracion = useCallback(async () => {
    if (!detalle || !sessionId || guardandoDuracion) return;
    const inicioValido = esHoraValida(editInicio);
    const finValido = esHoraValida(editFin);
    if (!inicioValido || !finValido) {
      setErrorInicio(!inicioValido);
      setErrorFin(!finValido);
      return;
    }
    const nuevoInicio = hhmmToIso(detalle.fecha, editInicio)!;
    let nuevoFin = hhmmToIso(detalle.fecha, editFin)!;
    if (new Date(nuevoFin).getTime() <= new Date(nuevoInicio).getTime()) {
      const finSiguienteDia = new Date(nuevoFin);
      finSiguienteDia.setDate(finSiguienteDia.getDate() + 1);
      const durMs = finSiguienteDia.getTime() - new Date(nuevoInicio).getTime();
      if (durMs > 8 * 3_600_000) {
        setErrorInicio(true);
        setErrorFin(true);
        return;
      }
      nuevoFin = finSiguienteDia.toISOString();
    }
    setErrorInicio(false);
    setErrorFin(false);
    setGuardandoDuracion(true);
    try {
      await entrenamientoService.actualizarDuracionSesion(sessionId, nuevoInicio, nuevoFin);
      setDetalle((prev) =>
        prev ? { ...prev, hora_inicio: nuevoInicio, hora_fin: nuevoFin } : prev,
      );
      setModalDuracion(false);
    } catch {
      Alert.alert('Error', 'No se pudo guardar la duración.');
    } finally {
      setGuardandoDuracion(false);
    }
  }, [detalle, sessionId, editInicio, editFin, guardandoDuracion]);

  const onConfirmarEliminar = useCallback(async () => {
    if (!sessionId || eliminando) return;
    setEliminando(true);
    try {
      await entrenamientoService.eliminarSesion(sessionId);
      setModalEliminar(false);
      router.replace({
        pathname: '/(tabs)/(entrenamiento)',
        params: { reload: Date.now().toString() },
      });
    } catch {
      setEliminando(false);
      Alert.alert('Error', 'No se pudo eliminar la sesión.');
    }
  }, [sessionId, eliminando, router]);

  const tituloSesion = (detalle?.nombre ?? 'Sesión').trim() || 'Sesión';

  if (cargando && !detalle && !error) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.safe, styles.centerState]}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      </>
    );
  }

  if (error && !detalle) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.safe}>
          <View style={styles.header}>
            <Pressable
              style={styles.headerSide}
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel="Volver"
            >
              <Ionicons name="chevron-back" size={26} color={c.textDisplay} />
            </Pressable>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Sesión
            </Text>
            <View style={styles.headerSide} />
          </View>
          <View style={styles.centerState}>
            <Text style={styles.errTxt}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={cargar}>
              <Text style={styles.retryTxt}>REINTENTAR</Text>
            </Pressable>
          </View>
        </View>
      </>
    );
  }

  if (!detalle) {
    return null;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.safe}>
        <View style={styles.header}>
          <Pressable
            style={styles.headerSide}
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Ionicons name="chevron-back" size={26} color={c.textDisplay} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {tituloSesion}
          </Text>
          <View style={styles.headerSide}>
            {eliminando ? (
              <ActivityIndicator size="small" color={c.danger} />
            ) : (
              <Pressable
                onPress={() => setModalEliminar(true)}
                disabled={eliminando}
                accessibilityRole="button"
                accessibilityLabel="Eliminar entreno"
                style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
              >
                <Ionicons name="trash-outline" size={22} color={c.danger} />
              </Pressable>
            )}
          </View>
        </View>

        <Modal
          visible={modalEliminar}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!eliminando) setModalEliminar(false);
          }}
        >
          <View style={styles.delModalBackdrop}>
            <Pressable
              style={styles.delModalDismissLayer}
              onPress={() => {
                if (!eliminando) setModalEliminar(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            />
            <View style={styles.delModalCard}>
              <View style={styles.delModalAccent} />
              <Text style={styles.delModalTitle}>Eliminar entreno</Text>
              <Text style={styles.delModalBody}>
                Esta acción no se puede deshacer. Se eliminará el entreno y todos sus datos.
              </Text>
              <View style={styles.delModalRow}>
                <Pressable
                  style={styles.delBtnDanger}
                  onPress={onConfirmarEliminar}
                  disabled={eliminando}
                  accessibilityRole="button"
                >
                  {eliminando ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.delBtnDangerTxt}>ELIMINAR</Text>
                  )}
                </Pressable>
                <Pressable
                  style={styles.delBtnGhost}
                  onPress={() => {
                    if (!eliminando) setModalEliminar(false);
                  }}
                  disabled={eliminando}
                  accessibilityRole="button"
                >
                  <Text style={styles.delBtnGhostTxt}>CANCELAR</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={modalTipos}
          transparent
          animationType="fade"
          onRequestClose={() => setModalTipos(false)}
        >
          <View style={styles.tiposModalBackdrop}>
            <Pressable
              style={styles.delModalDismissLayer}
              onPress={() => setModalTipos(false)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            />
            <View style={styles.tiposModalCard}>
              <View style={styles.tiposModalHeader}>
                <Text style={styles.tiposModalTitle}>Tipos de serie</Text>
                <Pressable
                  onPress={() => setModalTipos(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar"
                  hitSlop={8}
                >
                  <Ionicons name="close" size={22} color={c.textDisplay} />
                </Pressable>
              </View>
              <ScrollView
                style={styles.tiposModalScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {TIPOS_SERIE_LEYENDA.map((row) => (
                  <View key={row.siglas} style={styles.tipoLeyendaFila}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeTxt}>{row.siglas}</Text>
                    </View>
                    <View style={styles.tipoLeyendaTxtCol}>
                      <Text style={styles.tipoLeyendaNombre}>{row.nombre}</Text>
                      <Text style={styles.tipoLeyendaDesc}>{row.desc}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <Pressable
                style={styles.tiposModalCerrar}
                onPress={() => setModalTipos(false)}
                accessibilityRole="button"
              >
                <Text style={styles.tiposModalCerrarTxt}>CERRAR</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          visible={modalDuracion}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!guardandoDuracion) setModalDuracion(false);
          }}
        >
          <View style={styles.delModalBackdrop}>
            <Pressable
              style={styles.delModalDismissLayer}
              onPress={() => {
                if (!guardandoDuracion) setModalDuracion(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            />
            <View style={styles.durModalCard}>
              <View style={styles.durModalAccent} />
              <Text style={styles.durModalTitle}>Editar duración</Text>
              <View style={styles.durInputRow}>
                <View style={styles.durInputWrap}>
                  <Text style={styles.durInputLbl}>INICIO</Text>
                  <TextInput
                    style={[styles.durInput, errorInicio && styles.durInputError]}
                    value={editInicio}
                    onChangeText={(t) => {
                      setErrorInicio(false);
                      setErrorFin(false);
                      const formatted = formatearEntradaHora(t);
                      setEditInicio(formatted);
                      if (formatted.length === 5) inputFinRef.current?.focus();
                    }}
                    placeholder="09:00"
                    placeholderTextColor={c.textMuted}
                    keyboardType="number-pad"
                    maxLength={5}
                    returnKeyType="next"
                    onSubmitEditing={() => inputFinRef.current?.focus()}
                  />
                </View>
                <View style={styles.durInputWrap}>
                  <Text style={styles.durInputLbl}>FIN</Text>
                  <TextInput
                    ref={inputFinRef}
                    style={[styles.durInput, errorFin && styles.durInputError]}
                    value={editFin}
                    onChangeText={(t) => {
                      setErrorInicio(false);
                      setErrorFin(false);
                      setEditFin(formatearEntradaHora(t));
                    }}
                    placeholder="10:00"
                    placeholderTextColor={c.textMuted}
                    keyboardType="number-pad"
                    maxLength={5}
                    returnKeyType="done"
                    onSubmitEditing={onGuardarDuracion}
                  />
                </View>
              </View>
              <View style={styles.durBtnRow}>
                <Pressable
                  style={styles.durBtnPrimary}
                  onPress={onGuardarDuracion}
                  disabled={guardandoDuracion}
                  accessibilityRole="button"
                >
                  {guardandoDuracion ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.durBtnPrimaryTxt}>GUARDAR</Text>
                  )}
                </Pressable>
                <Pressable
                  style={styles.durBtnGhost}
                  onPress={() => {
                    if (!guardandoDuracion) setModalDuracion(false);
                  }}
                  disabled={guardandoDuracion}
                  accessibilityRole="button"
                >
                  <Text style={styles.durBtnGhostTxt}>CANCELAR</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.gapHeaderMetrics} />

        <View style={styles.metricsWrap}>
          <View style={styles.metricsRow}>
            <View style={[styles.metricsCell, styles.metricsCellSepV, styles.metricsCellSepH]}>
              <View style={styles.metricsCellInner}>
                <Ionicons name="calendar-outline" size={22} color={c.primary} />
                <View style={styles.metricTextCol}>
                  <Text style={styles.metricLbl}>FECHA</Text>
                  <Text style={styles.metricValFecha}>{formatFechaCabecera(detalle.fecha)}</Text>
                </View>
              </View>
            </View>
            <Pressable
              style={[styles.metricsCell, styles.metricsCellSepH]}
              onPress={onAbrirModalDuracion}
              accessibilityRole="button"
              accessibilityLabel="Editar duración"
            >
              <View style={styles.metricsCellInner}>
                <Ionicons name="time-outline" size={22} color={c.primary} />
                <View style={styles.metricTextCol}>
                  <Text style={styles.metricLbl}>DURACIÓN</Text>
                  <Text style={styles.metricValDur} numberOfLines={1} adjustsFontSizeToFit>
                    {formatDuracionSesion(detalle.hora_inicio, detalle.hora_fin)}
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>
          <View style={styles.metricsRow}>
            <View style={[styles.metricsCell, styles.metricsCellSepV]}>
              <View style={styles.metricsCellInner}>
                <Ionicons name="flame-outline" size={22} color={c.primary} />
                <View style={styles.metricTextCol}>
                  <Text style={styles.metricLbl}>KCAL</Text>
                  <Text style={styles.metricValDescanso} numberOfLines={1}>
                    {kcalEstimadas != null ? `≈ ${kcalEstimadas}` : '—'}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.metricsCell}>
              <View style={styles.metricsCellInner}>
                <Ionicons name="hourglass-outline" size={22} color={c.primary} />
                <View style={styles.metricTextCol}>
                  <Text style={styles.metricLbl}>DESCANSO</Text>
                  <Text style={styles.metricValDescanso} numberOfLines={1}>
                    {formatDescanso(mediaDescansoSesion)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
              <Ionicons name="barbell-outline" size={16} color={c.primary} />
              <Text style={styles.sectionTitle}>EJERCICIOS</Text>
            </View>
            <Text style={styles.sectionCount}>
              {detalle.ejercicios.length} ejercicio{detalle.ejercicios.length === 1 ? '' : 's'}
            </Text>
          </View>

          {detalle.ejercicios.map((ej) => {
            const setsHechas = ej.sets.filter((st) => st.completada);
            const esCardio = esCardioDetalle(ej.tracking_mode);
            return (
              <View key={ej.id} style={styles.cardEj}>
                <View style={styles.ejRowHead}>
                  {ej.foto_url != null && ej.foto_url.trim() !== '' ? (
                    <Image
                      source={{ uri: ej.foto_url.trim() }}
                      style={styles.ejImg48}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      autoplay={false}
                      recyclingKey={ej.exercise_id}
                    />
                  ) : (
                    <View style={styles.ejImgPh}>
                      <Ionicons name="barbell-outline" size={20} color={c.textMuted} />
                    </View>
                  )}
                  <View style={styles.ejCabTextCol}>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/(tabs)/(entrenamiento)/consulta-ejercicio',
                          params: { id: ej.exercise_id },
                        })
                      }
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityLabel={`Ver ficha de ${ej.nombre}`}
                    >
                      <Text style={[styles.ejTitulo, styles.ejNombreLink]}>{ej.nombre}</Text>
                    </Pressable>
                    {ej.musculo_primario ? (
                      <Text style={styles.ejMusculo}>{ej.musculo_primario}</Text>
                    ) : null}
                  </View>
                  {mediaDescansoPorEjercicio.get(ej.id) != null && (
                    <View style={styles.ejDescansoChip}>
                      <Ionicons name="time-outline" size={12} color={c.textSecondary} />
                      <Text style={styles.ejDescansoChipTxt}>
                        {formatDescanso(mediaDescansoPorEjercicio.get(ej.id))}
                      </Text>
                    </View>
                  )}
                </View>
                {ej.notas != null && ej.notas.trim() !== '' ? (
                  <View style={styles.ejNotaFila}>
                    <Ionicons name="document-text-outline" size={14} color={c.textSecondary} />
                    <Text style={styles.ejNotaTxt}>{ej.notas.trim()}</Text>
                  </View>
                ) : null}
                {setsHechas.length === 0 ? (
                  <Text style={styles.vacioEj}>{esCardio ? 'Sin tiempo registrado' : 'Sin series registradas'}</Text>
                ) : esCardio ? (
                  <>
                    <View style={styles.tablaHead}>
                      <View style={styles.colCardioMain}>
                        <Text style={styles.thText}>TIEMPO</Text>
                      </View>
                      {ej.tracking_mode === 'cardio_time_distance' ? (
                        <View style={styles.colCardioKm}>
                          <Text style={styles.thText}>KM</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.fila}>
                      <View style={styles.colCardioMain}>
                        <Text style={styles.tdText}>{formatDuracionCardio(setsHechas[0]?.duracion_seg)}</Text>
                      </View>
                      {ej.tracking_mode === 'cardio_time_distance' ? (
                        <View style={styles.colCardioKm}>
                          <Text style={styles.tdText}>{formatKm(setsHechas[0]?.distancia_km)}</Text>
                        </View>
                      ) : null}
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.tablaHead}>
                      <View style={styles.colSerie}>
                        <Text style={styles.thText}>SERIE</Text>
                      </View>
                      <View style={styles.colReps}>
                        <Text style={styles.thText}>REPS</Text>
                      </View>
                      <View style={styles.colKg}>
                        <Text style={styles.thText}>KG</Text>
                      </View>
                      <View style={styles.colRir}>
                        <Text style={styles.thText}>RIR</Text>
                      </View>
                      <View style={styles.colTipo}>
                        <View style={styles.thTipoHeadRow}>
                          <Text style={styles.thTextTipo}>TIPO</Text>
                          <Pressable
                            onPress={() => setModalTipos(true)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel="Información sobre tipos de serie"
                          >
                            <Ionicons
                              name="information-circle-outline"
                              size={14}
                              color={c.textSecondary}
                            />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                    {setsHechas.map((st, idx) => (
                      <View key={`${ej.id}-set-${idx}`} style={styles.fila}>
                        <View style={styles.colSerie}>
                          <View style={styles.setPill}>
                            <Text style={styles.setPillText}>{st.numero_serie}</Text>
                          </View>
                        </View>
                        <View style={styles.colReps}>
                          <Text style={styles.tdText}>
                            {st.repeticiones != null ? String(st.repeticiones) : '—'}
                          </Text>
                        </View>
                        <View style={styles.colKg}>
                          <Text style={styles.tdText}>{celdaKg(st)}</Text>
                        </View>
                        <View style={styles.colRir}>
                          <View style={styles.rirValueWrap}>
                            <Text style={styles.tdText}>{celdaRir(st)}</Text>
                          </View>
                        </View>
                        <View style={styles.colTipo}>
                          <View style={styles.badge}>
                            <Text style={styles.badgeTxt}>{badgeTipoSerie(st.tipo_serie)}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </>
  );
}
