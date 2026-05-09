import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFont } from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bar, CartesianChart, Line } from 'victory-native';

import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';
import { fechaHoyIsoLocal, parseFechaLocal } from '@/lib/fechaNutricion';
import { normalizarTexto } from '@/lib/texto';
import { ejerciciosService } from '@/services/ejercicios.service';
import {
  fechaInicioRangoProgreso,
  progresoService,
  type DistribucionMuscular,
  type EjercicioResumen,
  type EstadisticasCardio,
  type EstadisticasEjercicio,
  type SesionCardioStats,
  type SesionEjercicioStats,
} from '@/services/progreso.service';

const SPACE_MONO_CHART = require('@expo-google-fonts/space-mono/400Regular/SpaceMono_400Regular.ttf');

type VistaEstado = 'lista' | 'detalle';
type PeriodoStats = '7d' | '3m' | '1y';
type IoniconName = ComponentProps<typeof Ionicons>['name'];

const PERIODO_LABELS: Record<PeriodoStats, string> = {
  '7d': '7 días',
  '3m': '3 meses',
  '1y': '1 año',
};

type InfoGrafico = {
  titulo: string;
  descripcion: string;
};

const INFO_GRAFICOS: Record<'peso' | 'volumen' | 'reps' | 'series', InfoGrafico> = {
  peso: {
    titulo: 'Mejor peso',
    descripcion: 'El peso más alto levantado en una sola serie durante cada sesión. Refleja tu progreso de fuerza máxima.',
  },
  volumen: {
    titulo: 'Volumen',
    descripcion: 'Suma de (peso × repeticiones) de todas las series completadas en cada sesión. Indica el trabajo total realizado.',
  },
  reps: {
    titulo: 'Mejor reps',
    descripcion: 'El número máximo de repeticiones conseguidas en una sola serie durante cada sesión.',
  },
  series: {
    titulo: 'Series',
    descripcion: 'Número total de series completadas del ejercicio en cada sesión.',
  },
};

const INFO_GRAFICOS_CARDIO: Record<'tiempo' | 'distancia' | 'tiempoTotal' | 'series', InfoGrafico> = {
  tiempo: {
    titulo: 'Mejor tiempo',
    descripcion: 'La serie de mayor duración completada en cada sesión. Refleja tu mejor esfuerzo continuo.',
  },
  tiempoTotal: {
    titulo: 'Tiempo total',
    descripcion: 'Suma de la duración de todas las series completadas en cada sesión.',
  },
  distancia: {
    titulo: 'Mejor distancia',
    descripcion: 'La distancia más alta registrada en una sola serie durante cada sesión.',
  },
  series: {
    titulo: 'Series',
    descripcion: 'Número total de series completadas del ejercicio en cada sesión.',
  },
};

function formatearTiempo(seg: number): string {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = Math.floor(seg % 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

function estiloNivelEjercicio(
  nivelRaw: string | null,
  c: Theme,
): { label: string; color: string; dot: string } | null {
  const label = (nivelRaw ?? '').trim();
  if (!label) return null;
  const n = normalizarTexto(label);
  if (n.includes('basico') || n.includes('principiante') || n.includes('facil')) {
    return { label: 'Básico', color: c.successText, dot: c.success };
  }
  if (n.includes('intermedio') || n.includes('medio')) {
    return { label, color: c.warningText, dot: c.warning };
  }
  if (n.includes('avanzado') || n.includes('dificil')) {
    return { label, color: c.dangerText, dot: c.danger };
  }
  return { label, color: c.textSecondary, dot: c.textMuted };
}

function fusionarPorFecha(rows: SesionEjercicioStats[]): SesionEjercicioStats[] {
  const m = new Map<string, { mejorPeso: number | null; volumen: number; mejorReps: number | null; series: number }>();
  const maxN = (a: number | null, b: number | null): number | null => {
    const xs = [a, b].filter((x): x is number => x != null && !Number.isNaN(x));
    return xs.length ? Math.max(...xs) : null;
  };
  for (const r of rows) {
    const cur = m.get(r.fecha);
    if (!cur) {
      m.set(r.fecha, {
        mejorPeso: r.mejorPeso,
        volumen: r.volumen,
        mejorReps: r.mejorReps,
        series: r.series,
      });
      continue;
    }
    m.set(r.fecha, {
      mejorPeso: maxN(cur.mejorPeso, r.mejorPeso),
      volumen: cur.volumen + r.volumen,
      mejorReps: maxN(cur.mejorReps, r.mejorReps),
      series: cur.series + r.series,
    });
  }
  return [...m.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, v]) => ({ fecha, ...v }));
}

function filasGraficoPeso(rows: SesionEjercicioStats[]) {
  const merged = fusionarPorFecha(rows);
  return merged.filter((r) => r.mejorPeso != null).map((r) => ({ x: r.fecha, y: r.mejorPeso! }));
}

function filasGraficoVolumen(rows: SesionEjercicioStats[]) {
  return fusionarPorFecha(rows).map((r) => ({ x: r.fecha, y: r.volumen }));
}

function filasGraficoReps(rows: SesionEjercicioStats[]) {
  const merged = fusionarPorFecha(rows);
  return merged.filter((r) => r.mejorReps != null).map((r) => ({ x: r.fecha, y: r.mejorReps! }));
}

function filasGraficoSeries(rows: SesionEjercicioStats[]) {
  return fusionarPorFecha(rows).map((r) => ({ x: r.fecha, y: r.series }));
}

function fusionarCardioporFecha(rows: SesionCardioStats[]): SesionCardioStats[] {
  const m = new Map<string, { totalTiempoSeg: number; mejorTiempoSeg: number | null; mayorDistanciaKm: number | null; series: number }>();
  const maxN = (a: number | null, b: number | null): number | null => {
    const xs = [a, b].filter((x): x is number => x != null && !Number.isNaN(x));
    return xs.length ? Math.max(...xs) : null;
  };
  for (const r of rows) {
    const cur = m.get(r.fecha);
    if (!cur) {
      m.set(r.fecha, { totalTiempoSeg: r.totalTiempoSeg, mejorTiempoSeg: r.mejorTiempoSeg, mayorDistanciaKm: r.mayorDistanciaKm, series: r.series });
      continue;
    }
    m.set(r.fecha, {
      totalTiempoSeg: cur.totalTiempoSeg + r.totalTiempoSeg,
      mejorTiempoSeg: maxN(cur.mejorTiempoSeg, r.mejorTiempoSeg),
      mayorDistanciaKm: maxN(cur.mayorDistanciaKm, r.mayorDistanciaKm),
      series: cur.series + r.series,
    });
  }
  return [...m.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, v]) => ({ fecha, ...v }));
}

