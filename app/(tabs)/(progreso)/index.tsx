import { Ionicons } from '@expo/vector-icons';
import { useFont } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bar, CartesianChart, Line } from 'victory-native';

import ProgressNavIcon from '@/assets/images/progress_nav_icon.svg';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  agregarDiasIso,
  fechaHoyIsoLocal,
  parseFechaLocal,
} from '@/lib/fechaNutricion';
import { supabase } from '@/lib/supabase';
import {
  progresoService,
  type NutricionDia,
  type NutricionSemana,
  type PlanActual,
  type ProgresoPeso,
  type RegistroPeso,
} from '@/services/progreso.service';

const SPACE_MONO_CHART = require('@expo-google-fonts/space-mono/400Regular/SpaceMono_400Regular.ttf');

const MESES_CORTO = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

function formatoEjeSemana(iso: string): string {
  const d = parseFechaLocal(iso);
  return `${MESES_CORTO[d.getMonth()]} ${d.getDate()}`;
}

function formatoFechaLista(iso: string): string {
  const d = parseFechaLocal(iso);
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()]}`;
}

function formatoEjeDia(iso: string): string {
  const d = parseFechaLocal(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function inicialesDeUsuario(username: string | undefined, email: string | undefined): string {
  const u = (username ?? '').trim();
  if (u.length >= 2) return u.slice(0, 2).toUpperCase();
  if (u.length === 1) return u.toUpperCase();
  const e = (email ?? '').trim();
  if (e.length >= 2) return e.slice(0, 2).toUpperCase();
  return 'AC';
}

type RangoFiltro = '1w' | '3m' | '1y';
type MetricaNut = 'kcal' | 'carbos' | 'proteinas' | 'grasas';
type ChipNut = { key: MetricaNut; label: string; icon?: keyof typeof Ionicons.glyphMap };

const FILTRO_LABELS: Record<RangoFiltro, string> = {
  '3m': 'Últimos 3 meses',
  '1y': 'Último año',
  '1w': 'Últimos 7 días',
};

function valorMetrica(row: NutricionSemana | NutricionDia, m: MetricaNut): number {
  switch (m) {
    case 'kcal':
      return row.kcal;
    case 'carbos':
      return row.carbos;
    case 'proteinas':
      return row.proteinas;
    case 'grasas':
      return row.grasas;
    default:
      return 0;
  }
}

type TabProgreso = 'datos' | 'plan';

function textoObjetivoLegible(objetivoDb: string): string {
  switch (objetivoDb) {
    case 'perder_peso':
      return 'Perder grasa';
    case 'mantener':
      return 'Mantener peso';
    case 'ganar_masa':
      return 'Ganar masa muscular';
    case 'mejorar_rendimiento':
      return 'Mejorar rendimiento';
    default:
      return objetivoDb;
  }
}

/** Texto para "DÍAS CON ESTE PLAN: …" según `user_goals.created_at`. */
function textoDiasConEstePlan(createdAtIso: string): string {
  if (!createdAtIso.trim()) return '—';
  const hoy = new Date();
  const createdAt = new Date(createdAtIso);
  const dias = Math.floor((hoy.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  if (dias === 0) return 'Hoy';
  if (dias === 1) return '1 día';
  return `${dias} días`;
}

function fmtPesoKgTabPlan(kg: number): string {
  const t = kg.toFixed(1);
  return t.endsWith('.0') ? String(Math.round(kg)) : t;
}

function textoTituloSemanaActual(metrica: MetricaNut, valor: number): string {
  const n = Math.round(valor);
  switch (metrica) {
    case 'kcal':
      return `${n.toLocaleString('es-ES')} kcal esta semana`;
    case 'carbos':
      return `${n.toLocaleString('es-ES')} g carbohidratos esta semana`;
    case 'proteinas':
      return `${n.toLocaleString('es-ES')} g proteína esta semana`;
    case 'grasas':
      return `${n.toLocaleString('es-ES')} g grasas esta semana`;
    default:
      return '';
  }
}

/** Barras nutrición: x = índice 0..n-1 (único), semanaInicio = lunes ISO para etiqueta. */
type FilaNutChart = { x: number; y: number; label: string };

/**
 * PERF-06: Muestreo uniforme de series temporales.
 * Reduce el array a `maxPuntos` elementos distribuidos uniformemente.
 * Siempre conserva el primer y el último punto para que el rango sea correcto.
 */
function muestrear<T>(arr: T[], maxPuntos: number): T[] {
  if (arr.length <= maxPuntos) return arr;
  const last = arr.length - 1;
  return Array.from({ length: maxPuntos }, (_, i) => {
    const idx = i === maxPuntos - 1 ? last : Math.round((i / (maxPuntos - 1)) * last);
    return arr[idx]!;
  });
}

function pasoEtiquetasEjeX(numBarras: number): number {
  if (numBarras <= 8) return 1;
  if (numBarras <= 16) return 2;
  return 3;
}

const GraficoBarrasNutricion = memo(function GraficoBarrasNutricion({
  datos,
  colorPrimario,
  colorEtiqueta,
  colorGrid,
  vacioTexto,
  fontMono,
}: {
  datos: FilaNutChart[];
  colorPrimario: string;
  colorEtiqueta: string;
  colorGrid: string;
  vacioTexto: string;
  fontMono: string;
}) {
  const font = useFont(SPACE_MONO_CHART, 10);
  if (datos.length === 0) {
    return (
      <View style={[stylesChart.wrap, stylesChart.vacio]}>
        <Text style={{ fontFamily: fontMono, fontSize: 12, color: colorEtiqueta }}>{vacioTexto}</Text>
      </View>
    );
  }
  const maxY = Math.max(1, ...datos.map((d) => d.y));
  const n = datos.length;
  const step = pasoEtiquetasEjeX(n);
  const formatXLabel = (raw: string | number) => {
    const idx = Math.min(n - 1, Math.max(0, Math.round(Number(raw))));
    const ultima = idx === n - 1;
    if (idx % step !== 0 && !ultima) return '';
    return datos[idx]!.label;
  };

  return (
    <View style={stylesChart.wrap}>
      <CartesianChart<{ x: number; y: number; label: string }, 'x', 'y'>
        data={datos}
        xKey="x"
        yKeys={['y']}
        domain={{ y: [0, maxY * 1.12] }}
        domainPadding={{ left: 24, right: 24, top: 28, bottom: 8 }}
        axisOptions={
          font
            ? {
                font,
                formatXLabel,
                formatYLabel: (v) => Math.round(Number(v)).toLocaleString('es-ES'),
                labelColor: { x: colorEtiqueta, y: colorEtiqueta },
                lineColor: {
                  grid: { x: colorGrid, y: colorGrid },
                  frame: colorGrid,
                },
              }
            : undefined
        }
      >
        {({ points, chartBounds }) => (
          <Bar
            chartBounds={chartBounds}
            points={points.y}
            roundedCorners={{ topLeft: 4, topRight: 4 }}
            color={colorPrimario}
          />
        )}
      </CartesianChart>
    </View>
  );
});

const GraficoLineaPeso = memo(function GraficoLineaPeso({
  datos,
  colorPrimario,
  colorEtiqueta,
  colorGrid,
}: {
  datos: { x: string; y: number }[];
  colorPrimario: string;
  colorEtiqueta: string;
  colorGrid: string;
}) {
  const font = useFont(SPACE_MONO_CHART, 10);
  const ys = datos.map((d) => d.y);
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 1;
  const pad = Math.max(1, (maxY - minY) * 0.12);

  return (
    <View style={stylesChart.wrap}>
      <CartesianChart<{ x: string; y: number }, 'x', 'y'>
        data={datos}
        xKey="x"
        yKeys={['y']}
        domain={{
          y: [Math.max(0, minY - pad), maxY + pad],
        }}
        domainPadding={{ left: 8, right: 12, top: 20, bottom: 8 }}
        axisOptions={
          font
            ? {
                font,
                formatXLabel: (v) => {
                  const d = parseFechaLocal(String(v));
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                },
                formatYLabel: (v) => `${Number(v).toFixed(1)}`,
                labelColor: { x: colorEtiqueta, y: colorEtiqueta },
                lineColor: {
                  grid: { x: colorGrid, y: colorGrid },
                  frame: colorGrid,
                },
              }
            : undefined
        }
      >
        {({ points }) => (
          <Line
            points={points.y}
            color={colorPrimario}
            strokeWidth={2}
            curveType="natural"
          />
        )}
      </CartesianChart>
    </View>
  );
});

const stylesChart = StyleSheet.create({
  wrap: { height: 150, width: '100%' },
  vacio: { justifyContent: 'center', alignItems: 'center' },
});

export default function ProgresoIndex() {
  const { c, f, ts, s, r, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [perfilUsername, setPerfilUsername] = useState<string | null>(null);
  const [diasRegistrados, setDiasRegistrados] = useState(0);
  const [numEntrenos, setNumEntrenos] = useState(0);

  const [rangoNutricion, setRangoNutricion] = useState<RangoFiltro>('1w');
  const [rangoPeso, setRangoPeso] = useState<RangoFiltro>('1w');
  const [menuNutAbierto, setMenuNutAbierto] = useState(false);
  const [menuPesoAbierto, setMenuPesoAbierto] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0 });

  const [metricaNut, setMetricaNut] = useState<MetricaNut>('kcal');
  const [nutricionSemanal, setNutricionSemanal] = useState<NutricionSemana[]>([]);
  const [nutricionDiaria, setNutricionDiaria] = useState<NutricionDia[]>([]);
  const [cargandoNut, setCargandoNut] = useState(false);

  const [historialPeso, setHistorialPeso] = useState<RegistroPeso[]>([]);
  const [cargandoPesoGraf, setCargandoPesoGraf] = useState(false);

  const [pesoTexto, setPesoTexto] = useState('');
  const [pesoGuardado, setPesoGuardado] = useState<number | null>(null);
  const [ultimosPesos, setUltimosPesos] = useState<RegistroPeso[]>([]);
  const [guardandoPeso, setGuardandoPeso] = useState(false);

  const [tabPrincipal, setTabPrincipal] = useState<TabProgreso>('datos');
  const [planActual, setPlanActual] = useState<PlanActual | null>(null);
  const [progresoPeso, setProgresoPeso] = useState<ProgresoPeso | null>(null);
  const [cargandoPlan, setCargandoPlan] = useState(false);

  const hoyIso = fechaHoyIsoLocal();

  /** Rango nutrición: 90 días / 365 días / desde alta (no el mismo criterio que el gráfico de peso). */
  const fechaIniNut = useMemo(() => {
    if (rangoNutricion === '1w') return agregarDiasIso(hoyIso, -6);
    if (rangoNutricion === '3m') return agregarDiasIso(hoyIso, -90);
    return agregarDiasIso(hoyIso, -365);
  }, [rangoNutricion, hoyIso]);
  const fechaIniPeso = useMemo(() => {
    if (rangoPeso === '1w') return agregarDiasIso(hoyIso, -6);
    if (rangoPeso === '3m') return agregarDiasIso(hoyIso, -90);
    return agregarDiasIso(hoyIso, -365);
  }, [rangoPeso, hoyIso]);

  const styles = useMemo(() => makeStyles(c, f, ts, s, r, isDark), [c, f, ts, s, r, isDark]);

  const displayName =
    (perfilUsername?.trim() || null) ??
    ((user?.user_metadata?.full_name as string | undefined)?.trim() || null) ??
    ((user?.user_metadata?.name as string | undefined)?.trim() || null) ??
    user?.email?.split('@')[0] ??
    'Usuario';
  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.picture as string | undefined);

  useEffect(() => {
    if (!user?.id) return;
    let cancel = false;
    void (async () => {
      try {
        const [{ data: perfilRow }, d, e] = await Promise.all([
          supabase.from('profiles').select('username').eq('id', user.id).maybeSingle(),
          progresoService.obtenerContadorDiasRegistrados(user.id),
          progresoService.obtenerContadorEntrenos(user.id),
        ]);
        if (cancel) return;
        const rawUsername = (perfilRow?.username as string | undefined)?.trim() ?? '';
        setPerfilUsername(rawUsername || null);
        setDiasRegistrados(d);
        setNumEntrenos(e);
      } catch {
        if (!cancel) setPerfilUsername(null);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let cancel = false;
    void (async () => {
      setCargandoNut(true);
      try {
        if (rangoNutricion === '1w') {
          const data = await progresoService.obtenerNutricionDiaria(user.id, fechaIniNut, hoyIso);
          if (!cancel) {
            setNutricionDiaria(data);
            setNutricionSemanal([]);
          }
        } else {
          const data = await progresoService.obtenerNutricionSemanal(user.id, fechaIniNut, hoyIso);
          if (!cancel) {
            setNutricionSemanal(data);
            setNutricionDiaria([]);
          }
        }
      } finally {
        if (!cancel) setCargandoNut(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user?.id, fechaIniNut, hoyIso, rangoNutricion]);

  useEffect(() => {
    if (!user?.id) return;
    let cancel = false;
    void (async () => {
      setCargandoPesoGraf(true);
      try {
        const data = await progresoService.obtenerHistorialPeso(user.id, fechaIniPeso, hoyIso);
        if (!cancel) setHistorialPeso(data);
      } finally {
        if (!cancel) setCargandoPesoGraf(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user?.id, fechaIniPeso, hoyIso]);

  const recargarBloquePeso = useCallback(async () => {
    if (!user?.id) return;
    const hoy = fechaHoyIsoLocal();
    const [{ data: hoyRow }, { data: ultRows }] = await Promise.all([
      supabase.from('user_body_metrics').select('peso_kg').eq('user_id', user.id).eq('fecha', hoy).maybeSingle(),
      supabase
        .from('user_body_metrics')
        .select('fecha, peso_kg')
        .eq('user_id', user.id)
        .not('peso_kg', 'is', null)
        .order('fecha', { ascending: false })
        .limit(7),
    ]);
    const raw = hoyRow?.peso_kg;
    const hoyVal = raw != null && !Number.isNaN(Number(raw)) ? Number(raw) : null;
    setPesoGuardado(hoyVal);
    setPesoTexto(hoyVal != null ? String(hoyVal) : '');
    const ult: RegistroPeso[] = (ultRows ?? [])
      .map((r) => ({ fecha: r.fecha as string, peso_kg: Number(r.peso_kg) }))
      .filter((r) => !Number.isNaN(r.peso_kg));
    setUltimosPesos(ult);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    void recargarBloquePeso();
  }, [user?.id, recargarBloquePeso]);

  const recargarPlan = useCallback(async () => {
    if (!user?.id || tabPrincipal !== 'plan') return;
    setCargandoPlan(true);
    try {
      const [p, prog] = await Promise.all([
        progresoService.obtenerPlanActual(user.id),
        progresoService.obtenerProgresoPeso(user.id),
      ]);
      setPlanActual(p);
      setProgresoPeso(prog);
    } catch {
      setPlanActual(null);
      setProgresoPeso(null);
    } finally {
      setCargandoPlan(false);
    }
  }, [user?.id, tabPrincipal]);

  useFocusEffect(
    useCallback(() => {
      void recargarPlan();
    }, [recargarPlan]),
  );

  useEffect(() => {
    void recargarPlan();
  }, [recargarPlan]);

  const pctMacrosPlan = useMemo(() => {
    if (!planActual) return { prot: 0, carb: 0, gras: 0 };
    const k = planActual.calorias_objetivo;
    if (k <= 0) return { prot: 0, carb: 0, gras: 0 };
    const prot_pct = Math.round(((planActual.proteinas_objetivo * 4) / k) * 100);
    const carb_pct = Math.round(((planActual.carbos_objetivo * 4) / k) * 100);
    const gras_pct = 100 - prot_pct - carb_pct;
    return { prot: prot_pct, carb: carb_pct, gras: gras_pct };
  }, [planActual]);

  const datosNutricionActuales = rangoNutricion === '1w' ? nutricionDiaria : nutricionSemanal;
  const valorPromedioNutricion = useMemo(() => {
    const valores = datosNutricionActuales.map((row) => valorMetrica(row, metricaNut)).filter((v) => v > 0);
    if (valores.length === 0) return 0;
    return valores.reduce((acc, value) => acc + value, 0) / valores.length;
  }, [datosNutricionActuales, metricaNut]);

  const datosBarNut: FilaNutChart[] = useMemo(() => {
    // PERF-06: máximo 52 barras (1 año de semanas). Muestreo uniforme si hay más.
    const filtered =
      rangoNutricion === '1w'
        ? datosNutricionActuales
        : datosNutricionActuales.filter((row) => valorMetrica(row, metricaNut) > 0);
    const sampled = muestrear(filtered, rangoNutricion === '1w' ? 7 : 52);
    return sampled.map((row, i) => ({
      x: i,
      y: valorMetrica(row, metricaNut),
      label: 'fecha' in row ? formatoEjeDia(row.fecha) : formatoEjeSemana(row.semanaInicio),
    }));
  }, [datosNutricionActuales, metricaNut, rangoNutricion]);

  const datosLineaPeso = useMemo(() => {
    if (rangoPeso === '1w') {
      return [...ultimosPesos].reverse().map((r) => ({ x: r.fecha, y: r.peso_kg }));
    }
    // PERF-06: máximo 90 puntos. Muestreo uniforme si hay más (ej. "todo el tiempo").
    const sampled = muestrear(historialPeso, 90);
    return sampled.map((r) => ({ x: r.fecha, y: r.peso_kg }));
  }, [historialPeso, rangoPeso, ultimosPesos]);

  const numPesoIngresado = parseFloat(pesoTexto.replace(',', '.'));
  const pesoInvalido = pesoTexto.trim() === '' || Number.isNaN(numPesoIngresado);
  const sinCambioPeso = pesoGuardado !== null && numPesoIngresado === pesoGuardado;
  const guardarPesoDeshabilitado = guardandoPeso || pesoInvalido || sinCambioPeso;

  const onGuardarPeso = async () => {
    if (!user?.id || guardarPesoDeshabilitado) return;
    setGuardandoPeso(true);
    try {
      await progresoService.upsertPesoHoy(user.id, numPesoIngresado);
      await recargarBloquePeso();
      const hist = await progresoService.obtenerHistorialPeso(user.id, fechaIniPeso, hoyIso);
      setHistorialPeso(hist);
    } finally {
      setGuardandoPeso(false);
    }
  };

  const abrirMenuFiltro = (event: GestureResponderEvent, tipo: 'nutricion' | 'peso') => {
    setMenuAnchor({
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    });
    setMenuNutAbierto(tipo === 'nutricion');
    setMenuPesoAbierto(tipo === 'peso');
  };

  const chipDefs: ChipNut[] = [
    { key: 'kcal', label: 'Kcal', icon: 'flame-outline' },
    { key: 'carbos', label: 'Carbohidratos', icon: 'leaf-outline' },
    { key: 'proteinas', label: 'Proteína' },
    { key: 'grasas', label: 'Grasas', icon: 'water-outline' },
  ];

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.muted}>Inicia sesión para ver tu progreso</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.mainColumn}
        contentContainerStyle={[styles.mainContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* —— Header perfil —— */}
        <View style={styles.headerBlock}>
          <View style={styles.headerRow}>
            <View style={styles.avatarWrap}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <View style={[styles.avatarImg, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarIniciales}>{inicialesDeUsuario(displayName, user.email ?? undefined)}</Text>
                </View>
              )}
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.username} numberOfLines={1}>
                {displayName}
              </Text>
              <View style={styles.metricasRow}>
                <View style={styles.metricaItem}>
                  <Ionicons name="calendar-outline" size={12} color={c.textSecondary} />
                  <Text style={styles.metricaCaption}>
                    <Text style={styles.metricaNum}>{diasRegistrados}</Text> Registros
                  </Text>
                </View>
                <View style={styles.metricaItem}>
                  <Ionicons name="barbell-outline" size={12} color={c.textSecondary} />
                  <Text style={styles.metricaCaption}>
                    <Text style={styles.metricaNum}>{numEntrenos}</Text> Entrenos
                  </Text>
                </View>
              </View>
            </View>
            <Pressable
              onPress={() => router.push('/(tabs)/(progreso)/estadisticas-ejercicio')}
              style={styles.headerAction}
              accessibilityRole="button"
              accessibilityLabel="Estadísticas de ejercicios"
            >
              <ProgressNavIcon width={22} height={22} color={c.primary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.tabsWrap}>
          <View style={styles.tabsPill}>
            <Pressable
              style={[styles.tabBtn, tabPrincipal === 'datos' && styles.tabBtnOn]}
              onPress={() => setTabPrincipal('datos')}
              accessibilityRole="button"
              accessibilityState={{ selected: tabPrincipal === 'datos' }}
            >
              <Text style={[styles.tabBtnTxt, tabPrincipal === 'datos' && styles.tabBtnTxtOn]}>DATOS</Text>
            </Pressable>
            <Pressable
              style={[styles.tabBtn, tabPrincipal === 'plan' && styles.tabBtnOn]}
              onPress={() => setTabPrincipal('plan')}
              accessibilityRole="button"
              accessibilityState={{ selected: tabPrincipal === 'plan' }}
            >
              <Text style={[styles.tabBtnTxt, tabPrincipal === 'plan' && styles.tabBtnTxtOn]}>PLAN</Text>
            </Pressable>
          </View>
        </View>

        {tabPrincipal === 'datos' ? (
          <>
        {/* —— Nutrición semanal —— */}
        <View
          style={[styles.section, styles.blockNutricion]}
          accessibilityLabel={textoTituloSemanaActual(metricaNut, valorPromedioNutricion)}
        >
          <View style={styles.rowTitleFiltro}>
            <Text style={styles.tituloDestacadoNut} numberOfLines={1}>Consumo calórico</Text>
            <Pressable
              onPress={(event) => abrirMenuFiltro(event, 'nutricion')}
              style={styles.filtroPill}
              accessibilityRole="button"
              accessibilityLabel="Rango de tiempo nutrición"
            >
              <Text style={styles.filtroPillText} numberOfLines={1}>{FILTRO_LABELS[rangoNutricion]}</Text>
              <Ionicons name="chevron-down" size={16} color={c.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.kcalSummaryRow}>
            <View>
              <Text style={styles.kcalValue}>
                {Math.round(valorPromedioNutricion).toLocaleString('es-ES')}{' '}
                <Text style={styles.kcalUnit}>{metricaNut === 'kcal' ? 'kcal' : 'g'}</Text>
              </Text>
              <Text style={styles.kcalSub}>promedio diario</Text>
            </View>
          </View>

          {cargandoNut ? (
            <View style={styles.chartLoading}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : (
            <GraficoBarrasNutricion
              datos={datosBarNut}
              colorPrimario={c.primary}
              colorEtiqueta={c.textSecondary}
              colorGrid={c.border}
              vacioTexto="Sin datos en este rango"
              fontMono={f.mono}
            />
          )}

          <View style={styles.chipsRow}>
            {chipDefs.map(({ key, label, icon }) => {
              const activo = metricaNut === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setMetricaNut(key)}
                  style={[styles.chip, activo ? styles.chipActivo : styles.chipOutline]}
                >
                  <Ionicons
                    name={iconoMetricaNut(key, icon)}
                    size={13}
                    color={activo ? c.textOnPrimary : c.textSecondary}
                  />
                  <Text style={[styles.chipText, activo ? styles.chipTextActivo : styles.chipTextOutline]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* —— Estadísticas ejercicios —— */}
        <Pressable
          style={styles.cardStat}
          onPress={() => router.push('./estadisticas-ejercicio')}
          accessibilityRole="button"
        >
          <Text style={styles.cardStatTitle}>Estadísticas ejercicios</Text>
          <Ionicons name="chevron-forward" size={22} color={c.textSecondary} />
        </Pressable>

        {/* —— Peso —— */}
        <View style={[styles.section, styles.blockPeso]}>
          <View style={styles.rowTitleFiltro}>
            <Text style={styles.tituloDestacadoNut} numberOfLines={1}>Peso corporal</Text>
            <Pressable
              onPress={(event) => abrirMenuFiltro(event, 'peso')}
              style={styles.filtroPillPeso}
              accessibilityRole="button"
            >
              <Text style={styles.filtroPillTextPeso}>Filtrar</Text>
              <Ionicons name="chevron-down" size={14} color={c.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.dosColumnas}>
            <View style={styles.colIzq}>
              <Text style={styles.labelHoy}>HOY</Text>
              <View style={styles.pesoInputRow}>
                <TextInput
                  style={styles.inputPeso}
                  value={pesoTexto}
                  onChangeText={(value) => setPesoTexto(limpiarDecimalUnico(value))}
                  placeholder="--"
                  placeholderTextColor={c.textMuted}
                  keyboardType="decimal-pad"
                  editable={!guardandoPeso}
                  selectTextOnFocus
                />
                <Text style={styles.pesoUnidad}>kg</Text>
                <Ionicons name="create-outline" size={15} color={c.primary} />
              </View>
              <Pressable
                onPress={onGuardarPeso}
                disabled={guardarPesoDeshabilitado}
                style={[styles.btnGuardar, guardarPesoDeshabilitado && styles.btnGuardarOff]}
              >
                {guardandoPeso ? (
                  <ActivityIndicator color={c.textOnPrimary} size="small" />
                ) : (
                  <Text style={styles.btnGuardarText}>GUARDAR</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.colDer}>
              <View style={styles.rowFiltroPesoGraf}>
                <Text style={styles.subtituloEvolucionPeso} numberOfLines={1} ellipsizeMode="tail">
                  Evolución
                </Text>
                <Pressable
                  onPress={(event) => abrirMenuFiltro(event, 'peso')}
                  style={styles.filtroPillPeso}
                  accessibilityRole="button"
                >
                  <Text
                    style={styles.filtroPillTextPeso}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {FILTRO_LABELS[rangoPeso]}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={c.textSecondary} />
                </Pressable>
              </View>
              {cargandoPesoGraf ? (
                <View style={styles.chartLoading}>
                  <ActivityIndicator color={c.primary} />
                </View>
              ) : datosLineaPeso.length < 2 ? (
                <View style={styles.sinDatosGraf}>
                  <Text style={styles.sinDatosTexto}>Sin datos suficientes</Text>
                </View>
              ) : (
                <GraficoLineaPeso
                  datos={datosLineaPeso}
                  colorPrimario={c.primary}
                  colorEtiqueta={c.textSecondary}
                  colorGrid={c.border}
                />
              )}
            </View>
          </View>
          <View style={styles.listaPeso}>
            {ultimosPesos.map((row, i) => (
              <View
                key={`${row.fecha}-${i}`}
                style={styles.filaPeso}
              >
                <Text style={styles.filaPesoIzq}>{row.peso_kg} kg</Text>
                <View style={styles.filaPesoRight}>
                  <Text style={styles.filaPesoDer}>{formatoFechaLista(row.fecha)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
          </>
        ) : (
          <View style={styles.planTab}>
            {cargandoPlan ? (
              <View style={styles.planCargando}>
                <ActivityIndicator color={c.primary} />
              </View>
            ) : planActual ? (
              <>
                {/* ── Fila superior: objetivo + días ── */}
                <View style={styles.ndPlanTopRow}>
                  <View style={styles.ndPlanTopLeft}>
                    <Text style={styles.ndLabel}>OBJETIVO</Text>
                    <Text style={styles.ndObjTitulo} numberOfLines={1}>
                      {textoObjetivoLegible(planActual.objetivo)}
                    </Text>
                  </View>
                  <View style={styles.ndPlanTopRight}>
                    <Text style={styles.ndLabel}>PLAN ACTIVO</Text>
                    <Text style={styles.ndDiasBig}>{textoDiasConEstePlan(planActual.created_at)}</Text>
                  </View>
                </View>

                {/* ── Hero kcal ── */}
                <View style={styles.ndKcalHero}>
                  <Text style={styles.ndKcalNum}>
                    {Math.round(planActual.calorias_objetivo).toLocaleString('es-ES')}
                  </Text>
                  <Text style={styles.ndKcalUnit}>kcal/día</Text>
                </View>

                {/* ── Macros como barras segmentadas ── */}
                <View style={styles.ndMacrosBlock}>
                  {[
                    { label: 'PROTEÍNAS', g: planActual.proteinas_objetivo, pct: pctMacrosPlan.prot, segs: 16 },
                    { label: 'CARBOS',    g: planActual.carbos_objetivo,    pct: pctMacrosPlan.carb, segs: 16 },
                    { label: 'GRASAS',    g: planActual.grasas_objetivo,    pct: pctMacrosPlan.gras, segs: 16 },
                  ].map(({ label, g, pct, segs }) => {
                    const filled = Math.round((pct / 100) * segs);
                    return (
                      <View key={label} style={styles.ndMacroRow}>
                        <View style={styles.ndMacroMeta}>
                          <Text style={styles.ndLabel}>{label}</Text>
                          <View style={styles.ndMacroValueRow}>
                            <Text style={styles.ndMacroG}>{g}</Text>
                            <Text style={styles.ndMacroUnit}>g</Text>
                            <Text style={styles.ndMacroPct}>{pct}%</Text>
                          </View>
                        </View>
                        <View style={styles.ndSegBar}>
                          {Array.from({ length: segs }, (_, i) => (
                            <View
                              key={i}
                              style={[
                                styles.ndSeg,
                                { backgroundColor: i < filled ? c.textDisplay : 'transparent',
                                  borderColor: i < filled ? c.textDisplay : c.borderVisible,
                                  borderWidth: 1 },
                              ]}
                            />
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* ── Barra de progreso al objetivo ── */}
                {progresoPeso ? (
                  <View style={styles.ndProgresoBlock}>
                    <View style={styles.ndProgresoHeader}>
                      <Text style={styles.ndLabel}>PROGRESO AL OBJETIVO</Text>
                      <Text style={styles.ndPctHero}>{Math.round(progresoPeso.porcentaje)}%</Text>
                    </View>
                    <View style={styles.ndProgresoBarRow}>
                      {Array.from({ length: 24 }, (_, i) => {
                        const filled = Math.min(24, Math.max(0, Math.round((progresoPeso.porcentaje / 100) * 24)));
                        return (
                          <View
                            key={i}
                            style={[
                              styles.ndProgresoSeg,
                              { backgroundColor: i < filled ? c.textDisplay : 'transparent',
                                borderColor: i < filled ? c.textDisplay : c.borderVisible,
                                borderWidth: 1 },
                            ]}
                          />
                        );
                      })}
                    </View>
                    <View style={styles.ndProgresoFooter}>
                      <Text style={styles.ndProgresoKg}>{fmtPesoKgTabPlan(progresoPeso.pesoInicio)} kg</Text>
                      <Text style={styles.ndProgresoDesc}>
                        {progresoPeso.objetivo === 'perder_peso' ? 'pérdida' : 'ganancia'}
                      </Text>
                      <Text style={styles.ndProgresoKg}>{fmtPesoKgTabPlan(progresoPeso.pesoObjetivo)} kg</Text>
                    </View>
                  </View>
                ) : null}

                {/* ── CTA ── */}
                <Pressable
                  onPress={() => router.navigate('/(tabs)/(progreso)/personalizar-plan')}
                  style={styles.ndPlanCta}
                  accessibilityRole="button"
                  accessibilityLabel="Personalizar plan"
                >
                  <Text style={styles.ndPlanCtaTxt}>PERSONALIZAR PLAN</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.ndEmptyTxt}>SIN PLAN GUARDADO</Text>
                <Pressable
                  onPress={() => router.navigate('/(tabs)/(progreso)/personalizar-plan')}
                  style={styles.ndPlanCta}
                  accessibilityRole="button"
                >
                  <Text style={styles.ndPlanCtaTxt}>CONFIGURAR PLAN</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </ScrollView>

      {menuNutAbierto ? (
        <View style={styles.filterMenuLayer} pointerEvents="box-none">
          <Pressable style={styles.filterMenuDismiss} onPress={() => setMenuNutAbierto(false)} />
          <View
            style={[
              styles.filterMenuPopover,
              {
                top: Math.min(menuAnchor.y + 10, windowHeight - 176),
                left: Math.min(Math.max(menuAnchor.x - 166, s.md), windowWidth - 198),
              },
            ]}
          >
            <Text style={styles.filterMenuTitle}>Consumo calórico</Text>
            {(['1w', '3m', '1y'] as RangoFiltro[]).map((k) => {
              const activo = rangoNutricion === k;
              return (
                <Pressable
                  key={k}
                  style={styles.filterMenuOption}
                  onPress={() => {
                    setRangoNutricion(k);
                    setMenuNutAbierto(false);
                  }}
                >
                  <Ionicons name={activo ? 'checkmark-circle' : 'ellipse-outline'} size={17} color={activo ? c.primary : c.textSecondary} />
                  <Text style={[styles.filterMenuOptionText, activo && styles.filterMenuOptionTextActive]}>
                    {FILTRO_LABELS[k]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {menuPesoAbierto ? (
        <View style={styles.filterMenuLayer} pointerEvents="box-none">
          <Pressable style={styles.filterMenuDismiss} onPress={() => setMenuPesoAbierto(false)} />
          <View
            style={[
              styles.filterMenuPopover,
              {
                top: Math.min(menuAnchor.y + 10, windowHeight - 176),
                left: Math.min(Math.max(menuAnchor.x - 166, s.md), windowWidth - 198),
              },
            ]}
          >
            <Text style={styles.filterMenuTitle}>Peso corporal</Text>
            {(['1w', '3m', '1y'] as RangoFiltro[]).map((k) => {
              const activo = rangoPeso === k;
              return (
                <Pressable
                  key={k}
                  style={styles.filterMenuOption}
                  onPress={() => {
                    setRangoPeso(k);
                    setMenuPesoAbierto(false);
                  }}
                >
                  <Ionicons name={activo ? 'checkmark-circle' : 'ellipse-outline'} size={17} color={activo ? c.primary : c.textSecondary} />
                  <Text style={[styles.filterMenuOptionText, activo && styles.filterMenuOptionTextActive]}>
                    {FILTRO_LABELS[k]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(
  c: ReturnType<typeof useTheme>['c'],
  f: ReturnType<typeof useTheme>['f'],
  ts: ReturnType<typeof useTheme>['ts'],
  s: ReturnType<typeof useTheme>['s'],
  r: ReturnType<typeof useTheme>['r'],
  isDark: boolean,
) {
  const tabTxtOn = isDark ? '#000000' : '#FFFFFF';
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    mainColumn: {
      flex: 1,
    },
    mainContent: {
      paddingHorizontal: s.md,
      gap: s.md,
    },
    headerBlock: {
      flexShrink: 0,
      paddingTop: s.sm,
    },
    tabsWrap: {
      display: 'none',
      alignSelf: 'center',
      maxWidth: 240,
      width: '100%',
      flexShrink: 0,
    },
    tabsPill: {
      flexDirection: 'row',
      backgroundColor: c.surfaceElevated,
      borderRadius: 999,
      padding: 3,
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    tabBtn: {
      flex: 1,
      borderRadius: 999,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tabBtnOn: {
      backgroundColor: c.textDisplay,
    },
    tabBtnTxt: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    tabBtnTxtOn: {
      color: tabTxtOn,
    },
    planTab: {
      flex: 1,
      minHeight: 0,
      justifyContent: 'flex-start',
      paddingTop: s.sm,
      gap: s.sm,
    },
    planCargando: {
      flex: 1,
      minHeight: 120,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // ── Nothing design — Plan tab ──────────────────────────────────────
    ndPlanTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    ndPlanTopLeft: {
      flex: 1,
      minWidth: 0,
      paddingRight: s.sm,
    },
    ndPlanTopRight: {
      alignItems: 'flex-end',
    },
    ndLabel: {
      fontSize: 10,
      fontFamily: f.mono,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    ndObjTitulo: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      marginTop: 3,
    },
    ndDiasBig: {
      fontSize: 30,
      fontFamily: f.mono,
      color: c.textDisplay,
      marginTop: 3,
      textAlign: 'right',
    },
    ndKcalHero: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    ndKcalNum: {
      fontSize: 56,
      fontFamily: f.mono,
      color: c.textDisplay,
      lineHeight: 60,
    },
    ndKcalUnit: {
      fontSize: 13,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginBottom: 8,
    },
    ndMacrosBlock: {
      gap: 10,
    },
    ndMacroRow: {
      gap: 6,
    },
    ndMacroMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    ndMacroValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 3,
    },
    ndMacroG: {
      fontSize: 15,
      fontFamily: f.mono,
      color: c.textDisplay,
    },
    ndMacroUnit: {
      fontSize: 11,
      fontFamily: f.mono,
      color: c.textSecondary,
    },
    ndMacroPct: {
      fontSize: 11,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginLeft: 4,
    },
    ndSegBar: {
      flexDirection: 'row',
      gap: 2,
      height: 8,
    },
    ndSeg: {
      flex: 1,
      height: 8,
      borderRadius: 0,
    },
    ndProgresoBlock: {
      gap: 6,
    },
    ndProgresoHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    ndPctHero: {
      fontSize: 28,
      fontFamily: f.mono,
      color: c.textDisplay,
    },
    ndProgresoBarRow: {
      flexDirection: 'row',
      gap: 2,
      height: 10,
    },
    ndProgresoSeg: {
      flex: 1,
      height: 10,
      borderRadius: 0,
    },
    ndProgresoFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 2,
    },
    ndProgresoKg: {
      fontSize: 11,
      fontFamily: f.mono,
      color: c.textSecondary,
    },
    ndProgresoDesc: {
      fontSize: 10,
      fontFamily: f.mono,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    ndPlanCta: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.borderVisible,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ndPlanCtaTxt: {
      fontSize: 11,
      fontFamily: f.mono,
      color: c.textDisplay,
      textTransform: 'uppercase',
      letterSpacing: 1.4,
    },
    ndEmptyTxt: {
      fontSize: 11,
      fontFamily: f.mono,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1.4,
      textAlign: 'center',
      marginTop: s.lg,
    },
    blockNutricion: {
      flexShrink: 0,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: r.lg,
      padding: s.md,
    },
    flexSpacer: {
      flex: 1,
      minHeight: 0,
      minWidth: 0,
    },
    blockPeso: {
      flexShrink: 0,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: r.lg,
      padding: s.md,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: c.background,
      padding: s.md,
    },
    muted: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textSecondary,
      textAlign: 'center',
    },

    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.md,
    },
    headerAction: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarWrap: {
      width: 64,
      height: 64,
    },
    avatarImg: {
      width: 64,
      height: 64,
      borderRadius: 32,
    },
    avatarPlaceholder: {
      backgroundColor: c.surfaceElevated,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarIniciales: {
      ...ts.heading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    headerTextCol: {
      flex: 1,
      minWidth: 0,
    },
    username: {
      fontSize: 26,
      lineHeight: 31,
      letterSpacing: 0,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      marginBottom: 4,
    },
    metricasRow: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      alignItems: 'center',
      gap: 12,
    },
    metricaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 1,
    },
    metricaCaption: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: f.mono,
      color: c.textSecondary,
      textTransform: 'none',
    },
    metricaNum: {
      color: c.textDisplay,
      fontFamily: f.mono,
    },

    section: {
      gap: s.sm,
    },
    rowTitleFiltro: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: s.sm,
    },
    tituloDestacadoNut: {
      flex: 1,
      minWidth: 0,
      ...ts.subheading,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    filtroPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      flexShrink: 0,
    },
    filtroPillText: {
      fontSize: 10,
      lineHeight: 13,
      fontFamily: f.mono,
      color: c.textSecondary,
      flexShrink: 1,
    },
    chartLoading: {
      height: 150,
      justifyContent: 'center',
      alignItems: 'center',
    },
    kcalSummaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: s.md,
      marginBottom: s.xs,
    },
    rangeEyebrow: {
      ...ts.caption,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
      marginBottom: 2,
    },
    kcalValue: {
      fontSize: 30,
      lineHeight: 36,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      letterSpacing: 0,
      fontVariant: ['tabular-nums'],
    },
    kcalUnit: {
      fontSize: 15,
      lineHeight: 20,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    kcalSub: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    chartModePill: {
      width: 46,
      height: 30,
      borderRadius: r.pill,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      gap: 5,
      marginTop: s.xs,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: r.pill,
      borderWidth: 1,
      minHeight: 34,
    },
    chipActivo: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    chipOutline: {
      borderColor: c.borderVisible,
      backgroundColor: 'transparent',
    },
    chipText: {
      fontSize: 10,
      lineHeight: 13,
      letterSpacing: 0,
      fontFamily: f.sansMedium,
      flexShrink: 1,
    },
    chipTextActivo: {
      color: c.textOnPrimary,
    },
    chipTextOutline: {
      color: c.textSecondary,
    },

    dosColumnas: {
      flexDirection: 'row',
      gap: s.md,
      alignItems: 'flex-start',
    },
    colIzq: {
      width: '34%',
      minWidth: 0,
    },
    colDer: {
      flex: 1,
      minWidth: 0,
    },
    labelHoy: {
      ...ts.label,
      fontFamily: f.sans,
      color: c.textSecondary,
      marginBottom: s.xs,
      textTransform: 'none',
    },
    pesoInputRow: {
      minHeight: 30,
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 5,
      marginBottom: s.sm,
    },
    inputPeso: {
      borderWidth: 0,
      paddingVertical: 0,
      paddingHorizontal: 0,
      minWidth: 44,
      fontSize: 24,
      lineHeight: 30,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      fontVariant: ['tabular-nums'],
    },
    pesoUnidad: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    btnGuardar: {
      backgroundColor: 'transparent',
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      paddingVertical: 7,
      paddingHorizontal: 9,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: s.md,
    },
    btnGuardarOff: {
      opacity: 0.4,
    },
    btnGuardarText: {
      ...ts.caption,
      fontFamily: f.sansMedium,
      color: c.primary,
      letterSpacing: 0,
    },
    listaPeso: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      marginTop: s.sm,
    },
    filaPeso: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: s.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    filaPesoIzq: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textDisplay,
    },
    filaPesoDer: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
    },
    filaPesoRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },

    /** Fila título + filtro del gráfico de peso (una línea, sin partir palabras). */
    rowFiltroPesoGraf: {
      display: 'none',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: s.xs,
      marginBottom: s.xs,
      flexWrap: 'nowrap',
    },
    subtituloEvolucionPeso: {
      ...ts.caption,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
      flex: 1,
      minWidth: 0,
    },
    filtroPillPeso: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      flexShrink: 0,
      maxWidth: '58%',
    },
    filtroPillTextPeso: {
      fontSize: 10,
      fontFamily: f.mono,
      color: c.textSecondary,
      flexShrink: 1,
      minWidth: 0,
    },
    sinDatosGraf: {
      height: 118,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: r.md,
    },
    sinDatosTexto: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      textAlign: 'center',
    },

    cardStat: {
      display: 'none',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: s.md,
      paddingHorizontal: s.md,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      flexShrink: 0,
    },
    cardStatTitle: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },

    modalRoot: {
      flex: 1,
    },
    modalBackdropFill: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalCenter: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      padding: s.lg,
    },
    modalSheet: {
      backgroundColor: c.surfaceElevated,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    modalOpcion: {
      paddingVertical: s.md,
      paddingHorizontal: s.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    modalOpcionText: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.text,
    },
    filterMenuLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 40,
    },
    filterMenuDismiss: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
    },
    filterMenuPopover: {
      position: 'absolute',
      width: 182,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      backgroundColor: c.surfaceElevated,
      paddingVertical: s.xs,
      paddingHorizontal: s.sm,
      zIndex: 50,
    },
    filterMenuTitle: {
      fontSize: 12,
      lineHeight: 15,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      paddingHorizontal: s.xs,
      paddingVertical: s.xs,
    },
    filterMenuOption: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.xs,
      borderRadius: r.sm,
      paddingHorizontal: s.xs,
    },
    filterMenuOptionText: {
      fontSize: 12,
      lineHeight: 15,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    filterMenuOptionTextActive: {
      color: c.primary,
    },
  });
}

function limpiarDecimalUnico(value: string): string {
  let out = '';
  let hasSeparator = false;
  for (const ch of value) {
    if (ch >= '0' && ch <= '9') {
      out += ch;
      continue;
    }
    if ((ch === ',' || ch === '.') && !hasSeparator) {
      out += ch;
      hasSeparator = true;
    }
  }
  return out;
}

function iconoMetricaNut(key: MetricaNut, icon?: keyof typeof Ionicons.glyphMap): keyof typeof Ionicons.glyphMap {
  if (icon) return icon;
  if (key === 'proteinas') return 'barbell-outline';
  return 'ellipse-outline';
}
