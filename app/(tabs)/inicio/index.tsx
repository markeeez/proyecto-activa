/**
 * Home Screen — template visual, header con datos reales.
 * Adaptado al design system Active Sky × Nothing.
 */

import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import {
  DeviceEventEmitter,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import FoodNavIcon from '@/assets/images/nav-icons/food_nav_icon_v2.svg';
import WorkoutNavIcon from '@/assets/images/nav-icons/workout_nav_dumbbell.svg';
import { FontFamily } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useActivationState } from '@/hooks/useActivationState';
import { useNutricion } from '@/hooks/useNutricion';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { ModalRegistrarComida } from '@/components/ModalRegistrarComida';
import { ModalRegistrarEntreno } from '@/components/ModalRegistrarEntreno';
import { ActivationChecklist } from '@/components/onboarding/ActivationChecklist';
import { BuscadorAlimentos } from '@/components/nutricion/BuscadorAlimentos';
import { DailyGoalShareModal } from '@/components/nutricion/DailyGoalShareModal';
import { solicitarEntrenamientoTab } from '@/lib/entrenamientoTabEvents';
import { emitNutricionLogActualizado } from '@/lib/nutricionEvents';
import { calcularEstadoDia } from '@/lib/nutricionEstadoDia';
import { alimentosService } from '@/services/alimentos.service';
import { nutricionService } from '@/services/nutricion.service';
import { NOTIFICACIONES_CAMBIADAS, notificacionesService } from '@/services/notificaciones.service';
import type { Food } from '@/types/database.types';

const GAUGE_SIZE = 110;
const GAUGE_STROKE = 8;
const GAUGE_RADIUS = (GAUGE_SIZE - GAUGE_STROKE) / 2;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;
const GAUGE_ARC_RATIO = 0.78;
const GAUGE_ARC = GAUGE_CIRCUMFERENCE * GAUGE_ARC_RATIO;
const GAUGE_START_ANGLE = 90 + ((1 - GAUGE_ARC_RATIO) * 360) / 2;

/* ─────────────────────────────────────────────────────────────────────
   Sub-componentes
──────────────────────────────────────────────────────────────────────*/