function filasCardioTiempo(rows: SesionCardioStats[]) {
  return fusionarCardioporFecha(rows)
    .filter((r) => r.mejorTiempoSeg != null)
    .map((r) => ({ x: r.fecha, y: r.mejorTiempoSeg! }));
}

function filasCardioTiempoTotal(rows: SesionCardioStats[]) {
  return fusionarCardioporFecha(rows).map((r) => ({ x: r.fecha, y: r.totalTiempoSeg }));
}

function filasCardioDistancia(rows: SesionCardioStats[]) {
  return fusionarCardioporFecha(rows)
    .filter((r) => r.mayorDistanciaKm != null)
    .map((r) => ({ x: r.fecha, y: r.mayorDistanciaKm! }));
}

function filasCardioSeries(rows: SesionCardioStats[]) {
  return fusionarCardioporFecha(rows).map((r) => ({ x: r.fecha, y: r.series }));
}

function formatoEjeFecha(iso: string) {
  const d = parseFechaLocal(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

const CHART_H = 150;
const DETAIL_CHART_H = 66;
const DETAIL_CHART_LARGE_H = 82;

const stylesChartBase = StyleSheet.create({
  wrap: { height: CHART_H, width: '100%' },
  vacio: { justifyContent: 'center', alignItems: 'center' },
});

function SkeletonPulse({ color, style }: { color: string; style?: object }) {
  const opacity = useState(() => new Animated.Value(0.35))[0];
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return <Animated.View style={[{ backgroundColor: color, borderRadius: 6 }, style, { opacity }]} />;
}

function SkeletonItem({ c, r }: { c: Theme; r: ReturnType<typeof useTheme>['r'] }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 74,
        marginBottom: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: r.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: c.border,
        backgroundColor: c.surface,
      }}
    >
      <SkeletonPulse color={c.surfaceElevated} style={{ width: 56, height: 56, borderRadius: r.sm }} />
      <View style={{ flex: 1, paddingLeft: 14, gap: 8 }}>
        <SkeletonPulse color={c.surfaceElevated} style={{ height: 14, width: '70%' }} />
        <SkeletonPulse color={c.surfaceElevated} style={{ height: 10, width: '40%' }} />
      </View>
    </View>
  );
}

function SkeletonLista({ c, r }: { c: Theme; r: ReturnType<typeof useTheme>['r'] }) {
  return (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 14 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonItem key={i} c={c} r={r} />
      ))}
    </View>
  );
}

function SkeletonCeldaGrafico({ color, r, borderColor }: { color: string; r: ReturnType<typeof useTheme>['r']; borderColor: string }) {
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor, borderRadius: r.md, padding: 8, overflow: 'hidden' }}>
      <SkeletonPulse color={color} style={{ height: 10, width: '45%', marginBottom: 8 }} />
      <SkeletonPulse color={color} style={{ flex: 1 }} />
    </View>
  );
}

function SkeletonGraficos({ c, r }: { c: Theme; r: ReturnType<typeof useTheme>['r'] }) {
  return (
    <View style={{ flex: 1, flexDirection: 'column', gap: 5, minHeight: 0 }}>
      <View style={{ flex: 1, flexDirection: 'row', gap: 5, minHeight: 0 }}>
        <SkeletonCeldaGrafico color={c.surfaceElevated} r={r} borderColor={c.borderVisible} />
        <SkeletonCeldaGrafico color={c.surfaceElevated} r={r} borderColor={c.borderVisible} />
      </View>
      <View style={{ flex: 1, flexDirection: 'row', gap: 5, minHeight: 0 }}>
        <SkeletonCeldaGrafico color={c.surfaceElevated} r={r} borderColor={c.borderVisible} />
        <SkeletonCeldaGrafico color={c.surfaceElevated} r={r} borderColor={c.borderVisible} />
      </View>
    </View>
  );
}

