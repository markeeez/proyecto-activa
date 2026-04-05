import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFont } from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bar, CartesianChart, Line } from 'victory-native';

import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';
import { fechaHoyIsoLocal, parseFechaLocal } from '@/lib/fechaNutricion';
import { ejerciciosService } from '@/services/ejercicios.service';
import {
  fechaInicioRangoProgreso,
  progresoService,
  type DistribucionMuscular,
  type EjercicioResumen,
  type EstadisticasEjercicio,
  type SesionEjercicioStats,
} from '@/services/progreso.service';

const SPACE_MONO_CHART = require('@expo-google-fonts/space-mono/400Regular/SpaceMono_400Regular.ttf');

type VistaEstado = 'lista' | 'detalle';
type PeriodoStats = '3m' | '1y' | 'all';

const PERIODO_LABELS: Record<PeriodoStats, string> = {
  '3m': '3 meses',
  '1y': '1 año',
  all: 'Todo',
};

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

function formatoEjeFecha(iso: string) {
  const d = parseFechaLocal(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

const CHART_H = 150;

const stylesChartBase = StyleSheet.create({
  wrap: { height: CHART_H, width: '100%' },
  vacio: { justifyContent: 'center', alignItems: 'center' },
});

function GraficoLineaMini({
  datos,
  colorPrimario,
  colorEtiqueta,
  colorGrid,
  formatY,
  fontMono,
}: {
  datos: { x: string; y: number }[];
  colorPrimario: string;
  colorEtiqueta: string;
  colorGrid: string;
  formatY: (n: number) => string;
  fontMono: string;
}) {
  const font = useFont(SPACE_MONO_CHART, 9);
  if (datos.length < 2) {
    return (
      <View style={[stylesChartBase.wrap, stylesChartBase.vacio]}>
        <Text style={{ fontFamily: fontMono, fontSize: 11, color: colorEtiqueta }}>Sin datos suficientes</Text>
      </View>
    );
  }
  const ys = datos.map((d) => d.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = Math.max(0.01, (maxY - minY) * 0.1);
  return (
    <View style={stylesChartBase.wrap}>
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
}: {
  datos: { x: string; y: number }[];
  colorPrimario: string;
  colorEtiqueta: string;
  colorGrid: string;
  formatY: (n: number) => string;
  fontMono: string;
}) {
  const font = useFont(SPACE_MONO_CHART, 9);
  if (datos.length < 2) {
    return (
      <View style={[stylesChartBase.wrap, stylesChartBase.vacio]}>
        <Text style={{ fontFamily: fontMono, fontSize: 11, color: colorEtiqueta }}>Sin datos suficientes</Text>
      </View>
    );
  }
  const maxY = Math.max(1, ...datos.map((d) => d.y));
  return (
    <View style={stylesChartBase.wrap}>
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
      borderBottomWidth: 1,
      borderBottomColor: c.borderVisible,
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
      paddingBottom: s.xs,
    },
    searchInput: {
      flex: 1,
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
      paddingVertical: s.xs,
    },
    chipsRow: {
      flexDirection: 'row',
      gap: s.xs,
      paddingHorizontal: s.md,
      marginTop: s.md,
    },
    chipShell: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    chipShellOn: { borderColor: c.primary, backgroundColor: c.primaryBg },
    chipLabelPress: {
      flex: 1,
      minWidth: 0,
      paddingVertical: s.xs,
      paddingLeft: s.sm,
      paddingRight: s.xxs,
      justifyContent: 'center',
    },
    chipTxt: { ...ts.caption, fontFamily: f.mono, color: c.textSecondary },
    chipTxtOn: { color: c.primary },
    chipClear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    /** ESTADO A: columna con lista flexible y bloque distribución fijo abajo */
    listaColumn: { flex: 1, flexDirection: 'column' },
    listaUpper: { flex: 1, minHeight: 0 },
    listaLoading: { flex: 1, justifyContent: 'center', padding: s.lg },
    distribListaFooter: { flexShrink: 0 },
    distribWrapListaFija: { marginBottom: 0 },
    list: { flex: 1, marginTop: s.sm },
    itemRow: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      paddingHorizontal: s.md,
      paddingVertical: s.md,
    },
    itemName: { ...ts.body, fontFamily: f.sansMedium, color: c.textDisplay },
    itemMuscle: { ...ts.caption, fontFamily: f.mono, color: c.textSecondary, marginTop: 2 },
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
    detalleNombre: {
      ...ts.heading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      paddingHorizontal: s.md,
      marginTop: s.md,
    },
    detalleSubs: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      paddingHorizontal: s.md,
      marginTop: s.xs,
    },
    gridMetricas: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: s.md,
      marginTop: s.md,
      gap: s.sm,
    },
    metricaCelda: {
      width: '47%',
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.sm,
      padding: s.sm,
      backgroundColor: c.surface,
    },
    metricaLabel: { ...ts.label, fontFamily: f.mono, color: c.textSecondary, marginBottom: 4 },
    metricaValor: { ...ts.subheading, fontFamily: f.sansMedium, color: c.textDisplay },
    segmentWrap: {
      flexDirection: 'row',
      marginHorizontal: s.md,
      marginTop: s.lg,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      overflow: 'hidden',
    },
    segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: c.surface },
    segmentBtnOn: { backgroundColor: c.primaryBg },
    segmentTxt: { ...ts.caption, fontFamily: f.mono, color: c.textSecondary },
    segmentTxtOn: { color: c.primary },
    chartsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: s.md,
      paddingBottom: s.md,
      gap: s.sm,
      marginTop: s.md,
    },
    chartCell: {
      width: '47%',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: r.md,
      padding: s.sm,
      backgroundColor: c.surfaceElevated,
    },
    chartTitle: { ...ts.caption, fontFamily: f.mono, color: c.textSecondary, marginBottom: s.xs },
    distribWrap: {
      marginHorizontal: s.md,
      marginTop: s.sm,
      marginBottom: s.xxl,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: r.md,
      padding: s.sm,
      backgroundColor: c.surfaceElevated,
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
  const [distribMuscular, setDistribMuscular] = useState<DistribucionMuscular[]>([]);
  const [cargandoDistrib, setCargandoDistrib] = useState(false);
  const [cargandoStats, setCargandoStats] = useState(false);

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

  useEffect(() => {
    if (vista !== 'detalle' || !user?.id || !seleccion) {
      setStats(null);
      return;
    }
    let cancel = false;
    void (async () => {
      setCargandoStats(true);
      try {
        const data = await progresoService.obtenerEstadisticasEjercicio(
          user.id,
          seleccion.id,
          fechaIniStats,
          fechaFinStats,
        );
        if (!cancel) setStats(data);
      } finally {
        if (!cancel) setCargandoStats(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [vista, user?.id, seleccion, fechaIniStats, fechaFinStats]);

  const renderChip = (
    labelBase: string,
    valorMostrar: string | null,
    activo: boolean,
    onOpen: () => void,
    onClear: () => void,
  ) => (
    <View style={[styles.chipShell, activo && styles.chipShellOn]}>
      <Pressable style={styles.chipLabelPress} onPress={onOpen} accessibilityRole="button">
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
              {renderChip('Músculo', musculo, Boolean(musculo), () => setFiltroModal('musculo'), () => setMusculo(null))}
              {renderChip(
                'Equipamiento',
                equipamiento,
                Boolean(equipamiento),
                () => setFiltroModal('equipamiento'),
                () => setEquipamiento(null),
              )}
            </View>
            {cargandoLista ? (
              <View style={styles.listaLoading}>
                <ActivityIndicator color={c.primary} />
              </View>
            ) : (
              <FlatList
                style={styles.list}
                data={listaFiltrada}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ flexGrow: 1, paddingBottom: s.md }}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyTxt}>
                      No hay ejercicios con sesiones registradas o no coinciden con los filtros.
                    </Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.itemRow}
                    onPress={() => {
                      setSeleccion(item);
                      setVista('detalle');
                    }}
                  >
                    <Text style={styles.itemName}>{item.nombre}</Text>
                    <Text style={styles.itemMuscle}>{item.musculo_primario}</Text>
                  </Pressable>
                )}
              />
            )}
          </View>
          <View style={[styles.distribListaFooter, { paddingBottom: insets.bottom + s.md }]}>
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + s.xl }}
          keyboardShouldPersistTaps="handled"
        >
          {seleccion ? (
            <>
              <Text style={styles.detalleNombre}>{seleccion.nombre}</Text>
              <Text style={styles.detalleSubs}>
                {seleccion.musculo_primario}
                {secundariosTxt ? ` · ${secundariosTxt}` : ''}
              </Text>

              {cargandoStats || !stats ? (
                <View style={styles.loading}>
                  <ActivityIndicator color={c.primary} />
                </View>
              ) : (
                <>
                  <View style={styles.gridMetricas}>
                    <View style={styles.metricaCelda}>
                      <Text style={styles.metricaLabel}>RUTINAS</Text>
                      <Text style={styles.metricaValor}>{stats.rutinas}</Text>
                    </View>
                    <View style={styles.metricaCelda}>
                      <Text style={styles.metricaLabel}>VECES</Text>
                      <Text style={styles.metricaValor}>{stats.veces}</Text>
                    </View>
                    <View style={styles.metricaCelda}>
                      <Text style={styles.metricaLabel}>MEJOR PESO</Text>
                      <Text style={styles.metricaValor}>
                        {stats.mejorPeso != null ? `${stats.mejorPeso} kg` : '—'}
                      </Text>
                    </View>
                    <View style={styles.metricaCelda}>
                      <Text style={styles.metricaLabel}>MEJOR REPS</Text>
                      <Text style={styles.metricaValor}>
                        {stats.mejorReps != null ? String(stats.mejorReps) : '—'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.segmentWrap}>
                    {(['3m', '1y', 'all'] as PeriodoStats[]).map((k) => (
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

                  <View style={styles.chartsGrid}>
                    <View style={styles.chartCell}>
                      <Text style={styles.chartTitle}>Mejor peso</Text>
                      <GraficoLineaMini
                        datos={datosPeso}
                        colorPrimario={c.primary}
                        colorEtiqueta={c.textSecondary}
                        colorGrid={c.border}
                        formatY={(n) => n.toFixed(0)}
                        fontMono={f.mono}
                      />
                    </View>
                    <View style={styles.chartCell}>
                      <Text style={styles.chartTitle}>Volumen</Text>
                      <GraficoLineaMini
                        datos={datosVol}
                        colorPrimario={c.primary}
                        colorEtiqueta={c.textSecondary}
                        colorGrid={c.border}
                        formatY={(n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(0))}
                        fontMono={f.mono}
                      />
                    </View>
                    <View style={styles.chartCell}>
                      <Text style={styles.chartTitle}>Mejor reps</Text>
                      <GraficoLineaMini
                        datos={datosReps}
                        colorPrimario={c.primary}
                        colorEtiqueta={c.textSecondary}
                        colorGrid={c.border}
                        formatY={(n) => String(Math.round(n))}
                        fontMono={f.mono}
                      />
                    </View>
                    <View style={styles.chartCell}>
                      <Text style={styles.chartTitle}>Series</Text>
                      <GraficoBarrasMini
                        datos={datosSeries}
                        colorPrimario={c.primary}
                        colorEtiqueta={c.textSecondary}
                        colorGrid={c.border}
                        formatY={(n) => String(Math.round(n))}
                        fontMono={f.mono}
                      />
                    </View>
                  </View>
                </>
              )}
            </>
          ) : null}
        </ScrollView>
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
    </View>
  );
}