/** Gráfico de línea mini (sparkline). */
function Sparkline({
  data,
  width,
  height,
  color,
}: {
  data: number[];
  width: number;
  height: number;
  color: string;
}) {
  const min  = Math.min(...data);
  const max  = Math.max(...data);
  const span = max - min || 1;
  const denom = data.length > 1 ? data.length - 1 : 1;
  const pts  = data
    .map((v, i) => {
      const x = (i / denom) * width;
      const y = height - ((v - min) / span) * (height - 2) - 1;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <Svg width={width} height={height}>
      <Polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Gráfico de barras mini. */
function MiniBarChart({
  data,
  width,
  height,
  color,
}: {
  data: number[];
  width: number;
  height: number;
  color: string;
}) {
  const max   = Math.max(...data) || 1;
  const slot  = width / data.length;
  const barW  = slot * 0.55;
  return (
    <Svg width={width} height={height}>
      {data.map((v, i) => {
        const barH = Math.max(2, (v / max) * (height - 2));
        return (
          <Rect
            key={i}
            x={i * slot + (slot - barW) / 2}
            y={height - barH}
            width={barW}
            height={barH}
            rx={2}
            fill={color}
          />
        );
      })}
    </Svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Pantalla principal
──────────────────────────────────────────────────────────────────────*/

function calcularDuracionSegundos(horaInicio: string | null, horaFin: string | null): number {
  if (!horaInicio || !horaFin) return 0;
  const inicioMs = new Date(horaInicio).getTime();
  const finMs = new Date(horaFin).getTime();
  if (Number.isNaN(inicioMs) || Number.isNaN(finMs) || finMs <= inicioMs) return 0;
  return Math.max(1, Math.round((finMs - inicioMs) / 1000));
}

function formatearDuracionSegundos(totalSegundos: number): string {
  if (totalSegundos <= 0) return '< 1 min';
  if (totalSegundos < 60) return `${totalSegundos} s`;

  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;
  if (minutos < 60) return segundos === 0 ? `${minutos} min` : `${minutos} min ${segundos} s`;

  const horas = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;
  return minutosRestantes === 0 ? `${horas} h` : `${horas} h ${minutosRestantes} min`;
}

function textoCompartirObjetivoDiario({
  kcalConsumed,
  kcalTotal,
  macros,
}: {
  kcalConsumed: number;
  kcalTotal: number;
  macros: { label: string; current: number; total: number }[];
}): string {
  const macroLines = macros
    .map((m) => `${m.label}: ${Math.round(m.current)} / ${Math.round(m.total)} g`)
    .join('\n');
  return `Objetivo diario\n${Math.round(kcalConsumed)} / ${Math.round(kcalTotal)} kcal\n${macroLines}`;
}

export default function HomeScreen() {
  const { c, s, isDark } = useTheme();
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();
  const { estado: estadoActivacion, inicializado: activacionInicializada } = useActivationState();
  const [notificacionesPendientes, setNotificacionesPendientes] = useState(0);

  const cargarResumenNotificaciones = useCallback(async () => {
    if (!user?.id) {
      setNotificacionesPendientes(0);
      return;
    }
    const resumen = await notificacionesService.obtenerResumenNoLeidas(user.id).catch(() => ({ unreadCount: 0 }));
    setNotificacionesPendientes(resumen.unreadCount);
  }, [user?.id]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(NOTIFICACIONES_CAMBIADAS, () => {
      void cargarResumenNotificaciones();
    });
    return () => sub.remove();
  }, [cargarResumenNotificaciones]);

  /* ── Datos del header ── */
  const [nombre, setNombre] = useState<string | null>(null);
  const avatarUrl = (user?.user_metadata as { avatar_url?: string } | undefined)?.avatar_url ?? null;

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      supabase
        .from('profiles')
        .select('nombre, username')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          setNombre(data?.nombre ?? data?.username ?? null);
        });
    }, [user?.id]),
  );

  const displayName = nombre ?? user?.email?.split('@')[0] ?? 'tú';

  /* Fecha de hoy en español: "Domingo, 26 de abril" */
  const fechaHoy = (() => {
    const str = new Date().toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return str.charAt(0).toUpperCase() + str.slice(1);
  })();

  /* ── Último entrenamiento ── */
  const [ultimoEntreno, setUltimoEntreno] = useState<{
    id: string;
    nombre: string;
    musculos: string;
    duracionSegundos: number;
    numEjercicios: number;
  } | null | undefined>(undefined); // undefined = cargando, null = sin datos

  const cargarUltimoEntreno = useCallback(() => {
    if (!user?.id) return;
    supabase
      .from('workout_sessions')
      .select(`
        id, nombre, hora_inicio, hora_fin,
        workout_session_exercises (
          exercises ( musculo_primario )
        )
      `)
      .eq('user_id', user.id)
      .not('hora_fin', 'is', null)
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setUltimoEntreno(null); return; }

        const wse = (data.workout_session_exercises ?? []) as any[];

        const musculos = [
          ...new Set(
            wse
              .map(e => Array.isArray(e.exercises) ? e.exercises[0]?.musculo_primario : e.exercises?.musculo_primario)
              .filter(Boolean)
          ),
        ].slice(0, 3).join(', ');

        const duracionSegundos = calcularDuracionSegundos(data.hora_inicio, data.hora_fin);

        setUltimoEntreno({
          id: data.id,
          nombre: data.nombre ?? 'Entrenamiento',
          musculos,
          duracionSegundos,
          numEjercicios: wse.length,
        });
      });
  }, [user?.id]);

  /* ── Progreso — datos reales ── */
  const [progresoData, setProgresoData] = useState<{
    pesos: { kg: number }[];
    kcalPorDia: number[];
    protPorDia: number[];
  } | null>(null);

  const cargarProgreso = useCallback(async () => {
    if (!user?.id) return;

    // 1. Peso corporal — últimos 7 registros (más antiguo → más reciente para el gráfico)
    const { data: pesosRaw } = await supabase
      .from('user_body_metrics')
      .select('fecha, peso_kg')
      .eq('user_id', user.id)
      .not('peso_kg', 'is', null)
      .order('fecha', { ascending: false })
      .limit(7);
    const pesos = ((pesosRaw ?? []) as { peso_kg: number }[])
      .map(r => ({ kg: Number(r.peso_kg) }))
      .reverse();

    // 2. Calorías y proteínas — últimos 7 días naturales
    const hoy = new Date();
    const fechas7: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() - i);
      fechas7.push(d.toISOString().split('T')[0]!);
    }

    const { data: nutrRaw } = await supabase
      .from('nutrition_logs')
      .select(`
        fecha,
        nutrition_log_meals (
          nutrition_log_items (
            calorias_calculadas,
            proteinas_calculadas
          )
        )
      `)
      .eq('user_id', user.id)
      .gte('fecha', fechas7[0]!)
      .lte('fecha', fechas7[6]!);

    const nutrMap = new Map<string, { kcal: number; prot: number }>();
    for (const log of (nutrRaw ?? []) as any[]) {
      let kcal = 0, prot = 0;
      for (const meal of (log.nutrition_log_meals ?? [])) {
        for (const item of (meal.nutrition_log_items ?? [])) {
          kcal += Number(item.calorias_calculadas ?? 0);
          prot += Number(item.proteinas_calculadas ?? 0);
        }
      }
      nutrMap.set(log.fecha as string, { kcal, prot });
    }

    setProgresoData({
      pesos,
      kcalPorDia: fechas7.map(f => nutrMap.get(f)?.kcal ?? 0),
      protPorDia:  fechas7.map(f => nutrMap.get(f)?.prot  ?? 0),
    });
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    cargarUltimoEntreno();
    void cargarProgreso();
    void cargarResumenNotificaciones();
  }, [cargarUltimoEntreno, cargarProgreso, cargarResumenNotificaciones]));

  const MENSAJES_MOTIVACION = [
    '¡Hoy es un buen día para empezar! 💪',
    'El primer paso es el más importante. ¡Vamos!',
    'Sin excusas, sin límites. ¡A entrenar!',
  ];
  const mensajeMotivacion = MENSAJES_MOTIVACION[Math.floor(Math.random() * MENSAJES_MOTIVACION.length)];

  /* ── Nutrición — datos reales de hoy ── */
  const {
    resumen,
    objetivos,
    cargando: cargandoNutricion,
    eliminarAlimento,
    reemplazarAlimento,
    fecha: fechaNutricion,
  } = useNutricion();

  const [modalComidaVisible, setModalComidaVisible] = useState(false);
  const [modalEntrenoVisible, setModalEntrenoVisible] = useState(false);
  const [modalCompartirObjetivoVisible, setModalCompartirObjetivoVisible] = useState(false);
  const [mealIdBuscador, setMealIdBuscador] = useState<string | null>(null);

  const registrarAlimentoDesdeInicio = useCallback(
    async (food: Food, gramos: number) => {
      if (!mealIdBuscador || !user?.id) return;
      const foodReal = await alimentosService.asegurarFoodParaLog(food);
      await nutricionService.añadirAlimentoAComida({
        mealId: mealIdBuscador,
        foodId: foodReal.id,
        gramos,
        food: {
          calorias: Number(foodReal.calorias ?? 0),
          proteinas: Number(foodReal.proteinas ?? 0),
          carbohidratos: Number(foodReal.carbohidratos ?? 0),
          grasas: Number(foodReal.grasas ?? 0),
        },
      });
      emitNutricionLogActualizado({ fechaLog: fechaNutricion });
    },
    [mealIdBuscador, user?.id, fechaNutricion],
  );

  const kcalConsumed  = resumen?.totalCalorias  ?? 0;
  const kcalTotal     = objetivos?.calorias_objetivo ?? 2000;
  const kcalRestantes = Math.max(0, kcalTotal - kcalConsumed);
  const kcalProgress  = kcalTotal > 0 ? Math.min(kcalConsumed / kcalTotal, 1) : 0;
  const gaugeProgress = Math.max(0.03, kcalProgress);
  const estadoKcal = calcularEstadoDia(kcalConsumed, kcalTotal);
  const colorGauge =
    estadoKcal === 'dentro' ? c.success
    : estadoKcal === 'cerca' ? c.warning
    : estadoKcal === 'sobre' ? c.danger
    : c.primary;

  const macros = [
    { key: 'proteinas', label: 'Proteínas',     current: resumen?.totalProteinas ?? 0, total: objetivos?.proteinas_objetivo ?? 0, color: c.primary  },
    { key: 'carbos',    label: 'Carbohidratos', current: resumen?.totalCarbos    ?? 0, total: objetivos?.carbos_objetivo    ?? 0, color: c.success  },
    { key: 'grasas',    label: 'Grasas',        current: resumen?.totalGrasas    ?? 0, total: objetivos?.grasas_objetivo    ?? 0, color: c.macroFat },
  ];

  // ── Progreso: valores calculados ──────────────────────────────────
  const pesoVals   = progresoData?.pesos.map(p => p.kg) ?? [];
  const pesoActual = pesoVals.length > 0 ? pesoVals[pesoVals.length - 1]! : null;
  const pesoDelta  = pesoVals.length >= 2
    ? +(pesoActual! - pesoVals[0]!).toFixed(1)
    : null;

  const kcalVals   = progresoData?.kcalPorDia ?? [0, 0, 0, 0, 0, 0, 0];
  const kcalConDatos = kcalVals.filter(v => v > 0);
  const kcalProm   = kcalConDatos.length > 0
    ? Math.round(kcalConDatos.reduce((a, b) => a + b, 0) / kcalConDatos.length)
    : null;

  const protVals   = progresoData?.protPorDia ?? [0, 0, 0, 0, 0, 0, 0];
  const protConDatos = protVals.filter(v => v > 0);
  const protProm   = protConDatos.length > 0
    ? Math.round(protConDatos.reduce((a, b) => a + b, 0) / protConDatos.length)
    : null;
  const protObjetivo = objetivos?.proteinas_objetivo ?? null;

  const ph = s.md; // padding horizontal

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top + 6 }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
      >

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={[row, { paddingHorizontal: ph, marginBottom: s.md }]}>
        {/* Avatar — pulsar navega a perfil */}
        <TouchableOpacity onPress={() => router.push('/(tabs)/(perfil)')} activeOpacity={0.8}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={st.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[st.avatar, { backgroundColor: c.primaryBg }]}>
              <Ionicons name="person" size={22} color={c.primary} />
            </View>
          )}
        </TouchableOpacity>

        {/* Nombre + fecha */}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={[row, { gap: 4 }]}>
            <Text style={[st.greeting, { color: c.textDisplay }]}>
              ¡Hola, {displayName}! 👋
            </Text>
          </View>
          <Text style={[st.date, { color: c.textSecondary }]}>{fechaHoy}</Text>
        </View>

        {/* Icono notificaciones */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/inicio/notificaciones')}
          activeOpacity={0.7}
          style={[st.headerIconButton, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <Ionicons name="notifications-outline" size={24} color={c.textDisplay} />
          {notificacionesPendientes > 0 ? (
            <View style={[st.notificationDot, { backgroundColor: c.danger, borderColor: c.surface }]} />
          ) : null}
        </TouchableOpacity>
      </View>

      {/* ── Resumen diario ──────────────────────────────────────────── */}
      <View
        style={[
          st.nutritionSummaryCard,
          { backgroundColor: c.surface, borderColor: c.borderVisible, marginHorizontal: ph, marginBottom: s.md },
        ]}
      >
        <View style={st.nutritionSummaryContent}>
          <View style={st.kcalPanel}>
            <View style={st.gaugeWrap}>
              <Svg width={GAUGE_SIZE} height={GAUGE_SIZE} viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}>
                <Circle
                  cx={GAUGE_SIZE / 2}
                  cy={GAUGE_SIZE / 2}
                  r={GAUGE_RADIUS}
                  stroke={c.border}
                  strokeWidth={GAUGE_STROKE}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${GAUGE_ARC} ${GAUGE_CIRCUMFERENCE}`}
                  transform={`rotate(${GAUGE_START_ANGLE} ${GAUGE_SIZE / 2} ${GAUGE_SIZE / 2})`}
                />
                <Circle
                  cx={GAUGE_SIZE / 2}
                  cy={GAUGE_SIZE / 2}
                  r={GAUGE_RADIUS}
                  stroke={colorGauge}
                  strokeWidth={GAUGE_STROKE}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${GAUGE_ARC * gaugeProgress} ${GAUGE_CIRCUMFERENCE}`}
                  transform={`rotate(${GAUGE_START_ANGLE} ${GAUGE_SIZE / 2} ${GAUGE_SIZE / 2})`}
                />
              </Svg>

              <View style={st.gaugeCenter}>
                <Text style={[st.gaugeValue, { color: c.textDisplay }]}>{Math.round(kcalConsumed)}</Text>
                <Text style={[st.gaugeUnit, { color: c.text }]}>kcal</Text>
              </View>
            </View>

            <View style={[st.remainingBadge, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
              <Text style={[st.remainingText, { color: c.primary }]}>{Math.round(kcalRestantes)} kcal restantes</Text>
            </View>
          </View>

          <View style={st.macrosPanel}>
            <View style={[st.goalBlock, { borderBottomColor: c.borderVisible }]}>
              <View style={st.goalHeaderRow}>
                <Text style={[st.summaryEyebrow, { backgroundColor: c.primaryBg, color: c.primary }]}>
                  OBJETIVO DIARIO
                </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[st.goalShareButton, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
                  onPress={() => setModalCompartirObjetivoVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Compartir objetivo diario"
                >
                  <Ionicons name="share-outline" size={17} color={c.textDisplay} />
                </TouchableOpacity>
              </View>
              <Text style={[st.summaryValue, { color: c.textDisplay }]}>
                {Math.round(kcalTotal)} <Text style={[st.summaryUnit, { color: c.text }]}>kcal</Text>
              </Text>
            </View>

            {macros.map((m) => {
              const porcentaje = m.total > 0 ? Math.min(1, m.current / m.total) : 0;
              return (
                <View key={m.key} style={st.nutritionMacroRow}>
                  <View style={[st.macroIcon, { backgroundColor: m.color }]}>
                    {m.key === 'proteinas' ? (
                      <MaterialCommunityIcons name="food-drumstick-outline" size={16} color={c.textOnPrimary} />
                    ) : m.key === 'carbos' ? (
                      <MaterialCommunityIcons name="barley" size={16} color={c.textOnPrimary} />
                    ) : (
                      <Ionicons name="water-outline" size={16} color={c.textOnPrimary} />
                    )}
                  </View>
                  <View style={st.nutritionMacroBody}>
                    <View style={st.nutritionMacroHeader}>
                      <Text style={[st.nutritionMacroLabel, { color: c.text }]}>{m.label}</Text>
                      <Text style={[st.nutritionMacroValue, { color: c.textDisplay }]}>
                        {Math.round(m.current)} / {Math.round(m.total)} g
                      </Text>
                    </View>
                    <View style={[st.nutritionMacroTrack, { backgroundColor: c.border }]}>
                      <View
                        style={[
                          st.nutritionMacroFill,
                          { width: `${porcentaje * 100}%` as `${number}%`, backgroundColor: m.color },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* ── Acciones rápidas ────────────────────────────────────────── */}
      {activacionInicializada && !estadoActivacion.completada ? (
        <View style={{ paddingHorizontal: ph, marginBottom: s.md }}>
          <ActivationChecklist
            estado={estadoActivacion}
            onRegistrarComida={() => setModalComidaVisible(true)}
            onVerRutinas={() => {
              solicitarEntrenamientoTab('rutinas');
              router.push({ pathname: '/(tabs)/(entrenamiento)', params: { tab: 'rutinas' } } as any);
            }}
          />
        </View>
      ) : null}

      <View style={[row, { paddingHorizontal: ph, gap: s.sm, marginBottom: s.md }]}>
        {[
          {
            label: 'Registrar\ncomida',
            Icon: FoodNavIcon,
            ruta: '/(tabs)/(nutricion)' as const,
            onPlus: () => setModalComidaVisible(true),
          },
          {
            label: 'Registrar\nentreno',
            Icon: WorkoutNavIcon,
            ruta: '/(tabs)/(entrenamiento)' as const,
            onPlus: () => setModalEntrenoVisible(true),
            onPress: () => {
              solicitarEntrenamientoTab('rutinas');
              router.push({ pathname: '/(tabs)/(entrenamiento)', params: { tab: 'rutinas' } } as any);
            },
          },
        ].map(({ Icon, ...a }) => (
          <TouchableOpacity
            key={a.label}
            style={[st.quickCard, { flex: 1, backgroundColor: c.surface, borderColor: c.border }]}
            activeOpacity={0.75}
            onPress={a.onPress ?? (() => router.push(a.ruta))}
          >
            <View style={[row, { alignItems: 'center', gap: 10 }]}>
              <Icon width={22} height={22} color={c.textDisplay} />
              <Text style={[st.quickLabel, { color: c.text, flex: 1 }]}>{a.label}</Text>
              <TouchableOpacity
                style={[st.fabSmall, { backgroundColor: c.primary }]}
                activeOpacity={0.8}
                onPress={a.onPlus ?? (() => router.push(a.ruta))}
              >
                <Ionicons name="add" size={18} color={c.textOnPrimary} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Último entrenamiento ───────────────────────────────────── */}
      <View style={[st.card, { backgroundColor: c.surface, borderColor: c.border, marginHorizontal: ph, marginBottom: s.md }]}>
        <View style={[row, { justifyContent: 'space-between', marginBottom: 12 }]}>
          <Text style={[st.cardTitle, { color: c.textDisplay }]}>Último entrenamiento</Text>
          <TouchableOpacity
            onPress={() => {
              solicitarEntrenamientoTab('entrenos');
              router.push({
                pathname: '/(tabs)/(entrenamiento)',
                params: { tab: 'entrenos' },
              } as any);
            }}
          >
            <Text style={[st.seeAll, { color: c.primary }]}>Ver todo</Text>
          </TouchableOpacity>
        </View>

        {/* Sin entrenos — mensaje motivacional */}
        {ultimoEntreno === null && (
          <View style={[row, { gap: 12, alignItems: 'center' }]}>
            <View style={[st.workoutIcon, { backgroundColor: c.primaryBg }]}>
              <WorkoutNavIcon width={28} height={28} color={c.primary} />
            </View>
            <Text style={[st.workoutMuscles, { color: c.textSecondary, flex: 1 }]}>
              {mensajeMotivacion}
            </Text>
          </View>
        )}

        {/* Con datos reales */}
        {ultimoEntreno != null && ultimoEntreno !== undefined && (
          <TouchableOpacity
            style={[row, { alignItems: 'center', gap: 14 }]}
            activeOpacity={0.7}
            onPress={() => router.push({
              pathname: '/(tabs)/inicio/sesion/[id]',
              params: { id: ultimoEntreno.id },
            } as any)}
            accessibilityRole="button"
            accessibilityLabel={`Abrir entrenamiento ${ultimoEntreno.nombre}`}
          >
            {/* Icono */}
            <View style={[st.workoutIcon, { backgroundColor: c.primaryBg }]}>
              <WorkoutNavIcon width={28} height={28} color={c.primary} />
            </View>

            {/* Info */}
            <View style={{ flex: 1 }}>
              <Text style={[st.workoutName, { color: c.textDisplay }]} numberOfLines={1}>
                {ultimoEntreno.nombre}
              </Text>
              {ultimoEntreno.musculos ? (
                <Text style={[st.workoutMuscles, { color: c.textSecondary }]} numberOfLines={1}>
                  {ultimoEntreno.musculos}
                </Text>
              ) : null}
              <View style={[row, { gap: 4, marginTop: 4 }]}>
                <Ionicons name="time-outline" size={12} color={c.textMuted} />
                <Text style={[st.workoutMeta, { color: c.textMuted }]}>
                  {formatearDuracionSegundos(ultimoEntreno.duracionSegundos)}
                </Text>
              </View>
            </View>

            {/* Nº de ejercicios */}
            <View style={[st.ejCircle, { borderColor: c.primary }]}>
              <Text style={[st.ejNum,   { color: c.primary }]}>{ultimoEntreno.numEjercicios}</Text>
              <Text style={[st.ejLabel, { color: c.primary }]}>ej.</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Progreso ────────────────────────────────────────────────── */}
      <View style={[st.card, { backgroundColor: c.surface, borderColor: c.border, marginHorizontal: ph }]}>
        <View style={[row, { justifyContent: 'space-between', marginBottom: 12 }]}>
          <Text style={[st.cardTitle, { color: c.textDisplay }]}>Progreso</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/(progreso)')}>
            <Text style={[st.seeAll, { color: c.primary }]}>Ver más</Text>
          </TouchableOpacity>
        </View>

        <View style={[row, { gap: 8 }]}>
          {/* Peso corporal */}
          <View style={[st.statCard, { flex: 1, backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
            <Text style={[st.statLabel, { color: c.textSecondary }]}>Peso corporal</Text>
            <Text style={[st.statVal, { color: c.textDisplay }]} numberOfLines={1}>
              {pesoActual != null ? `${pesoActual.toFixed(1).replace('.', ',')} kg` : '—'}
            </Text>
            <View style={{ marginVertical: 6 }}>
              <Sparkline
                data={pesoVals.length > 0 ? pesoVals : [0]}
                width={72} height={28} color={c.primary}
              />
            </View>
            <Text style={[st.statDelta, {
              color: pesoDelta == null ? c.textSecondary
                   : pesoDelta <= 0   ? c.success
                   : c.warning,
            }]} numberOfLines={1}>
              {pesoDelta == null ? `${pesoVals.length} reg.`
               : pesoDelta === 0 ? 'Sin cambio'
               : `${pesoDelta > 0 ? '+' : ''}${pesoDelta.toString().replace('.', ',')} kg`}
            </Text>
          </View>

          {/* Calorías 7 días */}
          <View style={[st.statCard, { flex: 1, backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
            <Text style={[st.statLabel, { color: c.textSecondary }]}>Kcal (prom.)</Text>
            <Text style={[st.statVal, { color: c.textDisplay }]} numberOfLines={1}>
              {kcalProm != null ? `${kcalProm.toLocaleString('es-ES')}` : '—'}
            </Text>
            <View style={{ marginVertical: 6 }}>
              <MiniBarChart data={kcalVals} width={72} height={28} color={c.primary} />
            </View>
            <Text style={[st.statDelta, {
              color: kcalProm == null ? c.textSecondary
                   : kcalProm <= kcalTotal ? c.success : c.warning,
            }]} numberOfLines={1}>
              {kcalProm != null
                ? (kcalProm <= kcalTotal ? `≤ obj. ${kcalTotal}` : `> obj. ${kcalTotal}`)
                : 'Sin registros'}
            </Text>
          </View>

          {/* Proteínas 7 días */}
          <View style={[st.statCard, { flex: 1, backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
            <Text style={[st.statLabel, { color: c.textSecondary }]}>Prot. (prom.)</Text>
            <Text style={[st.statVal, { color: c.textDisplay }]} numberOfLines={1}>
              {protProm != null ? `${protProm} g` : '—'}
            </Text>
            <View style={{ marginVertical: 6 }}>
              <Sparkline data={protVals} width={72} height={28} color={c.primary} />
            </View>
            <Text style={[st.statDelta, {
              color: protProm == null || protObjetivo == null ? c.textSecondary
                   : protProm >= protObjetivo ? c.success : c.warning,
            }]} numberOfLines={1}>
              {protObjetivo != null
                ? `obj. ${protObjetivo} g`
                : 'Sin registros'}
            </Text>
          </View>
        </View>
      </View>
      </ScrollView>

      {/* ── Modal registrar comida ─────────────────────────────────── */}
      <ModalRegistrarComida
        visible={modalComidaVisible}
        onClose={() => setModalComidaVisible(false)}
        comidas={resumen?.comidas ?? []}
        fecha={fechaNutricion}
        cargando={cargandoNutricion}
        userId={user?.id}
        eliminarAlimento={eliminarAlimento}
        reemplazarAlimento={async (itemId, food, gramos) => {
          const item = resumen?.comidas.flatMap((c) => c.items).find((i) => i.id === itemId);
          if (!item) return;
          await reemplazarAlimento(item, food, gramos);
          emitNutricionLogActualizado({ fechaLog: fechaNutricion });
        }}
        onAgregarAlimento={(mealId) => setMealIdBuscador(mealId)}
      />

      <BuscadorAlimentos
        visible={mealIdBuscador !== null}
        onClose={() => setMealIdBuscador(null)}
        onAlimentoSeleccionado={registrarAlimentoDesdeInicio}
        userId={user?.id}
      />

      {/* ── Modal registrar entreno ────────────────────────────────── */}
      <ModalRegistrarEntreno
        visible={modalEntrenoVisible}
        onClose={() => setModalEntrenoVisible(false)}
      />

      {/* ── Modal compartir objetivo diario ────────────────────────── */}
      <DailyGoalShareModal
        visible={modalCompartirObjetivoVisible}
        onClose={() => setModalCompartirObjetivoVisible(false)}
        kcalConsumed={kcalConsumed}
        kcalTotal={kcalTotal}
        macros={macros.map((m) => ({
          key: m.key,
          label: m.label,
          current: m.current,
          total: m.total,
        }))}
        user={user}
        initialDark={isDark}
        fallbackMessage={textoCompartirObjetivoDiario({ kcalConsumed, kcalTotal, macros })}
      />

    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Estilos
──────────────────────────────────────────────────────────────────────*/

const row = { flexDirection: 'row', alignItems: 'center' } as const;

const st = StyleSheet.create({
  /* Header */
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  greeting: {
    fontFamily: FontFamily.sansBold,
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: 0,
  },
  date: {
    fontFamily: FontFamily.sans,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0,
    marginTop: 1,
  },


  /* Card base */
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  cardTitle: {
    fontFamily: FontFamily.sansBold,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: 0,
  },
  seeAll: {
    fontFamily: FontFamily.monoBold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  /* Nutrition summary */
  nutritionSummaryCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  nutritionSummaryContent: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  kcalPanel: {
    width: 122,
    alignItems: 'center',
    gap: 8,
  },
  gaugeWrap: {
    width: GAUGE_SIZE,
    height: GAUGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeValue: {
    fontFamily: FontFamily.sansBold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: 0,
  },
  gaugeUnit: {
    fontFamily: FontFamily.monoBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.8,
  },
  remainingBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'stretch',
  },
  remainingText: {
    fontFamily: FontFamily.monoBold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.9,
    textAlign: 'center',
  },
  macrosPanel: {
    flex: 1,
    gap: 6,
    justifyContent: 'center',
  },
  goalBlock: {
    borderBottomWidth: 1,
    paddingBottom: 6,
    marginBottom: 4,
    gap: 3,
  },
  goalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  goalShareButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryEyebrow: {
    fontFamily: FontFamily.monoBold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  summaryValue: {
    fontFamily: FontFamily.sansBold,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: 0,
  },
  summaryUnit: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  },
  nutritionMacroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  macroIcon: {
    width: 24,
    height: 24,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nutritionMacroBody: {
    flex: 1,
    gap: 5,
  },
  nutritionMacroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nutritionMacroLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0,
    flexShrink: 1,
  },
  nutritionMacroValue: {
    fontFamily: FontFamily.monoBold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.4,
  },
  nutritionMacroTrack: {
    height: 5,
    borderRadius: 4,
    overflow: 'hidden',
  },
  nutritionMacroFill: {
    height: '100%',
    borderRadius: 4,
  },

  /* Quick actions */
  quickCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  quickLabel: {
    fontFamily: FontFamily.sansBold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0,
  },
  fabSmall: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Workout */
  workoutIcon: {
    width: 52, height: 52, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  workoutName: {
    fontFamily: FontFamily.sansBold,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: 0,
  },
  workoutMuscles: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
    marginTop: 2,
  },
  workoutMeta: {
    fontFamily: FontFamily.sans,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0,
  },
  ejCircle: {
    width: 54, height: 54, borderRadius: 27,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  ejNum: {
    fontFamily: FontFamily.monoBold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 0,
  },
  ejLabel: {
    fontFamily: FontFamily.monoBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.6,
  },

  /* Progress */
  statCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  statLabel: {
    fontFamily: FontFamily.monoBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  statVal: {
    fontFamily: FontFamily.sansBold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0,
  },
  statDelta: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0,
  },
});