function GraficoLineaMini({
  datos,
  colorPrimario,
  colorEtiqueta,
  colorGrid,
  formatY,
  fontMono,
  height = CHART_H,
  flex: useFlex,
}: {
  datos: { x: string; y: number }[];
  colorPrimario: string;
  colorEtiqueta: string;
  colorGrid: string;
  formatY: (n: number) => string;
  fontMono: string;
  height?: number;
  flex?: boolean;
}) {
  const font = useFont(SPACE_MONO_CHART, 9);
  const wrapStyle = useFlex
    ? [stylesChartBase.wrap, stylesChartBase.vacio, { flex: 1, height: undefined }]
    : [stylesChartBase.wrap, stylesChartBase.vacio, { height }];
  const chartStyle = useFlex
    ? [stylesChartBase.wrap, { flex: 1, height: undefined }]
    : [stylesChartBase.wrap, { height }];
  if (datos.length < 2) {
    return (
      <View style={wrapStyle}>
        <Text style={{ fontFamily: fontMono, fontSize: 11, color: colorEtiqueta, textAlign: 'center' }}>
          {datos.length === 0 ? 'Sin registros' : 'Entrena más días para\nver la evolución'}
        </Text>
      </View>
    );
  }
  const ys = datos.map((d) => d.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = Math.max(0.01, (maxY - minY) * 0.1);
  return (
    <View style={chartStyle}>
      <CartesianChart<{ x: string; y: number }, 'x', 'y'>
        data={datos}
        xKey="x"
        yKeys={['y']}
        domain={{ y: [Math.max(0, minY - pad), maxY + pad] }}
        domainPadding={{ left: 4, right: 8, top: 16, bottom: 4 }}
        axisOptions={
          font
            ? {
                font,
                formatXLabel: (v) => formatoEjeFecha(String(v)),
                formatYLabel: (v) => formatY(Number(v)),
                labelColor: { x: colorEtiqueta, y: colorEtiqueta },
                lineColor: { grid: { x: colorGrid, y: colorGrid }, frame: colorGrid },
              }
            : undefined
        }
      >
        {({ points }) => (
          <Line points={points.y} color={colorPrimario} strokeWidth={2} curveType="natural" />
        )}
      </CartesianChart>
    </View>
  );
}

function GraficoBarrasMini({
  datos,
  colorPrimario,
  colorEtiqueta,
  colorGrid,
  formatY,
  fontMono,
  height = CHART_H,
  flex: useFlex,
}: {
  datos: { x: string; y: number }[];
  colorPrimario: string;
  colorEtiqueta: string;
  colorGrid: string;
  formatY: (n: number) => string;
  fontMono: string;
  height?: number;
  flex?: boolean;
}) {
  const font = useFont(SPACE_MONO_CHART, 9);
  const wrapStyle = useFlex
    ? [stylesChartBase.wrap, stylesChartBase.vacio, { flex: 1, height: undefined }]
    : [stylesChartBase.wrap, stylesChartBase.vacio, { height }];
  const chartStyle = useFlex
    ? [stylesChartBase.wrap, { flex: 1, height: undefined }]
    : [stylesChartBase.wrap, { height }];
  if (datos.length < 2) {
    return (
      <View style={wrapStyle}>
        <Text style={{ fontFamily: fontMono, fontSize: 11, color: colorEtiqueta, textAlign: 'center' }}>
          {datos.length === 0 ? 'Sin registros' : 'Entrena más días para\nver la evolución'}
        </Text>
      </View>
    );
  }
  const maxY = Math.max(1, ...datos.map((d) => d.y));
  return (
    <View style={chartStyle}>
      <CartesianChart<{ x: string; y: number }, 'x', 'y'>
        data={datos}
        xKey="x"
        yKeys={['y']}
        domain={{ y: [0, maxY * 1.1] }}
        domainPadding={{ left: 16, right: 16, top: 18, bottom: 4 }}
        axisOptions={
          font
            ? {
                font,
                formatXLabel: (v) => formatoEjeFecha(String(v)),
                formatYLabel: (v) => formatY(Number(v)),
                labelColor: { x: colorEtiqueta, y: colorEtiqueta },
                lineColor: { grid: { x: colorGrid, y: colorGrid }, frame: colorGrid },
              }
            : undefined
        }
      >
        {({ points, chartBounds }) => (
          <Bar
            chartBounds={chartBounds}
            points={points.y}
            roundedCorners={{ topLeft: 3, topRight: 3 }}
            color={colorPrimario}
          />
        )}
      </CartesianChart>
    </View>
  );
}

/** Etiquetas eje X (índice 0–5 = grupo fijo). */
const ETIQUETAS_EJE_GRUPO_MUSCULAR = ['Pecho', 'Espalda', 'Piernas', 'Brazos', 'Hombro', 'Core'] as const;
const TICKS_X_DISTRIB_MUSCULAR = [0, 1, 2, 3, 4, 5] as const;

function GraficoBarrasDistribMuscular({
  datos,
  colorPrimario,
  colorEtiqueta,
  colorGrid,
  fontMono,
}: {
  datos: { x: number; y: number }[];
  colorPrimario: string;
  colorEtiqueta: string;
  colorGrid: string;
  fontMono: string;
}) {
  const fontX = useFont(SPACE_MONO_CHART, 8);
  const fontY = useFont(SPACE_MONO_CHART, 9);
  if (datos.length < 2) {
    return (
      <View style={[stylesChartBase.wrap, stylesChartBase.vacio]}>
        <Text style={{ fontFamily: fontMono, fontSize: 11, color: colorEtiqueta }}>Sin datos en este periodo</Text>
      </View>
    );
  }
  return (
    <View style={stylesChartBase.wrap}>
      <CartesianChart<{ x: number; y: number }, 'x', 'y'>
        data={datos}
        xKey="x"
        yKeys={['y']}
        domain={{ y: [0, 100] }}
        domainPadding={{ left: 32, right: 32, top: 16, bottom: 8 }}
        xAxis={
          fontX
            ? {
                font: fontX,
                tickValues: [...TICKS_X_DISTRIB_MUSCULAR],
                labelRotate: -45,
                labelOffset: 10,
                formatXLabel: (v) => ETIQUETAS_EJE_GRUPO_MUSCULAR[Number(v)] ?? String(v),
                labelColor: colorEtiqueta,
              }
            : undefined
        }
        axisOptions={
          fontY
            ? {
                font: fontY,
                formatYLabel: (v) => `${Math.round(Number(v))}%`,
                labelColor: { x: colorEtiqueta, y: colorEtiqueta },
                lineColor: { grid: { x: colorGrid, y: colorGrid }, frame: colorGrid },
              }
            : undefined
        }
      >
        {({ points, chartBounds }) => (
          <Bar
            chartBounds={chartBounds}
            points={points.y}
            roundedCorners={{ topLeft: 3, topRight: 3 }}
            color={colorPrimario}
          />
        )}
      </CartesianChart>
    </View>
  );
}

function makeStyles(c: Theme, f: ReturnType<typeof useTheme>['f'], ts: ReturnType<typeof useTheme>['ts'], s: ReturnType<typeof useTheme>['s'], r: ReturnType<typeof useTheme>['r']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: s.md,
      minHeight: 48,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    backBtn: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
    headerTitle: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      flex: 1,
      textAlign: 'center',
    },
    headerSpacer: { width: 44 },
    searchWrap: {
      marginHorizontal: s.md,
      marginTop: s.md,
      minHeight: 42,
      borderWidth: 1,
      borderBottomColor: c.borderVisible,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      backgroundColor: c.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      lineHeight: 18,
      fontFamily: f.sans,
      color: c.textDisplay,
      paddingVertical: s.sm,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      gap: 8,
      paddingHorizontal: s.md,
      marginTop: 14,
    },
    chipShell: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.background,
      overflow: 'hidden',
    },
    chipShellOn: { borderColor: c.primary, backgroundColor: c.background },
    chipLabelPress: {
      flex: 1,
      minWidth: 0,
      minHeight: 34,
      paddingVertical: 7,
      paddingHorizontal: 10,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: 7,
    },
    chipTxt: { fontSize: 12, lineHeight: 16, fontFamily: f.sansMedium, color: c.textSecondary },
    chipTxtOn: { color: c.primary },
    chipClear: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    /** ESTADO A: columna con lista flexible y bloque distribución fijo abajo */
    listaColumn: { flex: 1, flexDirection: 'column' },
    listaUpper: { flex: 1, minHeight: 0 },
    listaLoading: { flex: 1, justifyContent: 'center', padding: s.lg },
    distribListaFooter: { flexShrink: 0 },
    distribWrapListaFija: { marginBottom: 0 },
    list: { flex: 1, marginTop: 14 },
    listContent: {
      paddingHorizontal: s.md,
      paddingBottom: s.md,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 74,
      marginBottom: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: r.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    ejercicioImg: {
      width: 56,
      height: 56,
      borderRadius: r.sm,
      backgroundColor: c.surfaceElevated,
    },
    ejercicioImgPlaceholder: {
      width: 56,
      height: 56,
      borderRadius: r.sm,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemMain: {
      flex: 1,
      minWidth: 0,
      paddingLeft: 14,
      paddingRight: s.sm,
      paddingVertical: 2,
    },
    itemName: { fontSize: 15, lineHeight: 18, fontFamily: f.sansBold, color: c.textDisplay },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 6,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.primary,
    },
    itemMetaText: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    levelText: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: f.sansMedium,
    },
    empty: { padding: s.xl, alignItems: 'center' },
    emptyTxt: { ...ts.bodySm, fontFamily: f.sans, color: c.textMuted, textAlign: 'center' },
    loading: { padding: s.lg },
    filtroModalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    filtroSheet: {
      maxHeight: '70%',
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
    filtroItemTxt: { ...ts.body, fontFamily: f.sans, color: c.textDisplay },
    detallePage: {
      flex: 1,
      paddingHorizontal: s.sm,
      paddingTop: s.sm,
      gap: 7,
    },
    ejercicioHero: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    detalleIconWrap: {
      width: 48,
      height: 48,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    detalleImg: {
      width: 46,
      height: 46,
      backgroundColor: c.background,
    },
    detalleHeroText: { flex: 1, minWidth: 0 },
    detalleNombre: {
      fontSize: 18,
      lineHeight: 21,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    detalleSubs: {
      fontSize: 10,
      lineHeight: 13,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginTop: 2,
    },
    gridMetricas: {
      flexDirection: 'row',
      gap: 5,
    },
    gridMetricasSkeleton: {
      flexDirection: 'row',
      gap: 5,
    },
    metricaCelda: {
      flex: 1,
      minHeight: 64,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      paddingVertical: 8,
      paddingHorizontal: 6,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metricaIcon: { marginBottom: 2 },
    metricaLabel: {
      fontSize: 8,
      lineHeight: 10,
      fontFamily: f.mono,
      color: c.textSecondary,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    metricaValor: { fontSize: 18, lineHeight: 21, fontFamily: f.sansBold, color: c.textDisplay },
    segmentWrap: {
      flexDirection: 'row',
      borderRadius: r.pill,
      overflow: 'hidden',
      backgroundColor: c.surface,
    },
    segmentBtn: { flex: 1, minHeight: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface },
    segmentBtnOn: { backgroundColor: c.primary },
    segmentTxt: { fontSize: 10, lineHeight: 13, fontFamily: f.mono, color: c.textSecondary },
    segmentTxtOn: { color: c.textOnPrimary },
    chartsGrid: {
      flexDirection: 'column',
      gap: 5,
      flex: 1,
      minHeight: 0,
    },
    chartsRow: {
      flexDirection: 'row',
      gap: 5,
      flex: 1,
      minHeight: 0,
    },
    chartCell: {
      flex: 1,
      minHeight: 0,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      paddingHorizontal: 8,
      paddingTop: 7,
      paddingBottom: 5,
      backgroundColor: c.surface,
    },
    chartCellWide: { flex: 0, flexBasis: 'auto' },
    chartTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    chartTitle: { fontSize: 11, lineHeight: 14, fontFamily: f.sansBold, color: c.textDisplay },
    insufficientWrap: {
      flex: 1,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: s.lg,
      gap: s.sm,
    },
    insufficientTitle: {
      ...ts.subheading,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      textAlign: 'center',
    },
    insufficientText: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textSecondary,
      textAlign: 'center',
    },
    distribWrap: {
      marginHorizontal: s.md,
      marginTop: s.sm,
      marginBottom: s.xxl,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      padding: s.md,
      backgroundColor: c.surface,
    },
    distribTitle: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      marginBottom: s.xs,
    },
    distribVacio: {
      height: CHART_H,
      justifyContent: 'center',
      alignItems: 'center',
    },
    distribVacioTxt: { ...ts.caption, fontFamily: f.mono, color: c.textSecondary, textAlign: 'center' },
    infoModal: {
      backgroundColor: c.surface,
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.borderVisible,
      padding: s.lg,
      gap: s.sm,
      maxWidth: 320,
      width: '100%',
    },
    infoModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    infoModalTitulo: {
      ...ts.subheading,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    infoModalDesc: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textSecondary,
      lineHeight: 20,
    },
    infoModalBtn: {
      marginTop: s.xs,
      alignSelf: 'flex-end',
      paddingVertical: 7,
      paddingHorizontal: 18,
      borderRadius: r.pill,
      backgroundColor: c.primary,
    },
    infoModalBtnTxt: {
      fontSize: 13,
      lineHeight: 17,
      fontFamily: f.sansMedium,
      color: c.textOnPrimary,
    },
  });
}

