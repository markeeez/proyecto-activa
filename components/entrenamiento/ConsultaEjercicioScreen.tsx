/**
 * Consulta de ejercicio — ficha informativa (catálogo Supabase).
 */

import { Ionicons } from '@expo/vector-icons';
import { useFont } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CartesianChart, Line, Scatter } from 'victory-native';

import type { Theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { parseFechaLocal } from '@/lib/fechaNutricion';
import { supabase } from '@/lib/supabase';
import {
  progresoService,
  type EstadisticaEjercicioDia,
  type EstadisticaCardioEjercicioDia,
  type RecordsEjercicio,
  type RecordsCardioEjercicio,
  type SesionEjercicioHistorial,
} from '@/services/progreso.service';
import type { CategoriaEjercicio, Exercise, TipoSerie, TrackingMode } from '@/types/database.types';

const SPACE_MONO_CHART = require('@expo-google-fonts/space-mono/400Regular/SpaceMono_400Regular.ttf');

/** Fila devuelta por `select('*')` (puede incluir columnas extra en BD). */
type ExerciseRow = Exercise & {
  foto_url?: string | null;
  dificultad?: string | null;
};

const TAB_LABELS = ['Indicaciones', 'Estadísticas', 'Historial'] as const;
type IconName = ComponentProps<typeof Ionicons>['name'];

type PeriodoDetalle = 'trimestre' | 'anio' | 'todo';
type MetricaGrafico = 'mayorPeso' | 'oneRepMax' | 'mejorVolumenSerie' | 'totalRepeticiones';

const PERIODO_OPTS: { key: PeriodoDetalle; label: string }[] = [
  { key: 'trimestre', label: 'Últimos 3 meses' },
  { key: 'anio', label: 'Último año' },
  { key: 'todo', label: 'Todo el tiempo' },
];

function etiquetaPeriodoSeleccionado(key: PeriodoDetalle): string {
  return PERIODO_OPTS.find((p) => p.key === key)?.label ?? '';
}

const METRICA_OPTS: { key: MetricaGrafico; label: string; icon: IconName }[] = [
  { key: 'mayorPeso', label: 'Mayor peso', icon: 'scale-outline' },
  { key: 'oneRepMax', label: '1RM', icon: 'barbell-outline' },
  { key: 'mejorVolumenSerie', label: 'Vol. serie', icon: 'server-outline' },
  { key: 'totalRepeticiones', label: 'Total reps', icon: 'repeat-outline' },
];

type MetricaCardio = 'mejorTiempo' | 'distancia';
const METRICA_CARDIO_OPTS: { key: MetricaCardio; label: string; icon: IconName }[] = [
  { key: 'mejorTiempo', label: 'Mejor tiempo', icon: 'timer-outline' },
  { key: 'distancia', label: 'Distancia', icon: 'map-outline' },
];

function isCardio(trackingMode: TrackingMode | undefined): boolean {
  return trackingMode === 'cardio_time' || trackingMode === 'cardio_time_distance';
}
function hasDistancia(trackingMode: TrackingMode | undefined): boolean {
  return trackingMode === 'cardio_time_distance';
}

/** Formatea segundos → "mm:ss" o "h:mm:ss" */
function formatTiempoHMS(seg: number): string {
  const s = Math.round(seg);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/** Formatea km con 2 decimales */
function formatDistancia(km: number): string {
  return `${km.toFixed(2)} km`;
}

/** Mismo criterio que sesion/[id].tsx (badge de tipo de serie). */
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

/** Columna Kg: en consulta-ejercicio se pide "PC" para peso corporal. */
function celdaKgHistorial(tipoPeso: string, pesoKg: number | null): string {
  if (tipoPeso === 'bodyweight' && pesoKg == null) return 'PC';
  if (pesoKg == null) return '—';
  return String(pesoKg);
}

function etiquetaCategoria(cat: CategoriaEjercicio): string {
  const m: Record<CategoriaEjercicio, string> = {
    fuerza: 'Fuerza',
    cardio: 'Cardio',
    flexibilidad: 'Flexibilidad',
    otro: 'Otro',
  };
  return m[cat] ?? cat;
}

function formatoEjeFecha(iso: string): string {
  const d = parseFechaLocal(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

/** Formatea un timestamp numérico (ms) para el eje X del gráfico. */
function formatoTimestampEje(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

/** Cabecera historial: "dd MMM yyyy" y hora si existe. */
function formatoFechaHistorialCard(fechaIso: string, horaInicio: string | null): string {
  const d = parseFechaLocal(fechaIso);
  const fechaStr = new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
  if (horaInicio && /^\d{1,2}:\d{2}/.test(horaInicio)) {
    const hm = horaInicio.slice(0, 5);
    return `${fechaStr} · ${hm}`;
  }
  return fechaStr;
}

function valorMetrica(row: EstadisticaEjercicioDia, m: MetricaGrafico): number {
  switch (m) {
    case 'mayorPeso':
      return row.mayorPeso;
    case 'oneRepMax':
      return row.oneRepMax;
    case 'mejorVolumenSerie':
      return row.mejorVolumenSerie;
    case 'totalRepeticiones':
      return row.totalRepeticiones;
    default:
      return 0;
  }
}

function unidadMetrica(m: MetricaGrafico): 'kg' | 'reps' {
  return m === 'totalRepeticiones' ? 'reps' : 'kg';
}

function tituloMetrica(m: MetricaGrafico): string {
  switch (m) {
    case 'totalRepeticiones':
      return 'Repeticiones';
    case 'mejorVolumenSerie':
      return 'Volumen (kg)';
    case 'oneRepMax':
    case 'mayorPeso':
    default:
      return 'Peso (kg)';
  }
}

function colorDificultad(dificultad: string, c: Theme): string {
  const normalized = dificultad.trim().toLowerCase();
  if (normalized.includes('principiante') || normalized.includes('fácil') || normalized.includes('facil')) return c.successText;
  if (normalized.includes('intermedio') || normalized.includes('medio')) return c.warningKcal;
  if (normalized.includes('avanzado') || normalized.includes('difícil') || normalized.includes('dificil')) return c.dangerText;
  return c.textDisplay;
}

const CHART_H = 170;

function GraficoEstadisticasEjercicio({
  datos,
  metrica,
  colorPrimario,
  colorEtiqueta,
  colorGrid,
  colorFondo,
  fontMono,
  formatYLabel,
}: {
  datos: { x: number; y: number }[];
  metrica: MetricaGrafico;
  colorPrimario: string;
  colorEtiqueta: string;
  colorGrid: string;
  colorFondo: string;
  fontMono: string;
  formatYLabel?: (n: number) => string;
}) {
  const font = useFont(SPACE_MONO_CHART, 10);
  const unit = unidadMetrica(metrica);

  if (datos.length === 0) {
    return (
      <View style={[stylesChartBase.wrap, stylesChartBase.vacio]}>
        <Text style={{ fontFamily: fontMono, fontSize: 11, color: colorEtiqueta }}>[SIN DATOS]</Text>
      </View>
    );
  }

  const ys = datos.map((d) => d.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const range = maxY - minY;
  const minPad = unit === 'reps' ? 5 : 2;
  const pad = range > 0
    ? Math.max(minPad * 0.25, range * 0.15)
    : Math.max(minPad, maxY * 0.2);
  const yLow = Math.max(0, minY - pad);
  const yHigh = maxY + pad;

  const formatY = formatYLabel ?? ((n: number) => {
    if (unit === 'reps') return `${Math.round(n)} reps`;
    const v = n >= 100 ? n.toFixed(0) : n.toFixed(1);
    return `${v} kg`;
  });

  return (
    <View style={stylesChartBase.wrap}>
      <CartesianChart<{ x: number; y: number }, 'x', 'y'>
        data={datos}
        xKey="x"
        yKeys={['y']}
        domain={{ y: [yLow, yHigh] }}
        domainPadding={{ left: 8, right: 12, top: 20, bottom: 28 }}
        axisOptions={
          font
            ? {
                font,
                tickCount: { x: 6, y: 5 },
                formatXLabel: (v) => formatoTimestampEje(Number(v)),
                formatYLabel: (v) => formatY(Number(v)),
                labelColor: { x: colorEtiqueta, y: colorEtiqueta },
                lineColor: {
                  grid: { x: colorFondo, y: colorGrid },
                  frame: colorGrid,
                },
                lineWidth: {
                  grid: { x: 0, y: StyleSheet.hairlineWidth },
                  frame: StyleSheet.hairlineWidth,
                },
              }
            : undefined
        }
      >
        {({ points }) => (
          <>
            <Line points={points.y} color={colorPrimario} strokeWidth={2} curveType="natural" />
            <Scatter points={points.y} color={colorPrimario} radius={4} shape="circle" />
          </>
        )}
      </CartesianChart>
    </View>
  );
}

const stylesChartBase = StyleSheet.create({
  wrap: { height: CHART_H, width: '100%', marginTop: 4 },
  vacio: { justifyContent: 'center', alignItems: 'center' },
});

function makeStyles(
  c: Theme,
  f: ReturnType<typeof useTheme>['f'],
  ts: ReturnType<typeof useTheme>['ts'],
  s: ReturnType<typeof useTheme>['s'],
  r: ReturnType<typeof useTheme>['r'],
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s.sm,
      paddingBottom: s.xs,
      minHeight: 58,
      backgroundColor: c.background,
    },
    headerBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      ...ts.subheading,
      fontSize: 17,
      lineHeight: 21,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      textAlign: 'center',
    },
    tabRow: {
      flexDirection: 'row',
      backgroundColor: c.background,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    tabBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: s.xs,
      paddingBottom: 9,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabBtnActive: {
      borderBottomColor: c.primary,
    },
    tabTxt: {
      ...ts.body,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
    },
    tabTxtActive: {
      color: c.primary,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: 18,
      paddingBottom: s.xl,
    },
    heroWrap: {
      marginHorizontal: 14,
      height: 174,
      borderRadius: r.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: '#FFFFFF',
      justifyContent: 'center',
    },
    heroImg: {
      width: '100%',
      height: '100%',
      backgroundColor: '#FFFFFF',
    },
    heroPlaceholder: {
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    expandBtn: {
      position: 'absolute',
      right: s.sm,
      bottom: s.sm,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.34)',
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: r.sm,
      marginHorizontal: 14,
      marginTop: 22,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    statRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 44,
      paddingHorizontal: s.md,
      paddingVertical: 10,
      gap: 12,
    },
    statIconBox: {
      width: 30,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    statLabel: {
      flex: 1,
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    statValue: {
      flex: 0.95,
      ...ts.bodySm,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      textAlign: 'right',
    },
    statSep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
    },
    descBlock: {
      marginHorizontal: 18,
      marginTop: 22,
    },
    descTitle: {
      ...ts.bodySm,
      fontFamily: f.sansBold,
      color: c.primary,
      marginBottom: 6,
    },
    descBody: {
      fontSize: 15,
      lineHeight: 24,
      fontFamily: f.sans,
      color: c.text,
    },
    imageModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.96)',
      paddingHorizontal: s.md,
    },
    imageModalHeader: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    imageModalContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: s.xl,
    },
    imageModalImage: {
      width: '100%',
      height: '76%',
    },
    centerMsg: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: s.lg,
    },
    loadingTxt: {
      fontFamily: f.mono,
      color: c.textSecondary,
    },
    errorTxt: {
      fontFamily: f.mono,
      color: c.primary,
    },
    periodoBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      marginHorizontal: 20,
      marginTop: 2,
      paddingLeft: 14,
      paddingRight: 12,
      paddingVertical: 9,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
    },
    periodoBtnTxt: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    filtroModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    filtroSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: r.lg,
      borderTopRightRadius: r.lg,
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    filtroTitle: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      padding: s.md,
      letterSpacing: 0.7,
    },
    filtroItem: {
      paddingVertical: s.md,
      paddingHorizontal: s.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    filtroItemTxt: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
    },
    chipsScroll: {
      marginTop: 10,
      maxHeight: 66,
    },
    chipsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 2,
      gap: 12,
    },
    chipsRowCardio: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 10,
      marginHorizontal: 14,
      gap: 12,
    },
    chipCardio: {
      flex: 1,
      height: 58,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    chip: {
      width: 78,
      height: 58,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    chipOn: {
      borderColor: c.primary,
      borderWidth: 1.5,
    },
    chipTxt: {
      fontSize: 12,
      lineHeight: 15,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
      textAlign: 'center',
    },
    chipTxtOn: {
      color: c.textDisplay,
    },
    chartBlock: {
      marginHorizontal: 14,
      marginTop: 10,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 0,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    chartTitle: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    recordsTitle: {
      ...ts.bodySm,
      fontSize: 12,
      lineHeight: 16,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
      textTransform: 'uppercase',
      marginTop: 14,
      marginHorizontal: 20,
    },
    recordsCard: {
      marginHorizontal: 20,
      marginTop: 8,
      gap: 8,
    },
    recordItem: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 7,
      backgroundColor: c.surface,
      borderRadius: r.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    recordIconBox: {
      width: 40,
      height: 40,
      borderRadius: r.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primaryBg,
    },
    recordLabel: {
      flex: 1,
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    recordValue: {
      ...ts.bodySm,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      textAlign: 'right',
    },
    histCard: {
      backgroundColor: c.surface,
      borderRadius: r.md,
      marginHorizontal: 14,
      marginBottom: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      overflow: 'hidden',
    },
    histHeaderPress: {
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 6,
    },
    histTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: s.sm,
    },
    histDatePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: r.pill,
      backgroundColor: c.surfaceElevated,
    },
    histFecha: {
      fontSize: 10,
      lineHeight: 13,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
    },
    histNombre: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      marginTop: 8,
    },
    histTablaHead: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingTop: 6,
      paddingBottom: 4,
    },
    histColSerie: {
      flex: 0.48,
      minWidth: 0,
      alignItems: 'flex-start',
    },
    histColTipo: {
      flex: 0.72,
      minWidth: 0,
      alignItems: 'center',
    },
    histColKg: {
      flex: 0.72,
      minWidth: 0,
      alignItems: 'center',
    },
    histColReps: {
      flex: 0.75,
      minWidth: 0,
      alignItems: 'center',
    },
    histColRir: {
      flex: 0.64,
      minWidth: 0,
      alignItems: 'flex-end',
    },
    histThWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      width: '100%',
    },
    histTh: {
      fontSize: 9,
      lineHeight: 12,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
      textTransform: 'uppercase',
      textAlign: 'center',
    },
    histFila: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 40,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    histFilaSep: {
      borderTopWidth: 0,
    },
    histTd: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      textAlign: 'center',
      width: '100%',
    },
    histTdLeft: {
      textAlign: 'left',
    },
    histBadge: {
      minWidth: 22,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      paddingVertical: 3,
      borderRadius: r.technical,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: c.primary,
    },
    histBadgeTxt: {
      ...ts.caption,
      fontFamily: f.monoBold,
      fontSize: 9,
      color: c.primary,
      letterSpacing: 0.3,
    },
    histRirPill: {
      minWidth: 30,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 4,
      borderRadius: r.sm,
      backgroundColor: c.surfaceElevated,
    },
    histRirTxt: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: f.sansBold,
      color: c.textSecondary,
    },
    emptyHist: {
      padding: s.xl,
      paddingTop: s.xl * 2,
      alignItems: 'center',
    },
    emptyHistTxt: {
      fontFamily: f.mono,
      color: c.textSecondary,
      fontSize: 11,
    },
    skeletonBox: {
      borderRadius: r.md,
      backgroundColor: c.surfaceElevated,
    },
  });
}

