import { Ionicons } from '@expo/vector-icons';
import { useFont } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bar, CartesianChart, Line } from 'victory-native';

import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  agregarDiasIso,
  fechaHoyIsoLocal,
  fechaIsoDesdeDate,
  parseFechaLocal,
} from '@/lib/fechaNutricion';
import { supabase } from '@/lib/supabase';
import {
  progresoService,
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

function inicioSemanaLunesIso(fechaIso: string): string {
  const base = parseFechaLocal(fechaIso);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + mondayOffset);
  return fechaIsoDesdeDate(monday);
}

function formatoEjeSemana(iso: string): string {
  const d = parseFechaLocal(iso);
  return `${MESES_CORTO[d.getMonth()]} ${d.getDate()}`;
}

function formatoFechaLista(iso: string): string {
  const d = parseFechaLocal(iso);
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()]}`;
}

function inicialesDeUsuario(username: string | undefined, email: string | undefined): string {
  const u = (username ?? '').trim();
  if (u.length >= 2) return u.slice(0, 2).toUpperCase();
  if (u.length === 1) return u.toUpperCase();
  const e = (email ?? '').trim();
  if (e.length >= 2) return e.slice(0, 2).toUpperCase();
  return 'AC';
}

type RangoFiltro = '3m' | '1y' | 'all';
type MetricaNut = 'kcal' | 'carbos' | 'proteinas' | 'grasas';

const FILTRO_LABELS: Record<RangoFiltro, string> = {
  '3m': 'Últimos 3 meses',
  '1y': 'Último año',
  all: 'Todo el tiempo',
};

function valorMetrica(row: NutricionSemana, m: MetricaNut): number {
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
type FilaNutChart = { x: number; y: number; semanaInicio: string };

function pasoEtiquetasEjeX(numBarras: number): number {
  if (numBarras <= 8) return 1;
  if (numBarras <= 16) return 2;
  return 3;
}

function GraficoBarrasNutricion({
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
    return formatoEjeSemana(datos[idx]!.semanaInicio);
  };

  return (
    <View style={stylesChart.wrap}>
      <CartesianChart<{ x: number; y: number; semanaInicio: string }, 'x', 'y'>
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
}

function GraficoLineaPeso({
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
}

const stylesChart = StyleSheet.create({
  wrap: { height: 150, width: '100%' },
  vacio: { justifyContent: 'center', alignItems: 'center' },
});

export default function ProgresoIndex() {
  const { c, f, ts, s, r, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [fechaRegistro, setFechaRegistro] = useState<string>(fechaHoyIsoLocal());
  const [perfilUsername, setPerfilUsername] = useState<string | null>(null);
  const [diasRegistrados, setDiasRegistrados] = useState(0);
  const [numEntrenos, setNumEntrenos] = useState(0);

  const [rangoNutricion, setRangoNutricion] = useState<RangoFiltro>('3m');
  const [rangoPeso, setRangoPeso] = useState<RangoFiltro>('3m');
  const [menuNutAbierto, setMenuNutAbierto] = useState(false);
  const [menuPesoAbierto, setMenuPesoAbierto] = useState(false);

  const [metricaNut, setMetricaNut] = useState<MetricaNut>('kcal');
  const [nutricionSemanal, setNutricionSemanal] = useState<NutricionSemana[]>([]);
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
    if (rangoNutricion === 'all') return fechaRegistro;
    if (rangoNutricion === '3m') return agregarDiasIso(hoyIso, -90);
    return agregarDiasIso(hoyIso, -365);
  }, [rangoNutricion, fechaRegistro, hoyIso]);
  const fechaIniPeso = useMemo(() => {
    if (rangoPeso === 'all') return fechaRegistro;
    if (rangoPeso === '3m') return agregarDiasIso(hoyIso, -90);
    return agregarDiasIso(hoyIso, -365);
  }, [rangoPeso, fechaRegistro, hoyIso]);

  const styles = useMemo(() => makeStyles(c, f, ts, s, r, isDark), [c, f, ts, s, r, isDark]);

  const displayName = perfilUsername ?? user?.email?.split('@')[0] ?? 'Usuario';
  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.picture as string | undefined);

  useEffect(() => {
    if (!user?.id) return;
    void progresoService.obtenerFechaRegistro(user.id).then(setFechaRegistro);
  }, [user?.id]);

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
        setPerfilUsername((perfilRow?.username as string | undefined) ?? null);
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
        const data = await progresoService.obtenerNutricionSemanal(user.id, fechaIniNut, hoyIso);
        if (!cancel) setNutricionSemanal(data);
      } finally {
        if (!cancel) setCargandoNut(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user?.id, fechaIniNut, hoyIso]);

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
        .limit(4),
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

  const semanaActualIso = inicioSemanaLunesIso(hoyIso);
  const filaSemanaActual = nutricionSemanal.find((n) => n.semanaInicio === semanaActualIso);
  const valorSemanaActual = filaSemanaActual
    ? valorMetrica(filaSemanaActual, metricaNut)
    : 0;
  const tituloMetricaSemana = textoTituloSemanaActual(metricaNut, valorSemanaActual);

  const datosBarNut: FilaNutChart[] = useMemo(
    () =>
      nutricionSemanal
        .filter((row) => valorMetrica(row, metricaNut) > 0)
        .map((row, i) => ({
          x: i,
          y: valorMetrica(row, metricaNut),
          semanaInicio: row.semanaInicio,
        })),
    [nutricionSemanal, metricaNut],
  );

  const datosLineaPeso = useMemo(
    () => historialPeso.map((r) => ({ x: r.fecha, y: r.peso_kg })),
    [historialPeso],
  );

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

  const chipDefs: { key: MetricaNut; label: string }[] = [
    { key: 'kcal', label: 'Kcal' },
    { key: 'carbos', label: 'Carbohidratos' },
    { key: 'proteinas', label: 'Proteína' },
    { key: 'grasas', label: 'Grasas' },
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
      <View style={styles.mainColumn}>
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
                  <Text style={styles.metricaCaption}>
                    <Text style={styles.metricaNum}>{diasRegistrados}</Text> Días registrados
                  </Text>
                </View>
                <View style={styles.metricaItem}>
                  <Text style={styles.metricaCaption}>
                    <Text style={styles.metricaNum}>{numEntrenos}</Text> Entrenos
                  </Text>
                </View>
              </View>
            </View>
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
        <View style={[styles.section, styles.blockNutricion]}>
          <View style={styles.rowTitleFiltro}>
            <Text style={styles.tituloDestacadoNut} numberOfLines={2}>
              {tituloMetricaSemana}
            </Text>
            <Pressable
              onPress={() => setMenuNutAbierto(true)}
              style={styles.filtroPill}
              accessibilityRole="button"
              accessibilityLabel="Rango de tiempo nutrición"
            >
              <Text style={styles.filtroPillText}>{FILTRO_LABELS[rangoNutricion]}</Text>
              <Ionicons name="chevron-down" size={16} color={c.textSecondary} />
            </Pressable>
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
            {chipDefs.map(({ key, label }) => {
              const activo = metricaNut === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setMetricaNut(key)}
                  style={[styles.chip, activo ? styles.chipActivo : styles.chipOutline]}
                >
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
          <View style={styles.dosColumnas}>
            <View style={styles.colIzq}>
              <Text style={styles.labelHoy}>HOY</Text>
              <TextInput
                style={styles.inputPeso}
                value={pesoTexto}
                onChangeText={setPesoTexto}
                placeholder="kg"
                placeholderTextColor={c.textMuted}
                keyboardType="decimal-pad"
                editable={!guardandoPeso}
              />
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
              <View style={styles.listaPeso}>
                {ultimosPesos.map((row, i) => (
                  <Pressable
                    key={`${row.fecha}-${i}`}
                    onPress={() => router.push('./historial-peso')}
                    style={styles.filaPeso}
                  >
                    <Text style={styles.filaPesoIzq}>{row.peso_kg} kg</Text>
                    <Text style={styles.filaPesoDer}>{formatoFechaLista(row.fecha)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.colDer}>
              <View style={styles.rowFiltroPesoGraf}>
                <Text style={styles.subtituloEvolucionPeso} numberOfLines={1} ellipsizeMode="tail">
                  Evolución
                </Text>
                <Pressable
                  onPress={() => setMenuPesoAbierto(true)}
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
                <Text style={styles.planLabelObj}>OBJETIVO ACTUAL</Text>
                <Text style={styles.planObjTitulo} numberOfLines={2}>
                  {textoObjetivoLegible(planActual.objetivo)}
                </Text>
                <Text style={styles.planDiasConPlan} numberOfLines={1}>
                  DÍAS CON ESTE PLAN: {textoDiasConEstePlan(planActual.created_at)}
                </Text>

                <View style={styles.planKcalBlock}>
                  <Text style={styles.planKcalNum}>
                    {Math.round(planActual.calorias_objetivo).toLocaleString('es-ES')}
                  </Text>
                  <Text style={styles.planKcalSuf}>kcal/día</Text>
                </View>

                <View style={styles.macroCardsRowPlan}>
                  <View style={styles.macroCardPlan}>
                    <Text style={styles.macroCardLabelPlan}>PROTEÍNAS</Text>
                    <Text style={styles.macroCardGramsPlan}>{planActual.proteinas_objetivo}g</Text>
                    <Text style={styles.macroCardMetaPlan}>{pctMacrosPlan.prot}%</Text>
                    <Text style={styles.macroCardMetaPlan}>{planActual.proteinas_objetivo * 4} kcal</Text>
                  </View>
                  <View style={styles.macroCardPlan}>
                    <Text style={styles.macroCardLabelPlan}>CARBOS</Text>
                    <Text style={styles.macroCardGramsPlan}>{planActual.carbos_objetivo}g</Text>
                    <Text style={styles.macroCardMetaPlan}>{pctMacrosPlan.carb}%</Text>
                    <Text style={styles.macroCardMetaPlan}>{planActual.carbos_objetivo * 4} kcal</Text>
                  </View>
                  <View style={styles.macroCardPlan}>
                    <Text style={styles.macroCardLabelPlan}>GRASAS</Text>
                    <Text style={styles.macroCardGramsPlan}>{planActual.grasas_objetivo}g</Text>
                    <Text style={styles.macroCardMetaPlan}>{pctMacrosPlan.gras}%</Text>
                    <Text style={styles.macroCardMetaPlan}>{planActual.grasas_objetivo * 9} kcal</Text>
                  </View>
                </View>

                {progresoPeso ? (
                  <View style={styles.planProgresoBlock}>
                    <View style={styles.planProgresoTopRow}>
                      <Text style={styles.planProgresoPesoLat}>{fmtPesoKgTabPlan(progresoPeso.pesoInicio)} kg</Text>
                      <Text style={styles.planProgresoPesoLat}>{fmtPesoKgTabPlan(progresoPeso.pesoObjetivo)} kg</Text>
                    </View>
                    <View style={styles.planProgresoBarRow}>
                      {Array.from({ length: 20 }, (_, i) => {
                        const filled = Math.min(
                          20,
                          Math.max(0, Math.round((progresoPeso.porcentaje / 100) * 20)),
                        );
                        const on = i < filled;
                        return (
                          <View
                            key={i}
                            style={[
                              styles.planProgresoSeg,
                              on
                                ? { backgroundColor: c.primary }
                                : {
                                    backgroundColor: 'transparent',
                                    borderWidth: 1,
                                    borderColor: c.border,
                                  },
                            ]}
                          />
                        );
                      })}
                    </View>
                    <View style={styles.planProgresoPctWrap}>
                      <Text style={styles.planProgresoPct}>{Math.round(progresoPeso.porcentaje)}%</Text>
                      <Text style={styles.planProgresoPctDesc}>
                        {progresoPeso.objetivo === 'perder_peso'
                          ? 'hacia tu objetivo de pérdida'
                          : 'hacia tu objetivo de ganancia'}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <Pressable
                  onPress={() => router.navigate('/(tabs)/(progreso)/personalizar-plan')}
                  accessibilityRole="link"
                  accessibilityLabel="Personalizar plan"
                >
                  <Text style={styles.planLinkPersonalizar}>Personalizar plan</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.muted}>Sin plan guardado.</Text>
                <Pressable
                  onPress={() => router.navigate('/(tabs)/(progreso)/personalizar-plan')}
                  accessibilityRole="link"
                  accessibilityLabel="Personalizar plan"
                >
                  <Text style={styles.planLinkPersonalizar}>Personalizar plan</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>

      <Modal transparent visible={menuNutAbierto} animationType="fade" onRequestClose={() => setMenuNutAbierto(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdropFill} onPress={() => setMenuNutAbierto(false)} />
          <View style={styles.modalCenter} pointerEvents="box-none">
            <View style={styles.modalSheet}>
              {(['3m', '1y', 'all'] as RangoFiltro[]).map((k) => (
                <Pressable
                  key={k}
                  style={styles.modalOpcion}
                  onPress={() => {
                    setRangoNutricion(k);
                    setMenuNutAbierto(false);
                  }}
                >
                  <Text style={styles.modalOpcionText}>{FILTRO_LABELS[k]}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={menuPesoAbierto} animationType="fade" onRequestClose={() => setMenuPesoAbierto(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdropFill} onPress={() => setMenuPesoAbierto(false)} />
          <View style={styles.modalCenter} pointerEvents="box-none">
            <View style={styles.modalSheet}>
              {(['3m', '1y', 'all'] as RangoFiltro[]).map((k) => (
                <Pressable
                  key={k}
                  style={styles.modalOpcion}
                  onPress={() => {
                    setRangoPeso(k);
                    setMenuPesoAbierto(false);
                  }}
                >
                  <Text style={styles.modalOpcionText}>{FILTRO_LABELS[k]}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
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
      flexDirection: 'column',
      paddingHorizontal: s.md,
      paddingBottom: s.md,
      gap: s.xs,
      justifyContent: 'flex-start',
    },
    headerBlock: {
      flexShrink: 0,
    },
    tabsWrap: {
      alignSelf: 'center',
      maxWidth: 240,
      width: '100%',
      flexShrink: 0,
      marginTop: s.sm,
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
    planLabelObj: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      textAlign: 'center',
      alignSelf: 'stretch',
    },
    planObjTitulo: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      textAlign: 'center',
      alignSelf: 'stretch',
      marginBottom: s.xs,
    },
    planDiasConPlan: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      textAlign: 'center',
      alignSelf: 'stretch',
      marginBottom: s.sm,
    },
    macroCardsRowPlan: {
      flexDirection: 'row',
      gap: s.xs,
      flexShrink: 0,
    },
    macroCardPlan: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.sm,
      paddingVertical: s.sm,
      paddingHorizontal: s.xs,
      backgroundColor: c.surface,
      alignItems: 'center',
    },
    macroCardLabelPlan: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.6,
      textAlign: 'center',
    },
    macroCardGramsPlan: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      marginTop: s.xs,
    },
    macroCardMetaPlan: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    planKcalBlock: {
      alignItems: 'center',
      alignSelf: 'stretch',
      flexShrink: 0,
      marginBottom: s.sm,
    },
    planKcalNum: {
      ...ts.displayMd,
      fontFamily: f.mono,
      color: c.primary,
    },
    planKcalSuf: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginTop: s.xs,
    },
    planLinkPersonalizar: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.primary,
      textDecorationLine: 'underline',
      textAlign: 'center',
    },
    planProgresoBlock: {
      width: '100%',
      flexShrink: 0,
      marginTop: s.xs,
    },
    planProgresoTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: s.sm,
    },
    planProgresoPesoLat: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
    },
    planProgresoBarRow: {
      flexDirection: 'row',
      gap: 2,
      height: 8,
      alignSelf: 'stretch',
      marginBottom: s.sm,
    },
    planProgresoSeg: {
      flex: 1,
      height: 8,
      borderRadius: 0,
    },
    planProgresoPctWrap: {
      alignItems: 'center',
      alignSelf: 'stretch',
    },
    planProgresoPct: {
      ...ts.body,
      fontFamily: f.mono,
      color: c.primary,
    },
    planProgresoPctDesc: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: 2,
    },
    blockNutricion: {
      flexShrink: 0,
      marginTop: s.sm,
    },
    flexSpacer: {
      flex: 1,
      minHeight: 0,
      minWidth: 0,
    },
    blockPeso: {
      flexShrink: 0,
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
      ...ts.displayMd,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      marginBottom: s.xs,
    },
    metricasRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: s.md,
    },
    metricaItem: { flexShrink: 1 },
    metricaCaption: {
      ...ts.caption,
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
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    filtroPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      maxWidth: '46%',
    },
    filtroPillText: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      flexShrink: 1,
    },
    chartLoading: {
      height: 150,
      justifyContent: 'center',
      alignItems: 'center',
    },

    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: s.xs,
      marginTop: s.xs,
    },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: r.pill,
      borderWidth: 1,
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
      ...ts.caption,
      fontFamily: f.mono,
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
      flex: 1,
      minWidth: 0,
    },
    colDer: {
      flex: 1,
      minWidth: 0,
    },
    labelHoy: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginBottom: s.xs,
    },
    inputPeso: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.sm,
      paddingVertical: 10,
      paddingHorizontal: 12,
      ...ts.body,
      fontFamily: f.mono,
      color: c.textDisplay,
      marginBottom: s.sm,
    },
    btnGuardar: {
      backgroundColor: c.primary,
      borderRadius: r.pill,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: s.md,
    },
    btnGuardarOff: {
      opacity: 0.4,
    },
    btnGuardarText: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textOnPrimary,
      letterSpacing: 1.2,
    },
    listaPeso: {
      borderTopWidth: 1,
      borderTopColor: c.border,
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

    /** Fila título + filtro del gráfico de peso (una línea, sin partir palabras). */
    rowFiltroPesoGraf: {
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
      height: 150,
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
  });
}