export default function EstadisticasEjercicioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [vista, setVista] = useState<VistaEstado>('lista');
  const [seleccion, setSeleccion] = useState<EjercicioResumen | null>(null);

  const [texto, setTexto] = useState('');
  const [debounced, setDebounced] = useState('');
  const [musculo, setMusculo] = useState<string | null>(null);
  const [equipamiento, setEquipamiento] = useState<string | null>(null);
  const [filtroModal, setFiltroModal] = useState<'musculo' | 'equipamiento' | null>(null);
  const [opciones, setOpciones] = useState<{ musculos: string[]; equipamientos: string[] }>({
    musculos: [],
    equipamientos: [],
  });

  const [listaBase, setListaBase] = useState<EjercicioResumen[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);

  const [fechaRegistro, setFechaRegistro] = useState<string>(fechaHoyIsoLocal());
  const [periodo, setPeriodo] = useState<PeriodoStats>('3m');
  const [stats, setStats] = useState<EstadisticasEjercicio | null>(null);
  const [statsCardio, setStatsCardio] = useState<EstadisticasCardio | null>(null);
  const [distribMuscular, setDistribMuscular] = useState<DistribucionMuscular[]>([]);
  const [cargandoDistrib, setCargandoDistrib] = useState(false);
  const [cargandoStats, setCargandoStats] = useState(false);
  const [infoGrafico, setInfoGrafico] = useState<InfoGrafico | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(texto.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    void (async () => {
      const [m, e] = await Promise.all([
        ejerciciosService.obtenerMusculosDisponibles(),
        ejerciciosService.obtenerEquipamientoDisponible(),
      ]);
      setOpciones({ musculos: m, equipamientos: e });
    })();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void progresoService.obtenerFechaRegistro(user.id).then(setFechaRegistro);
  }, [user?.id]);

  const cargarLista = useCallback(async () => {
    if (!user?.id) {
      setListaBase([]);
      setCargandoLista(false);
      return;
    }
    setCargandoLista(true);
    try {
      const rows = await progresoService.obtenerEjerciciosRealizados(user.id);
      setListaBase(rows);
    } finally {
      setCargandoLista(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void cargarLista();
  }, [cargarLista]);

  const listaFiltrada = useMemo(() => {
    return listaBase.filter((ex) => {
      if (debounced && !ex.nombre.toLowerCase().includes(debounced)) return false;
      if (musculo && ex.musculo_primario !== musculo) return false;
      if (equipamiento) {
        const eq = ex.equipamiento ?? '';
        if (eq !== equipamiento) return false;
      }
      return true;
    });
  }, [listaBase, debounced, musculo, equipamiento]);

  const fechaIniStats = useMemo(
    () => fechaInicioRangoProgreso(periodo, fechaRegistro),
    [periodo, fechaRegistro],
  );
  const fechaFinStats = fechaHoyIsoLocal();

  /** Distribución muscular en listado: siempre ventana de 3 meses (sin selector en ESTADO A). */
  const fechaIniDistribLista = useMemo(
    () => fechaInicioRangoProgreso('3m', fechaRegistro),
    [fechaRegistro],
  );

  useEffect(() => {
    if (!user?.id) {
      setDistribMuscular([]);
      return;
    }
    let cancel = false;
    void (async () => {
      setCargandoDistrib(true);
      try {
        const fin = fechaHoyIsoLocal();
        const dist = await progresoService.obtenerDistribucionMuscular(
          user.id,
          fechaIniDistribLista,
          fin,
        );
        if (!cancel) setDistribMuscular(dist);
      } finally {
        if (!cancel) setCargandoDistrib(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user?.id, fechaIniDistribLista]);

  const seleccionIdRef = useRef<string | null>(null);

  const esCardio =
    seleccion?.tracking_mode === 'cardio_time' || seleccion?.tracking_mode === 'cardio_time_distance';
  const cardioConDistancia = seleccion?.tracking_mode === 'cardio_time_distance';

  useEffect(() => {
    if (vista !== 'detalle' || !user?.id || !seleccion) {
      setStats(null);
      setStatsCardio(null);
      seleccionIdRef.current = null;
      return;
    }
    const ejercicioChanged = seleccionIdRef.current !== seleccion.id;
    if (ejercicioChanged) {
      setStats(null);
      setStatsCardio(null);
      seleccionIdRef.current = seleccion.id;
    }
    let cancel = false;
    void (async () => {
      setCargandoStats(true);
      try {
        if (esCardio) {
          const data = await progresoService.obtenerEstadisticasCardio(
            user.id,
            seleccion.id,
            fechaIniStats,
            fechaFinStats,
            cardioConDistancia,
          );
          if (!cancel) setStatsCardio(data);
        } else {
          const data = await progresoService.obtenerEstadisticasEjercicio(
            user.id,
            seleccion.id,
            fechaIniStats,
            fechaFinStats,
          );
          if (!cancel) setStats(data);
        }
      } finally {
        if (!cancel) setCargandoStats(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [vista, user?.id, seleccion, fechaIniStats, fechaFinStats, esCardio, cardioConDistancia]);

  const renderChip = (
    labelBase: string,
    valorMostrar: string | null,
    activo: boolean,
    icon: IoniconName,
    onOpen: () => void,
    onClear: () => void,
  ) => (
    <View style={[styles.chipShell, activo && styles.chipShellOn]}>
      <Pressable style={styles.chipLabelPress} onPress={onOpen} accessibilityRole="button">
        <Ionicons name={icon} size={17} color={activo ? c.primary : c.textSecondary} />
        <Text style={[styles.chipTxt, activo && styles.chipTxtOn]} numberOfLines={1} ellipsizeMode="tail">
          {valorMostrar ?? labelBase}
        </Text>
      </Pressable>
      {activo ? (
        <Pressable
          style={styles.chipClear}
          onPress={onClear}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Quitar filtro ${labelBase}`}
        >
          <Text style={[styles.chipTxt, styles.chipTxtOn, { fontSize: 18, lineHeight: 22 }]}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const onBackHeader = () => {
    if (vista === 'detalle') {
      setVista('lista');
      setSeleccion(null);
      return;
    }
    router.back();
  };

  const secundariosTxt =
    seleccion?.musculos_secundarios?.filter(Boolean).join(', ') ?? '';

  const datosPeso = stats ? filasGraficoPeso(stats.porSesion) : [];
  const datosVol = stats ? filasGraficoVolumen(stats.porSesion) : [];
  const datosReps = stats ? filasGraficoReps(stats.porSesion) : [];
  const datosSeries = stats ? filasGraficoSeries(stats.porSesion) : [];

  const datosCardioTiempo = statsCardio ? filasCardioTiempo(statsCardio.porSesion) : [];
  const datosCardioTiempoTotal = statsCardio ? filasCardioTiempoTotal(statsCardio.porSesion) : [];
  const datosCardioDistancia = statsCardio ? filasCardioDistancia(statsCardio.porSesion) : [];
  const datosCardioSeries = statsCardio ? filasCardioSeries(statsCardio.porSesion) : [];

  const datosDistribMuscular = useMemo(() => {
    const map = new Map(distribMuscular.map((d) => [d.grupo, d.porcentaje]));
    const grupos = ['PECHO', 'ESPALDA', 'PIERNAS', 'BRAZOS', 'HOMBRO', 'CORE'] as const;
    return grupos.map((g, i) => ({ x: i, y: map.get(g) ?? 0 }));
  }, [distribMuscular]);

  const hayDistribMuscular = distribMuscular.length > 0;

  if (!user) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, justifyContent: 'center', padding: s.md }]}>
        <Text style={{ ...ts.body, fontFamily: f.sans, color: c.textSecondary, textAlign: 'center' }}>
          Inicia sesión para ver estadísticas
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={onBackHeader} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={24} color={c.textDisplay} />
        </Pressable>
        <Text style={styles.headerTitle}>Estadísticas</Text>
        <View style={styles.headerSpacer} />
      </View>

      {vista === 'lista' ? (
        <View style={styles.listaColumn}>
          <View style={styles.listaUpper}>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={20} color={c.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar ejercicio"
                placeholderTextColor={c.textMuted}
                value={texto}
                onChangeText={setTexto}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.chipsRow}>
              {renderChip(
                'Músculo',
                musculo,
                Boolean(musculo),
                'body-outline',
                () => setFiltroModal('musculo'),
                () => setMusculo(null),
              )}
              {renderChip(
                'Equipamiento',
                equipamiento,
                Boolean(equipamiento),
                'barbell-outline',
                () => setFiltroModal('equipamiento'),
                () => setEquipamiento(null),
              )}
            </View>
            {cargandoLista ? (
              <SkeletonLista c={c} r={r} />
            ) : (
              <FlatList
                style={styles.list}
                data={listaFiltrada}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[styles.listContent, { flexGrow: 1 }]}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyTxt}>
                      No hay ejercicios con sesiones registradas o no coinciden con los filtros.
                    </Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const fotoUri = item.foto_url?.trim() ?? '';
                  const nivel = estiloNivelEjercicio(item.dificultad, c);
                  return (
                    <Pressable
                      style={styles.itemRow}
                      onPress={() => {
                        setSeleccion(item);
                        setVista('detalle');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir estadísticas de ${item.nombre}`}
                    >
                      {fotoUri ? (
                        <Image
                          source={{ uri: fotoUri }}
                          style={styles.ejercicioImg}
                          contentFit="contain"
                          cachePolicy="memory-disk"
                          autoplay={false}
                          recyclingKey={item.id}
                        />
                      ) : (
                        <View style={styles.ejercicioImgPlaceholder}>
                          <Ionicons name="barbell-outline" size={24} color={c.textMuted} />
                        </View>
                      )}
                      <View style={styles.itemMain}>
                        <Text style={styles.itemName} numberOfLines={2}>
                          {item.nombre}
                        </Text>
                        <View style={styles.metaRow}>
                          <View style={styles.metaItem}>
                            <View style={styles.metaDot} />
                            <Text style={styles.itemMetaText} numberOfLines={1}>
                              {item.musculo_primario}
                            </Text>
                          </View>
                          {nivel ? (
                            <View style={styles.metaItem}>
                              <Ionicons name="stats-chart" size={12} color={c.textSecondary} />
                              <View
                                style={[
                                  styles.metaDot,
                                  { backgroundColor: nivel.dot, width: 5, height: 5, borderRadius: 2.5 },
                                ]}
                              />
                              <Text style={[styles.levelText, { color: nivel.color }]} numberOfLines={1}>
                                {nivel.label}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
          <View style={[styles.distribListaFooter, { paddingBottom: Math.max(insets.bottom, s.xs) }]}>
            <View style={[styles.distribWrap, styles.distribWrapListaFija]}>
              <Text style={styles.distribTitle}>Distribución muscular</Text>
              {cargandoDistrib ? (
                <View style={styles.distribVacio}>
                  <ActivityIndicator color={c.primary} />
                </View>
              ) : hayDistribMuscular ? (
                <GraficoBarrasDistribMuscular
                  datos={datosDistribMuscular}
                  colorPrimario={c.primary}
                  colorEtiqueta={c.textSecondary}
                  colorGrid={c.border}
                  fontMono={f.mono}
                />
              ) : (
                <View style={styles.distribVacio}>
                  <Text style={styles.distribVacioTxt}>Sin datos en este periodo</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.detallePage, { paddingBottom: Math.max(insets.bottom, s.sm) }]}>
          {seleccion ? (
            <>
              <View style={styles.ejercicioHero}>
                <View style={styles.detalleIconWrap}>
                  {seleccion.foto_url?.trim() ? (
                    <Image
                      source={{ uri: seleccion.foto_url.trim() }}
                      style={styles.detalleImg}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <Ionicons name="barbell-outline" size={25} color={c.primary} />
                  )}
                </View>
                <View style={styles.detalleHeroText}>
                  <Text style={styles.detalleNombre} numberOfLines={2}>
                    {seleccion.nombre}
                  </Text>
                  <Text style={styles.detalleSubs} numberOfLines={1}>
                {seleccion.musculo_primario}
                {secundariosTxt ? ` · ${secundariosTxt}` : ''}
                  </Text>
                </View>
              </View>

              {/* Primera carga: sin datos previos todavía */}
              {cargandoStats && !stats && !statsCardio ? (
                <>
                  <View style={styles.gridMetricasSkeleton}>
                    {Array.from({ length: esCardio ? 3 : 4 }).map((_, i) => (
                      <View key={i} style={styles.metricaCelda}>
                        <SkeletonPulse color={c.surfaceElevated} style={{ height: 12, width: 28, marginBottom: 4 }} />
                        <SkeletonPulse color={c.surfaceElevated} style={{ height: 8, width: 42, marginBottom: 6 }} />
                        <SkeletonPulse color={c.surfaceElevated} style={{ height: 20, width: 36 }} />
                      </View>
                    ))}
                  </View>
                  <View style={styles.segmentWrap}>
                    {(['7d', '3m', '1y'] as PeriodoStats[]).map((k) => (
                      <Pressable
                        key={k}
                        onPress={() => setPeriodo(k)}
                        style={[styles.segmentBtn, periodo === k && styles.segmentBtnOn]}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.segmentTxt, periodo === k && styles.segmentTxtOn]}>
                          {PERIODO_LABELS[k]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <SkeletonGraficos c={c} r={r} />
                </>
              ) : esCardio ? (
                /* ── RAMA CARDIO ── */
                !statsCardio ? null : statsCardio.veces < 1 ? (
                  <View style={styles.insufficientWrap}>
                    <Ionicons name="analytics-outline" size={32} color={c.primary} />
                    <Text style={styles.insufficientTitle}>Sin datos suficientes</Text>
                    <Text style={styles.insufficientText}>
                      Realiza este ejercicio al menos una vez para ver sus estadísticas.
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.gridMetricas}>
                      <View style={styles.metricaCelda}>
                        <Ionicons style={styles.metricaIcon} name="refresh" size={15} color={c.primary} />
                        <Text style={styles.metricaLabel}>VECES</Text>
                        <Text style={styles.metricaValor}>{statsCardio.veces}</Text>
                      </View>
                      <View style={styles.metricaCelda}>
                        <Ionicons style={styles.metricaIcon} name="timer-outline" size={15} color={c.primary} />
                        <Text style={styles.metricaLabel}>MEJOR TIEMPO</Text>
                        <Text style={[styles.metricaValor, { fontSize: 14, lineHeight: 17 }]}>
                          {statsCardio.mejorTiempoSeg != null ? formatearTiempo(statsCardio.mejorTiempoSeg) : '—'}
                        </Text>
                      </View>
                      {cardioConDistancia ? (
                        <View style={styles.metricaCelda}>
                          <Ionicons style={styles.metricaIcon} name="navigate-outline" size={15} color={c.primary} />
                          <Text style={styles.metricaLabel}>MEJOR DIST.</Text>
                          <Text style={[styles.metricaValor, { fontSize: 14, lineHeight: 17 }]}>
                            {statsCardio.mayorDistanciaKm != null
                              ? `${statsCardio.mayorDistanciaKm.toFixed(2)} km`
                              : '—'}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.segmentWrap}>
                      {(['7d', '3m', '1y'] as PeriodoStats[]).map((k) => (
                        <Pressable
                          key={k}
                          onPress={() => setPeriodo(k)}
                          style={[styles.segmentBtn, periodo === k && styles.segmentBtnOn]}
                          accessibilityRole="button"
                        >
                          <Text style={[styles.segmentTxt, periodo === k && styles.segmentTxtOn]}>
                            {PERIODO_LABELS[k]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    {cargandoStats ? (
                      <SkeletonGraficos c={c} r={r} />
                    ) : (
                      <View style={styles.chartsGrid}>
                        <View style={styles.chartsRow}>
                          <View style={styles.chartCell}>
                            <View style={styles.chartTitleRow}>
                              <Text style={styles.chartTitle}>Mejor tiempo</Text>
                              <Pressable
                                onPress={() => setInfoGrafico(INFO_GRAFICOS_CARDIO.tiempo)}
                                hitSlop={8}
                                accessibilityRole="button"
                              >
                                <Ionicons name="information-circle-outline" size={15} color={c.textSecondary} />
                              </Pressable>
                            </View>
                            <GraficoLineaMini
                              datos={datosCardioTiempo}
                              colorPrimario={c.primary}
                              colorEtiqueta={c.textSecondary}
                              colorGrid={c.border}
                              formatY={(n) => formatearTiempo(n)}
                              fontMono={f.mono}
                              flex
                            />
                          </View>
                          <View style={styles.chartCell}>
                            <View style={styles.chartTitleRow}>
                              <Text style={styles.chartTitle}>Tiempo total</Text>
                              <Pressable
                                onPress={() => setInfoGrafico(INFO_GRAFICOS_CARDIO.tiempoTotal)}
                                hitSlop={8}
                                accessibilityRole="button"
                              >
                                <Ionicons name="information-circle-outline" size={15} color={c.textSecondary} />
                              </Pressable>
                            </View>
                            <GraficoLineaMini
                              datos={datosCardioTiempoTotal}
                              colorPrimario={c.primary}
                              colorEtiqueta={c.textSecondary}
                              colorGrid={c.border}
                              formatY={(n) => formatearTiempo(n)}
                              fontMono={f.mono}
                              flex
                            />
                          </View>
                        </View>
                        <View style={styles.chartsRow}>
                          {cardioConDistancia ? (
                            <View style={styles.chartCell}>
                              <View style={styles.chartTitleRow}>
                                <Text style={styles.chartTitle}>Mejor distancia</Text>
                                <Pressable
                                  onPress={() => setInfoGrafico(INFO_GRAFICOS_CARDIO.distancia)}
                                  hitSlop={8}
                                  accessibilityRole="button"
                                >
                                  <Ionicons name="information-circle-outline" size={15} color={c.textSecondary} />
                                </Pressable>
                              </View>
                              <GraficoLineaMini
                                datos={datosCardioDistancia}
                                colorPrimario={c.primary}
                                colorEtiqueta={c.textSecondary}
                                colorGrid={c.border}
                                formatY={(n) => `${n.toFixed(1)}km`}
                                fontMono={f.mono}
                                flex
                              />
                            </View>
                          ) : null}
                          <View style={styles.chartCell}>
                            <View style={styles.chartTitleRow}>
                              <Text style={styles.chartTitle}>Series</Text>
                              <Pressable
                                onPress={() => setInfoGrafico(INFO_GRAFICOS_CARDIO.series)}
                                hitSlop={8}
                                accessibilityRole="button"
                              >
                                <Ionicons name="information-circle-outline" size={15} color={c.textSecondary} />
                              </Pressable>
                            </View>
                            <GraficoBarrasMini
                              datos={datosCardioSeries}
                              colorPrimario={c.primary}
                              colorEtiqueta={c.textSecondary}
                              colorGrid={c.border}
                              formatY={(n) => String(Math.round(n))}
                              fontMono={f.mono}
                              flex
                            />
                          </View>
                        </View>
                      </View>
                    )}
                  </>
                )
              ) : (
                /* ── RAMA FUERZA ── */
                !stats ? null : stats.veces < 1 ? (
                  <View style={styles.insufficientWrap}>
                    <Ionicons name="analytics-outline" size={32} color={c.primary} />
                    <Text style={styles.insufficientTitle}>Sin datos suficientes</Text>
                    <Text style={styles.insufficientText}>
                      Realiza este ejercicio al menos una vez para ver sus estadísticas.
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.gridMetricas}>
                      <View style={styles.metricaCelda}>
                        <Ionicons style={styles.metricaIcon} name="calendar-outline" size={15} color={c.primary} />
                        <Text style={styles.metricaLabel}>RUTINAS</Text>
                        <Text style={styles.metricaValor}>{stats.rutinas}</Text>
                      </View>
                      <View style={styles.metricaCelda}>
                        <Ionicons style={styles.metricaIcon} name="refresh" size={15} color={c.primary} />
                        <Text style={styles.metricaLabel}>VECES</Text>
                        <Text style={styles.metricaValor}>{stats.veces}</Text>
                      </View>
                      <View style={styles.metricaCelda}>
                        <Ionicons style={styles.metricaIcon} name="trophy-outline" size={15} color={c.primary} />
                        <Text style={styles.metricaLabel}>MEJOR PESO</Text>
                        <Text style={styles.metricaValor}>
                          {stats.mejorPeso != null ? `${stats.mejorPeso} kg` : '—'}
                        </Text>
                      </View>
                      <View style={styles.metricaCelda}>
                        <Ionicons style={styles.metricaIcon} name="star-outline" size={15} color={c.primary} />
                        <Text style={styles.metricaLabel}>MEJOR REPS</Text>
                        <Text style={styles.metricaValor}>
                          {stats.mejorReps != null ? String(stats.mejorReps) : '—'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.segmentWrap}>
                      {(['7d', '3m', '1y'] as PeriodoStats[]).map((k) => (
                        <Pressable
                          key={k}
                          onPress={() => setPeriodo(k)}
                          style={[styles.segmentBtn, periodo === k && styles.segmentBtnOn]}
                          accessibilityRole="button"
                        >
                          <Text style={[styles.segmentTxt, periodo === k && styles.segmentTxtOn]}>
                            {PERIODO_LABELS[k]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    {cargandoStats ? (
                      <SkeletonGraficos c={c} r={r} />
                    ) : (
                      <View style={styles.chartsGrid}>
                        <View style={styles.chartsRow}>
                          <View style={styles.chartCell}>
                            <View style={styles.chartTitleRow}>
                              <Text style={styles.chartTitle}>Mejor peso</Text>
                              <Pressable
                                onPress={() => setInfoGrafico(INFO_GRAFICOS.peso)}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel="Información sobre mejor peso"
                              >
                                <Ionicons name="information-circle-outline" size={15} color={c.textSecondary} />
                              </Pressable>
                            </View>
                            <GraficoLineaMini
                              datos={datosPeso}
                              colorPrimario={c.primary}
                              colorEtiqueta={c.textSecondary}
                              colorGrid={c.border}
                              formatY={(n) => n.toFixed(0)}
                              fontMono={f.mono}
                              flex
                            />
                          </View>
                          <View style={styles.chartCell}>
                            <View style={styles.chartTitleRow}>
                              <Text style={styles.chartTitle}>Volumen</Text>
                              <Pressable
                                onPress={() => setInfoGrafico(INFO_GRAFICOS.volumen)}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel="Información sobre volumen"
                              >
                                <Ionicons name="information-circle-outline" size={15} color={c.textSecondary} />
                              </Pressable>
                            </View>
                            <GraficoLineaMini
                              datos={datosVol}
                              colorPrimario={c.primary}
                              colorEtiqueta={c.textSecondary}
                              colorGrid={c.border}
                              formatY={(n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(0))}
                              fontMono={f.mono}
                              flex
                            />
                          </View>
                        </View>
                        <View style={styles.chartsRow}>
                          <View style={styles.chartCell}>
                            <View style={styles.chartTitleRow}>
                              <Text style={styles.chartTitle}>Mejor reps</Text>
                              <Pressable
                                onPress={() => setInfoGrafico(INFO_GRAFICOS.reps)}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel="Información sobre mejor reps"
                              >
                                <Ionicons name="information-circle-outline" size={15} color={c.textSecondary} />
                              </Pressable>
                            </View>
                            <GraficoLineaMini
                              datos={datosReps}
                              colorPrimario={c.primary}
                              colorEtiqueta={c.textSecondary}
                              colorGrid={c.border}
                              formatY={(n) => String(Math.round(n))}
                              fontMono={f.mono}
                              flex
                            />
                          </View>
                          <View style={styles.chartCell}>
                            <View style={styles.chartTitleRow}>
                              <Text style={styles.chartTitle}>Series</Text>
                              <Pressable
                                onPress={() => setInfoGrafico(INFO_GRAFICOS.series)}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel="Información sobre series"
                              >
                                <Ionicons name="information-circle-outline" size={15} color={c.textSecondary} />
                              </Pressable>
                            </View>
                            <GraficoBarrasMini
                              datos={datosSeries}
                              colorPrimario={c.primary}
                              colorEtiqueta={c.textSecondary}
                              colorGrid={c.border}
                              formatY={(n) => String(Math.round(n))}
                              fontMono={f.mono}
                              flex
                            />
                          </View>
                        </View>
                      </View>
                    )}
                  </>
                )
              )}
            </>
          ) : null}
        </View>
      )}

      <Modal visible={filtroModal != null} transparent animationType="fade" onRequestClose={() => setFiltroModal(null)}>
        <View style={{ flex: 1 }}>
          <Pressable style={styles.filtroModalBackdrop} onPress={() => setFiltroModal(null)} />
          <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'flex-end' }]} pointerEvents="box-none">
            <View style={[styles.filtroSheet, { paddingBottom: insets.bottom + s.md }]}>
              <Text style={styles.filtroTitle}>{filtroModal === 'musculo' ? 'MÚSCULO' : 'EQUIPAMIENTO'}</Text>
              <FlatList
                data={filtroModal === 'musculo' ? opciones.musculos : opciones.equipamientos}
                keyExtractor={(x) => x}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyTxt}>No hay valores.</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.filtroItem}
                    onPress={() => {
                      if (filtroModal === 'musculo') setMusculo(item);
                      else setEquipamiento(item);
                      setFiltroModal(null);
                    }}
                  >
                    <Text style={styles.filtroItemTxt}>{item}</Text>
                  </Pressable>
                )}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={infoGrafico != null}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoGrafico(null)}
      >
        <Pressable
          style={styles.filtroModalBackdrop}
          onPress={() => setInfoGrafico(null)}
        />
        <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center', margin: s.lg }]} pointerEvents="box-none">
          <View style={styles.infoModal}>
            <View style={styles.infoModalHeader}>
              <Ionicons name="information-circle" size={18} color={c.primary} />
              <Text style={styles.infoModalTitulo}>{infoGrafico?.titulo}</Text>
            </View>
            <Text style={styles.infoModalDesc}>{infoGrafico?.descripcion}</Text>
            <Pressable
              style={styles.infoModalBtn}
              onPress={() => setInfoGrafico(null)}
              accessibilityRole="button"
            >
              <Text style={styles.infoModalBtnTxt}>Entendido</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
