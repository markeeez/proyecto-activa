/**
 * Consulta de ejercicio — ficha informativa (catálogo Supabase).
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFont } from '@shopify/react-native-skia';
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
  type RecordsEjercicio,
  type SesionEjercicioHistorial,
} from '@/services/progreso.service';
import type { CategoriaEjercicio, Exercise, TipoSerie } from '@/types/database.types';

const SPACE_MONO_CHART = require('@expo-google-fonts/space-mono/400Regular/SpaceMono_400Regular.ttf');

/** Fila devuelta por `select('*')` (puede incluir columnas extra en BD). */
type ExerciseRow = Exercise & {
  foto_url?: string | null;
  dificultad?: string | null;
};

const TAB_LABELS = ['Indicaciones', 'Estadísticas', 'Historial'] as const;

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

const METRICA_OPTS: { key: MetricaGrafico; label: string }[] = [
  { key: 'mayorPeso', label: 'MAYOR PESO' },
  { key: 'oneRepMax', label: 'ONE REP MAX' },
  { key: 'mejorVolumenSerie', label: 'VOL. SERIE' },
  { key: 'totalRepeticiones', label: 'TOTAL REPS' },
];

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

const CHART_H = 220;

function GraficoEstadisticasEjercicio({
  datos,
  metrica,
  colorPrimario,
  colorEtiqueta,
  colorGrid,
  colorFondo,
  fontMono,
}: {
  datos: { x: string; y: number }[];
  metrica: MetricaGrafico;
  colorPrimario: string;
  colorEtiqueta: string;
  colorGrid: string;
  colorFondo: string;
  fontMono: string;
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
  const pad = Math.max(0.01, (maxY - minY) * 0.12);
  const yLow = Math.max(0, minY - pad);
  const yHigh = maxY + pad;

  const formatY = (n: number) => {
    if (unit === 'reps') return `${Math.round(n)} reps`;
    const v = n >= 100 ? n.toFixed(0) : n.toFixed(1);
    return `${v} kg`;
  };

  return (
    <View style={stylesChartBase.wrap}>
      <CartesianChart<{ x: string; y: number }, 'x', 'y'>
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
                formatXLabel: (v) => formatoEjeFecha(String(v)),
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
  wrap: { height: CHART_H, width: '100%' },
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
      paddingBottom: s.sm,
      minHeight: 48,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.surface,
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
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      textAlign: 'center',
      marginTop: s.md,
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
      paddingVertical: s.sm,
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
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    tabTxtActive: {
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: s.xl,
    },
    heroImg: {
      width: '100%',
      height: 280,
      backgroundColor: c.background,
    },
    heroPlaceholder: {
      width: '100%',
      height: 280,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: s.md,
      marginHorizontal: s.md,
      marginTop: s.md,
    },
    statRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: s.sm,
      paddingVertical: s.sm,
    },
    statLabel: {
      flex: 1,
      fontSize: 11,
      fontFamily: f.mono,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    statValue: {
      flex: 1,
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
      textAlign: 'right',
    },
    statSep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
    },
    descBlock: {
      marginHorizontal: s.md,
      marginTop: s.md,
    },
    descTitle: {
      fontSize: 11,
      fontFamily: f.mono,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: s.xs,
    },
    descBody: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.text,
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
      gap: s.xs,
      alignSelf: 'flex-start',
      marginHorizontal: s.md,
      marginTop: s.md,
      paddingHorizontal: s.md,
      paddingVertical: s.xs,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
    },
    periodoBtnTxt: {
      fontSize: 11,
      fontFamily: f.mono,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
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
      marginHorizontal: s.md,
      marginTop: s.sm,
      maxHeight: 48,
    },
    chipsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: s.xs,
    },
    chip: {
      paddingHorizontal: s.sm,
      paddingVertical: s.xs,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      marginRight: s.xs,
    },
    chipOn: {
      borderColor: c.primary,
    },
    chipTxt: {
      fontSize: 11,
      fontFamily: f.mono,
      color: c.textSecondary,
      textTransform: 'uppercase',
    },
    chipTxtOn: {
      color: c.primary,
    },
    chartBlock: {
      marginHorizontal: s.md,
      marginTop: s.md,
    },
    recordsTitle: {
      fontSize: 11,
      fontFamily: f.mono,
      color: c.textSecondary,
      textTransform: 'uppercase',
      marginTop: s.lg,
      marginHorizontal: s.md,
      letterSpacing: 0.6,
    },
    recordsCard: {
      marginHorizontal: s.md,
      marginTop: s.sm,
      backgroundColor: c.surface,
      borderRadius: 12,
      overflow: 'hidden',
    },
    histCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      marginHorizontal: s.md,
      marginBottom: s.sm,
      overflow: 'hidden',
    },
    histHeaderPress: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    histHeaderIzq: {
      flex: 1,
      minWidth: 0,
    },
    histFecha: {
      fontSize: 12,
      fontFamily: f.mono,
      color: c.textSecondary,
    },
    histNombre: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
      marginTop: 2,
    },
    histTablaHead: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      paddingHorizontal: s.md,
      paddingVertical: s.xs,
    },
    histColSerie: {
      flex: 0.55,
      minWidth: 0,
      alignItems: 'center',
    },
    histColTipo: {
      flex: 0.85,
      minWidth: 0,
      alignItems: 'center',
    },
    histColKg: {
      flex: 0.75,
      minWidth: 0,
      alignItems: 'center',
    },
    histColReps: {
      flex: 0.75,
      minWidth: 0,
      alignItems: 'center',
    },
    histTh: {
      fontSize: 11,
      fontFamily: f.mono,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      textAlign: 'center',
      width: '100%',
    },
    histFila: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
    },
    histFilaSep: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    histTd: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textDisplay,
      textAlign: 'center',
      width: '100%',
    },
    histBadge: {
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: r.technical,
      backgroundColor: c.primaryBg,
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
    emptyHist: {
      flex: 1,
      padding: s.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyHistTxt: {
      fontFamily: f.mono,
      color: c.textSecondary,
      fontSize: 11,
    },
  });
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

  const [statsRows, setStatsRows] = useState<EstadisticaEjercicioDia[]>([]);
  const [cargandoStats, setCargandoStats] = useState(false);

  const [records, setRecords] = useState<RecordsEjercicio | null>(null);
  const recordsCargadosParaEjercicio = useRef<string | null>(null);

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
  }, [id]);

  useEffect(() => {
    if (tab !== 1 || !user?.id || !id) return;
    if (recordsCargadosParaEjercicio.current === id) return;

    void (async () => {
      try {
        const rec = await progresoService.obtenerRecordsEjercicio(id, user.id);
        setRecords(rec);
        recordsCargadosParaEjercicio.current = id;
      } catch {
        setRecords(null);
        recordsCargadosParaEjercicio.current = id;
      }
    })();
  }, [tab, id, user?.id]);

  useEffect(() => {
    if (tab !== 1 || !user?.id || !id) return;

    setCargandoStats(true);
    let cancelled = false;

    void (async () => {
      try {
        const rows = await progresoService.obtenerEstadisticasEjercicioDetalle(id, user.id, periodo);
        if (!cancelled) setStatsRows(rows);
      } catch {
        if (!cancelled) setStatsRows([]);
      } finally {
        if (!cancelled) setCargandoStats(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, id, user?.id, periodo]);

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
      x: row.fecha,
      y: valorMetrica(row, metrica),
    }));
  }, [statsRows, metrica]);

  const secundariosTxt = ejercicio?.musculos_secundarios?.length
    ? ejercicio.musculos_secundarios.join(' · ')
    : '—';

  const equipTxt = (ejercicio?.equipamiento ?? '').trim() || '—';
  const dificultadTxt = (ejercicio?.dificultad ?? '').trim() || '—';

  const fotoUri = ejercicio?.foto_url?.trim() ?? '';

  const renderHistorialItem = useCallback(
    ({ item }: { item: SesionEjercicioHistorial }) => (
      <View style={styles.histCard}>
        <Pressable
          style={styles.histHeaderPress}
          onPress={() => router.push(`/(tabs)/(entrenamiento)/sesion/${item.sessionId}`)}
          accessibilityRole="button"
          accessibilityLabel="Abrir sesión"
        >
          <View style={styles.histHeaderIzq}>
            <Text style={styles.histFecha} numberOfLines={2}>
              {formatoFechaHistorialCard(item.fecha, item.horaInicio)}
            </Text>
            {item.sessionNombre ? (
              <Text style={styles.histNombre} numberOfLines={2}>
                {item.sessionNombre}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
        </Pressable>

        <View style={styles.histTablaHead}>
          <View style={styles.histColSerie}>
            <Text style={styles.histTh}>SERIE</Text>
          </View>
          <View style={styles.histColTipo}>
            <Text style={styles.histTh}>TIPO</Text>
          </View>
          <View style={styles.histColKg}>
            <Text style={styles.histTh}>KG</Text>
          </View>
          <View style={styles.histColReps}>
            <Text style={styles.histTh}>REPS</Text>
          </View>
        </View>

        {item.sets.map((st, idx) => (
          <View key={`${item.sessionId}-${st.numeroSerie}-${idx}`} style={[styles.histFila, idx > 0 && styles.histFilaSep]}>
            <View style={styles.histColSerie}>
              <Text style={styles.histTd}>{st.numeroSerie}</Text>
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
          </View>
        ))}
      </View>
    ),
    [c.textMuted, router, styles],
  );

  if (cargando) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.root, { paddingTop: insets.top }]}>
          <View style={styles.centerMsg}>
            <Text style={styles.loadingTxt}>[CARGANDO...]</Text>
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
              <Image
                source={{ uri: fotoUri }}
                style={styles.heroImg}
                contentFit="contain"
                cachePolicy="memory-disk"
                autoplay
              />
            ) : (
              <View style={styles.heroPlaceholder}>
                <Ionicons name="barbell-outline" size={48} color={c.textMuted} />
              </View>
            )}

            <View style={styles.card}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>MÚSCULO PRINCIPAL</Text>
                <Text style={styles.statValue}>{ejercicio.musculo_primario}</Text>
              </View>
              <View style={styles.statSep} />
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>MÚSCULOS SECUNDARIOS</Text>
                <Text style={styles.statValue}>{secundariosTxt}</Text>
              </View>
              <View style={styles.statSep} />
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>EQUIPAMIENTO</Text>
                <Text style={styles.statValue}>{equipTxt}</Text>
              </View>
              <View style={styles.statSep} />
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>DIFICULTAD</Text>
                <Text style={styles.statValue}>{dificultadTxt}</Text>
              </View>
              <View style={styles.statSep} />
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>CATEGORÍA</Text>
                <Text style={styles.statValue}>{etiquetaCategoria(ejercicio.categoria)}</Text>
              </View>
            </View>

            {ejercicio.descripcion != null && ejercicio.descripcion.trim() !== '' ? (
              <View style={styles.descBlock}>
                <Text style={styles.descTitle}>DESCRIPCIÓN</Text>
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
            ) : (
              <>
                <Pressable style={styles.periodoBtn} onPress={() => setModalPeriodo(true)} accessibilityRole="button">
                  <Text style={styles.periodoBtnTxt} numberOfLines={1}>
                    {etiquetaPeriodoSeleccionado(periodo)}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={c.textSecondary} />
                </Pressable>

                {cargandoStats ? (
                  <View style={[styles.centerMsg, { minHeight: CHART_H }]}>
                    <Text style={styles.loadingTxt}>[CARGANDO...]</Text>
                  </View>
                ) : (
                  <View style={styles.chartBlock}>
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
                )}

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsRow}>
                  {METRICA_OPTS.map((m) => {
                    const on = metrica === m.key;
                    return (
                      <Pressable key={m.key} style={[styles.chip, on && styles.chipOn]} onPress={() => setMetrica(m.key)}>
                        <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{m.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Text style={styles.recordsTitle}>RECORDS PERSONALES</Text>
                <View style={styles.recordsCard}>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>MAYOR PESO</Text>
                    <Text style={styles.statValue}>
                      {records ? `${records.mayorPeso.toFixed(1)} kg` : '—'}
                    </Text>
                  </View>
                  <View style={styles.statSep} />
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>MEJOR SERIE</Text>
                    <Text style={styles.statValue}>
                      {records
                        ? `${records.mejorSeriePesoKg.toFixed(1)} kg × ${records.mejorSerieReps} reps`
                        : '—'}
                    </Text>
                  </View>
                  <View style={styles.statSep} />
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>VOLUMEN TOTAL</Text>
                    <Text style={styles.statValue}>
                      {records ? `${records.mejorVolumenTotal.toFixed(1)} kg` : '—'}
                    </Text>
                  </View>
                </View>
              </>
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
              <Text style={styles.loadingTxt}>[CARGANDO...]</Text>
            </View>
          ) : (
            <FlatList
              data={historial}
              keyExtractor={(it) => it.sessionId}
              renderItem={renderHistorialItem}
              contentContainerStyle={{
                paddingTop: s.md,
                paddingBottom: insets.bottom + s.md,
                flexGrow: 1,
              }}
              ListEmptyComponent={
                <View style={styles.emptyHist}>
                  <Text style={styles.emptyHistTxt}>[SIN HISTORIAL]</Text>
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
    </>
  );
}