function SkeletonEstadisticas({ styles, s, r, c }: {
  styles: ReturnType<typeof makeStyles>;
  s: ReturnType<typeof useTheme>['s'];
  r: ReturnType<typeof useTheme>['r'];
  c: ReturnType<typeof useTheme>['c'];
}) {
  return (
    <View style={{ paddingTop: 18, paddingHorizontal: 14, gap: 12 }}>
      {/* Botón período */}
      <View style={[styles.skeletonBox, { height: 40, width: 180, borderRadius: r.pill }]} />

      {/* Bloque gráfico */}
      <View style={[styles.skeletonBox, { height: CHART_H + 20, borderRadius: r.md }]} />

      {/* Chips de métrica */}
      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.skeletonBox, { width: 78, height: 58, borderRadius: r.md }]} />
        ))}
      </View>

      {/* Título records */}
      <View style={[styles.skeletonBox, { height: 14, width: 140, marginTop: 6, marginHorizontal: 6 }]} />

      {/* Filas records */}
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.skeletonBox, { height: 48, borderRadius: r.md }]} />
      ))}
    </View>
  );
}

export default function ConsultaEjercicioPantalla() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { user } = useAuth();
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const sheetMaxH = Math.min(screenHeight * 0.42, 340);
  const sheetPadBottom = insets.bottom;

  const [ejercicio, setEjercicio] = useState<ExerciseRow | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const [tab, setTab] = useState(0);
  const [periodo, setPeriodo] = useState<PeriodoDetalle>('trimestre');
  const [metrica, setMetrica] = useState<MetricaGrafico>('mayorPeso');
  const [modalPeriodo, setModalPeriodo] = useState(false);
  const [modalImagen, setModalImagen] = useState(false);

  const [statsRows, setStatsRows] = useState<EstadisticaEjercicioDia[]>([]);
  const [statsCardioRows, setStatsCardioRows] = useState<EstadisticaCardioEjercicioDia[]>([]);
  const [cargandoStats, setCargandoStats] = useState(false);

  const [records, setRecords] = useState<RecordsEjercicio | null>(null);
  const [recordsCardio, setRecordsCardio] = useState<RecordsCardioEjercicio | null>(null);
  const [cargandoRecords, setCargandoRecords] = useState(false);
  const recordsCargadosParaEjercicio = useRef<string | null>(null);

  const [metricaCardio, setMetricaCardio] = useState<MetricaCardio>('mejorTiempo');

  const [historial, setHistorial] = useState<SesionEjercicioHistorial[]>([]);
  const [cargandoHist, setCargandoHist] = useState(false);

  useEffect(() => {
    if (!id) {
      setCargando(false);
      setError(true);
      return;
    }

    let cancelled = false;
    setCargando(true);
    setError(false);

    void (async () => {
      const { data, error: err } = await supabase.from('exercises').select('*').eq('id', id).single();

      if (cancelled) return;

      if (err || !data) {
        setError(true);
        setEjercicio(null);
      } else {
        setEjercicio(data as ExerciseRow);
      }
      setCargando(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    recordsCargadosParaEjercicio.current = null;
    setRecords(null);
    setRecordsCardio(null);
  }, [id]);

  useEffect(() => {
    if (tab !== 1 || !user?.id || !id || !ejercicio) return;
    if (recordsCargadosParaEjercicio.current === id) return;

    const esCardio = isCardio(ejercicio.tracking_mode);
    setCargandoRecords(true);
    void (async () => {
      try {
        if (esCardio) {
          const rec = await progresoService.obtenerRecordsCardioEjercicio(id, user.id);
          setRecordsCardio(rec);
        } else {
          const rec = await progresoService.obtenerRecordsEjercicio(id, user.id);
          setRecords(rec);
        }
        recordsCargadosParaEjercicio.current = id;
      } catch {
        setRecords(null);
        setRecordsCardio(null);
        recordsCargadosParaEjercicio.current = id;
      } finally {
        setCargandoRecords(false);
      }
    })();
  }, [tab, id, user?.id, ejercicio]);

  useEffect(() => {
    if (tab !== 1 || !user?.id || !id || !ejercicio) return;

    const esCardio = isCardio(ejercicio.tracking_mode);
    setCargandoStats(true);
    let cancelled = false;

    void (async () => {
      try {
        if (esCardio) {
          const rows = await progresoService.obtenerEstadisticasCardioDetalle(id, user.id, periodo);
          if (!cancelled) setStatsCardioRows(rows);
        } else {
          const rows = await progresoService.obtenerEstadisticasEjercicioDetalle(id, user.id, periodo);
          if (!cancelled) setStatsRows(rows);
        }
      } catch {
        if (!cancelled) { setStatsRows([]); setStatsCardioRows([]); }
      } finally {
        if (!cancelled) setCargandoStats(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, id, user?.id, periodo, ejercicio]);

  const cargarHistorial = useCallback(async () => {
    if (!id || !user?.id) return;
    setCargandoHist(true);
    try {
      const rows = await progresoService.obtenerHistorialEjercicio(id, user.id);
      setHistorial(rows);
    } catch {
      setHistorial([]);
    } finally {
      setCargandoHist(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    if (tab !== 2 || !id || !user?.id) return;
    void cargarHistorial();
  }, [tab, id, user?.id, cargarHistorial]);

  const datosGrafico = useMemo(() => {
    return statsRows.map((row) => ({
      x: parseFechaLocal(row.fecha).getTime(),
      y: valorMetrica(row, metrica),
    }));
  }, [statsRows, metrica]);

  const datosGraficoCardio = useMemo(() => {
    return statsCardioRows.map((row) => ({
      x: parseFechaLocal(row.fecha).getTime(),
      y: metricaCardio === 'mejorTiempo' ? row.mejorTiempoSeg : row.mayorDistanciaKm,
    }));
  }, [statsCardioRows, metricaCardio]);

  const esCardio = isCardio(ejercicio?.tracking_mode);
  const conDistancia = hasDistancia(ejercicio?.tracking_mode);

  const secundariosTxt = ejercicio?.musculos_secundarios?.length
    ? ejercicio.musculos_secundarios.join(' · ')
    : '—';

  const equipTxt = (ejercicio?.equipamiento ?? '').trim() || '—';
  const dificultadTxt = (ejercicio?.dificultad ?? '').trim() || '—';

  const fotoUri = ejercicio?.foto_url?.trim() ?? '';
  const infoRows: { icon: IconName; label: string; value: string; valueColor?: string }[] = ejercicio
    ? [
        { icon: 'body-outline', label: 'Músculo principal', value: ejercicio.musculo_primario },
        { icon: 'person-outline', label: 'Músculos secundarios', value: secundariosTxt },
        { icon: 'barbell-outline', label: 'Equipamiento', value: equipTxt },
        { icon: 'stats-chart-outline', label: 'Dificultad', value: dificultadTxt, valueColor: colorDificultad(dificultadTxt, c) },
        { icon: 'flash-outline', label: 'Categoría', value: etiquetaCategoria(ejercicio.categoria) },
      ]
    : [];

  const renderHistorialItem = useCallback(
    ({ item }: { item: SesionEjercicioHistorial }) => (
      <View style={styles.histCard}>
        <Pressable
          style={styles.histHeaderPress}
          onPress={() => router.push(`/(tabs)/(entrenamiento)/sesion/${item.sessionId}`)}
          accessibilityRole="button"
          accessibilityLabel="Abrir sesión"
        >
          <View style={styles.histTopRow}>
            <View style={styles.histDatePill}>
              <Ionicons name="calendar-outline" size={12} color={c.textSecondary} />
              <Text style={styles.histFecha} numberOfLines={1}>
                {formatoFechaHistorialCard(item.fecha, item.horaInicio)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
          </View>
          {item.sessionNombre ? (
            <Text style={styles.histNombre} numberOfLines={2}>
              {item.sessionNombre}
            </Text>
          ) : null}
        </Pressable>

        {esCardio ? (
          // ── Cardio historial table ──────────────────────────────────────
          <>
            <View style={styles.histTablaHead}>
              <View style={styles.histColSerie}>
                <Text style={[styles.histTh, styles.histTdLeft]}>#</Text>
              </View>
              <View style={[styles.histColKg, { flex: 1.4 }]}>
                <View style={styles.histThWrap}>
                  <Ionicons name="timer-outline" size={11} color={c.textSecondary} />
                  <Text style={styles.histTh}>TIEMPO</Text>
                </View>
              </View>
              {conDistancia ? (
                <View style={[styles.histColReps, { flex: 1.2 }]}>
                  <View style={styles.histThWrap}>
                    <Ionicons name="map-outline" size={11} color={c.textSecondary} />
                    <Text style={styles.histTh}>KM</Text>
                  </View>
                </View>
              ) : null}
            </View>
            {item.sets.map((st, idx) => (
              <View key={`${item.sessionId}-${st.numeroSerie}-${idx}`} style={[styles.histFila, idx > 0 && styles.histFilaSep]}>
                <View style={styles.histColSerie}>
                  <Text style={[styles.histTd, styles.histTdLeft]}>{st.numeroSerie}</Text>
                </View>
                <View style={[styles.histColKg, { flex: 1.4 }]}>
                  <Text style={styles.histTd}>
                    {st.duracionSeg != null ? formatTiempoHMS(st.duracionSeg) : '—'}
                  </Text>
                </View>
                {conDistancia ? (
                  <View style={[styles.histColReps, { flex: 1.2 }]}>
                    <Text style={styles.histTd}>
                      {st.distanciaKm != null ? st.distanciaKm.toFixed(2) : '—'}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </>
        ) : (
          // ── Fuerza historial table ──────────────────────────────────────
          <>
            <View style={styles.histTablaHead}>
              <View style={styles.histColSerie}>
                <Text style={[styles.histTh, styles.histTdLeft]}>#</Text>
              </View>
              <View style={styles.histColTipo}>
                <Text style={styles.histTh}>TIPO</Text>
              </View>
              <View style={styles.histColKg}>
                <View style={styles.histThWrap}>
                  <Ionicons name="scale-outline" size={11} color={c.textSecondary} />
                  <Text style={styles.histTh}>KG</Text>
                </View>
              </View>
              <View style={styles.histColReps}>
                <View style={styles.histThWrap}>
                  <Ionicons name="refresh-outline" size={11} color={c.textSecondary} />
                  <Text style={styles.histTh}>REPS</Text>
                </View>
              </View>
              <View style={styles.histColRir}>
                <View style={styles.histThWrap}>
                  <Ionicons name="disc-outline" size={10} color={c.textSecondary} />
                  <Text style={styles.histTh}>RIR</Text>
                </View>
              </View>
            </View>
            {item.sets.map((st, idx) => (
              <View key={`${item.sessionId}-${st.numeroSerie}-${idx}`} style={[styles.histFila, idx > 0 && styles.histFilaSep]}>
                <View style={styles.histColSerie}>
                  <Text style={[styles.histTd, styles.histTdLeft]}>{st.numeroSerie}</Text>
                </View>
                <View style={styles.histColTipo}>
                  <View style={styles.histBadge}>
                    <Text style={styles.histBadgeTxt}>{badgeTipoSerie(st.tipoSerie as TipoSerie)}</Text>
                  </View>
                </View>
                <View style={styles.histColKg}>
                  <Text style={styles.histTd}>{celdaKgHistorial(st.tipoPeso, st.pesoKg)}</Text>
                </View>
                <View style={styles.histColReps}>
                  <Text style={styles.histTd}>{st.repeticiones != null ? String(st.repeticiones) : '—'}</Text>
                </View>
                <View style={styles.histColRir}>
                  <View style={styles.histRirPill}>
                    <Text style={styles.histRirTxt}>-</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </View>
    ),
    [c.textMuted, c.textSecondary, conDistancia, esCardio, router, styles],
  );

  if (cargando) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.root, { paddingTop: insets.top }]}>
          <View style={styles.centerMsg}>
            <View style={{ padding: s.lg, alignItems: 'center' }}>
              <ActivityIndicator color={c.primary} />
            </View>
          </View>
        </View>
      </>
    );
  }

  if (error || !ejercicio) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.root, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Pressable style={styles.headerBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver">
              <Ionicons name="chevron-back" size={26} color={c.textDisplay} />
            </Pressable>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Ejercicio
            </Text>
            <View style={styles.headerBtn} />
          </View>
          <View style={styles.centerMsg}>
            <Text style={styles.errorTxt}>[ERROR AL CARGAR]</Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={26} color={c.textDisplay} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {ejercicio.nombre}
          </Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.tabRow}>
          {TAB_LABELS.map((label, i) => (
            <Pressable
              key={label}
              style={[styles.tabBtn, tab === i && styles.tabBtnActive]}
              onPress={() => setTab(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === i }}
            >
              <Text style={[styles.tabTxt, tab === i && styles.tabTxtActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 0 ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + s.md }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {fotoUri ? (
              <View style={styles.heroWrap}>
                <Image
                  source={{ uri: fotoUri }}
                  style={styles.heroImg}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  autoplay
                />
                <Pressable
                  style={styles.expandBtn}
                  onPress={() => setModalImagen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Ampliar imagen"
                >
                  <Ionicons name="expand-outline" size={18} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : (
              <View style={[styles.heroWrap, styles.heroPlaceholder]}>
                <Ionicons name="barbell-outline" size={48} color={c.textMuted} />
              </View>
            )}

            <View style={styles.card}>
              {infoRows.map((row, index) => (
                <View key={row.label}>
                  {index > 0 ? <View style={styles.statSep} /> : null}
                  <View style={styles.statRow}>
                    <View style={styles.statIconBox}>
                      <Ionicons name={row.icon} size={24} color={c.primary} />
                    </View>
                    <Text style={styles.statLabel}>{row.label}</Text>
                    <Text style={[styles.statValue, row.valueColor ? { color: row.valueColor } : null]} numberOfLines={2}>
                      {row.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {ejercicio.descripcion != null && ejercicio.descripcion.trim() !== '' ? (
              <View style={styles.descBlock}>
                <Text style={styles.descTitle}>Descripción</Text>
                <Text style={styles.descBody}>{ejercicio.descripcion.trim()}</Text>
              </View>
            ) : null}
          </ScrollView>
        ) : null}

        {tab === 1 ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + s.md }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!user?.id ? (
              <View style={styles.centerMsg}>
                <Text style={styles.loadingTxt}>[SIN DATOS]</Text>
              </View>
            ) : cargandoStats || cargandoRecords ? (
              <SkeletonEstadisticas styles={styles} s={s} r={r} c={c} />
            ) : esCardio ? (
              // ── Cardio stats ──────────────────────────────────────────────
              recordsCargadosParaEjercicio.current === id && statsCardioRows.length === 0 && (recordsCardio == null || (recordsCardio.mejorTiempoSeg === 0 && recordsCardio.mayorDistanciaKm === 0)) ? (
                <View style={[styles.centerMsg, { flex: 1, gap: 14 }]}>
                  <Ionicons name="timer-outline" size={48} color={c.textMuted} />
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <Text style={{ textAlign: 'center', fontSize: 16, lineHeight: 22, fontFamily: f.sansBold, color: c.textDisplay }}>
                      Aún no has entrenado este ejercicio
                    </Text>
                    <Text style={{ textAlign: 'center', fontSize: 14, lineHeight: 20, fontFamily: f.sans, color: c.textSecondary }}>
                      Añádelo a tu próxima sesión y aquí verás tu progreso.
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  <Pressable style={styles.periodoBtn} onPress={() => setModalPeriodo(true)} accessibilityRole="button">
                    <Ionicons name="calendar-outline" size={18} color={c.textDisplay} />
                    <Text style={styles.periodoBtnTxt} numberOfLines={1}>
                      {etiquetaPeriodoSeleccionado(periodo)}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={c.textSecondary} />
                  </Pressable>

                  <View style={styles.chartBlock}>
                    <Text style={styles.chartTitle}>
                      {metricaCardio === 'mejorTiempo' ? 'Tiempo' : 'Distancia (km)'}
                    </Text>
                    <GraficoEstadisticasEjercicio
                      datos={datosGraficoCardio}
                      metrica="mayorPeso"
                      colorPrimario={c.primary}
                      colorEtiqueta={c.textSecondary}
                      colorGrid={c.border}
                      colorFondo={c.background}
                      fontMono={f.mono}
                      formatYLabel={metricaCardio === 'mejorTiempo'
                        ? (n) => formatTiempoHMS(n)
                        : (n) => `${n.toFixed(2)} km`}
                    />
                  </View>

                  {conDistancia ? (
                    <View style={styles.chipsRowCardio}>
                      {METRICA_CARDIO_OPTS.map((m) => {
                        const on = metricaCardio === m.key;
                        return (
                          <Pressable key={m.key} style={[styles.chipCardio, on && styles.chipOn]} onPress={() => setMetricaCardio(m.key)}>
                            <Ionicons name={m.icon} size={24} color={on ? c.primary : c.textDisplay} />
                            <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{m.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}

                  <Text style={styles.recordsTitle}>RECORDS PERSONALES</Text>
                  <View style={styles.recordsCard}>
                    <View style={styles.recordItem}>
                      <View style={styles.recordIconBox}>
                        <Ionicons name="timer-outline" size={19} color={c.primary} />
                      </View>
                      <Text style={styles.recordLabel}>Mejor tiempo</Text>
                      <Text style={styles.recordValue}>
                        {recordsCardio && recordsCardio.mejorTiempoSeg > 0 ? formatTiempoHMS(recordsCardio.mejorTiempoSeg) : '—'}
                      </Text>
                    </View>
                    {conDistancia ? (
                      <View style={styles.recordItem}>
                        <View style={styles.recordIconBox}>
                          <Ionicons name="map-outline" size={19} color={c.primary} />
                        </View>
                        <Text style={styles.recordLabel}>Mayor distancia</Text>
                        <Text style={styles.recordValue}>
                          {recordsCardio && recordsCardio.mayorDistanciaKm > 0 ? formatDistancia(recordsCardio.mayorDistanciaKm) : '—'}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </>
              )
            ) : (
              // ── Fuerza stats ──────────────────────────────────────────────
              recordsCargadosParaEjercicio.current === id && statsRows.length === 0 && (records == null || (records.mayorPeso === 0 && records.mejorVolumenTotal === 0)) ? (
                <View style={[styles.centerMsg, { flex: 1, gap: 14 }]}>
                  <Ionicons name="barbell-outline" size={48} color={c.textMuted} />
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <Text style={{ textAlign: 'center', fontSize: 16, lineHeight: 22, fontFamily: f.sansBold, color: c.textDisplay }}>
                      Aún no has entrenado este ejercicio
                    </Text>
                    <Text style={{ textAlign: 'center', fontSize: 14, lineHeight: 20, fontFamily: f.sans, color: c.textSecondary }}>
                      Añádelo a tu próxima sesión y aquí verás tu progreso.
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  <Pressable style={styles.periodoBtn} onPress={() => setModalPeriodo(true)} accessibilityRole="button">
                    <Ionicons name="calendar-outline" size={18} color={c.textDisplay} />
                    <Text style={styles.periodoBtnTxt} numberOfLines={1}>
                      {etiquetaPeriodoSeleccionado(periodo)}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={c.textSecondary} />
                  </Pressable>

                  <View style={styles.chartBlock}>
                    <Text style={styles.chartTitle}>{tituloMetrica(metrica)}</Text>
                    <GraficoEstadisticasEjercicio
                      datos={datosGrafico}
                      metrica={metrica}
                      colorPrimario={c.primary}
                      colorEtiqueta={c.textSecondary}
                      colorGrid={c.border}
                      colorFondo={c.background}
                      fontMono={f.mono}
                    />
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsRow}>
                    {METRICA_OPTS.map((m) => {
                      const on = metrica === m.key;
                      return (
                        <Pressable key={m.key} style={[styles.chip, on && styles.chipOn]} onPress={() => setMetrica(m.key)}>
                          <Ionicons name={m.icon} size={24} color={on ? c.primary : c.textDisplay} />
                          <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{m.label}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <Text style={styles.recordsTitle}>RECORDS PERSONALES</Text>
                  <View style={styles.recordsCard}>
                    <View style={styles.recordItem}>
                      <View style={styles.recordIconBox}>
                        <Ionicons name="scale-outline" size={19} color={c.primary} />
                      </View>
                      <Text style={styles.recordLabel}>Mayor peso</Text>
                      <Text style={styles.recordValue}>{records ? `${records.mayorPeso.toFixed(1)} kg` : '0.0 kg'}</Text>
                    </View>
                    <View style={styles.recordItem}>
                      <View style={styles.recordIconBox}>
                        <Ionicons name="trending-up-outline" size={19} color={c.primary} />
                      </View>
                      <Text style={styles.recordLabel}>Mejor serie</Text>
                      <Text style={styles.recordValue}>
                        {records ? `${records.mejorSeriePesoKg.toFixed(1)} kg × ${records.mejorSerieReps} reps` : '0.0 kg × 0 reps'}
                      </Text>
                    </View>
                    <View style={styles.recordItem}>
                      <View style={styles.recordIconBox}>
                        <Ionicons name="stats-chart-outline" size={19} color={c.primary} />
                      </View>
                      <Text style={styles.recordLabel}>Volumen total</Text>
                      <Text style={styles.recordValue}>{records ? `${records.mejorVolumenTotal.toFixed(1)} kg` : '0.0 kg'}</Text>
                    </View>
                  </View>
                </>
              )
            )}
          </ScrollView>
        ) : null}

        {tab === 2 ? (
          !user?.id ? (
            <View style={[styles.centerMsg, { flex: 1 }]}>
              <Text style={styles.emptyHistTxt}>[SIN HISTORIAL]</Text>
            </View>
          ) : cargandoHist ? (
            <View style={[styles.centerMsg, { flex: 1 }]}>
              <View style={{ padding: s.lg, alignItems: 'center' }}>
                <ActivityIndicator color={c.primary} />
              </View>
            </View>
          ) : (
            <FlatList
              data={historial}
              keyExtractor={(it) => it.sessionId}
              renderItem={renderHistorialItem}
              contentContainerStyle={{
                paddingTop: 14,
                paddingBottom: insets.bottom + 14,
                flexGrow: 1,
              }}
              ListEmptyComponent={
                <View style={[styles.emptyHist, { gap: 14 }]}>
                  <Ionicons name="barbell-outline" size={48} color={c.textMuted} />
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <Text style={{ textAlign: 'center', fontSize: 16, lineHeight: 22, fontFamily: f.sansBold, color: c.textDisplay }}>
                      Aún no has entrenado este ejercicio
                    </Text>
                    <Text style={{ textAlign: 'center', fontSize: 14, lineHeight: 20, fontFamily: f.sans, color: c.textSecondary }}>
                      Añádelo a tu próxima sesión y aquí verás tu historial.
                    </Text>
                  </View>
                </View>
              }
              showsVerticalScrollIndicator={false}
            />
          )
        ) : null}
      </View>

      <Modal visible={modalPeriodo} transparent animationType="fade" onRequestClose={() => setModalPeriodo(false)}>
        <Pressable style={styles.filtroModalOverlay} onPress={() => setModalPeriodo(false)}>
          <Pressable
            style={[styles.filtroSheet, { maxHeight: sheetMaxH, paddingBottom: sheetPadBottom }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.filtroTitle}>PERÍODO</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {PERIODO_OPTS.map((p) => (
                <Pressable
                  key={p.key}
                  style={styles.filtroItem}
                  onPress={() => {
                    setPeriodo(p.key);
                    setModalPeriodo(false);
                  }}
                >
                  <Text style={styles.filtroItemTxt}>{p.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={modalImagen} transparent animationType="fade" onRequestClose={() => setModalImagen(false)}>
        <View style={[styles.imageModalOverlay, { paddingTop: insets.top }]}>
          <View style={styles.imageModalHeader}>
            <Pressable
              style={styles.headerBtn}
              onPress={() => setModalImagen(false)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar imagen"
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>
          </View>
          <Pressable style={styles.imageModalContent} onPress={() => setModalImagen(false)}>
            {fotoUri ? (
              <Image source={{ uri: fotoUri }} style={styles.imageModalImage} contentFit="contain" cachePolicy="memory-disk" autoplay />
            ) : null}
          </Pressable>
        </View>
      </Modal>
    </>
  );
}
