/**
 * Home Screen — template visual, header con datos reales.
 * Adaptado al design system Active Sky × Nothing.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { useNutricion } from '@/hooks/useNutricion';
import { useTheme } from '@/hooks/useTheme';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';

const { width: SW } = Dimensions.get('window');

/* ─────────────────────────────────────────────────────────────────────
   Sub-componentes
──────────────────────────────────────────────────────────────────────*/

/** Anillo de progreso circular (donut). */
function DonutRing({
  size,
  strokeWidth,
  progress,
  color,
  bgColor,
}: {
  size: number;
  strokeWidth: number;
  progress: number;
  color: string;
  bgColor: string;
}) {
  const r    = (size - strokeWidth) / 2;
  const cx   = size / 2;
  const circ = 2 * Math.PI * r;
  return (
    <View style={{ transform: [{ rotate: '-90deg' }] }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cx} r={r} stroke={bgColor} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={cx}
          cy={cx}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${progress * circ} ${circ}`}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

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
  const pts  = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
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
  const max   = Math.max(...data);
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

export default function HomeScreen() {
  const { c, s } = useTheme();
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();

  /* ── Datos del header ── */
  const [nombre, setNombre] = useState<string | null>(null);
  const avatarUrl = (user?.user_metadata as { avatar_url?: string } | undefined)?.avatar_url ?? null;

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('profiles')
      .select('nombre, username')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setNombre(data?.nombre ?? data?.username ?? null);
      });
  }, [user?.id]);

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
    duracionMin: number;
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

        const duracionMin = (() => {
          if (!data.hora_inicio || !data.hora_fin) return 0;
          return Math.round((new Date(data.hora_fin).getTime() - new Date(data.hora_inicio).getTime()) / 60000);
        })();

        setUltimoEntreno({
          id: data.id,
          nombre: data.nombre ?? 'Entrenamiento',
          musculos,
          duracionMin,
          numEjercicios: wse.length,
        });
      });
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    cargarUltimoEntreno();
  }, [cargarUltimoEntreno]));

  const MENSAJES_MOTIVACION = [
    '¡Hoy es un buen día para empezar! 💪',
    'El primer paso es el más importante. ¡Vamos!',
    'Sin excusas, sin límites. ¡A entrenar!',
  ];
  const mensajeMotivacion = MENSAJES_MOTIVACION[Math.floor(Math.random() * MENSAJES_MOTIVACION.length)];

  /* ── Nutrición — datos reales de hoy ── */
  const { resumen, objetivos, cargando: cargandoNutricion } = useNutricion();

  const kcalConsumed  = resumen?.totalCalorias  ?? 0;
  const kcalTotal     = objetivos?.calorias_objetivo ?? 2000;
  const kcalRestantes = Math.max(0, kcalTotal - kcalConsumed);
  const kcalProgress  = kcalTotal > 0 ? Math.min(kcalConsumed / kcalTotal, 1) : 0;

  const macros = [
    { label: 'Proteínas',     current: resumen?.totalProteinas ?? 0, total: objetivos?.proteinas_objetivo ?? 160, color: c.primary  },
    { label: 'Carbohidratos', current: resumen?.totalCarbos    ?? 0, total: objetivos?.carbos_objetivo    ?? 275, color: c.success  },
    { label: 'Grasas',        current: resumen?.totalGrasas    ?? 0, total: objetivos?.grasas_objetivo    ?? 80,  color: c.macroFat },
  ];

  const weightData = [72.8, 73.1, 72.9, 72.5, 72.7, 72.4, 72.4];
  const calData    = [1750, 1920, 2100, 1850, 1780, 2050, 1892];
  const stepsData  = [7200, 8100, 6800, 9200, 7800, 8432, 8432];

  const ph = s.md; // padding horizontal

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top + 8, paddingBottom: 20 }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={[row, { paddingHorizontal: ph, marginBottom: s.lg }]}>
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

        {/* Icono estadísticas */}
        <TouchableOpacity onPress={() => router.push('/(tabs)/(progreso)/estadisticas-ejercicio')} activeOpacity={0.7}>
          <Ionicons name="bar-chart-outline" size={24} color={c.textDisplay} />
        </TouchableOpacity>
      </View>

      {/* ── Resumen diario ──────────────────────────────────────────── */}
      <View style={[st.card, { backgroundColor: c.surface, borderColor: c.border, marginHorizontal: ph, marginBottom: s.sm }]}>
        <View style={[row, { justifyContent: 'space-between' }]}>
          <Text style={[st.cardTitle, { color: c.textDisplay }]}>Resumen diario</Text>
          {cargandoNutricion && <ActivityIndicator size="small" color={c.primary} />}
        </View>

        <View style={[row, { marginTop: 12 }]}>
          {/* Donut + labels centrados */}
          <View style={st.donutWrap}>
            <DonutRing
              size={118}
              strokeWidth={11}
              progress={kcalProgress}
              color={c.primary}
              bgColor={c.border}
            />
            <View style={st.donutOverlay} pointerEvents="none">
              <Text style={[st.donutNum, { color: c.textDisplay }]}>
                {kcalConsumed.toLocaleString('es-ES')}
              </Text>
              <Text style={[st.donutUnit, { color: c.textSecondary }]}>kcal</Text>
              <Text style={[st.donutOf,   { color: c.textSecondary }]}>
                de {kcalTotal.toLocaleString('es-ES')}
              </Text>
            </View>
          </View>

          {/* Barras de macros */}
          <View style={{ flex: 1, marginLeft: 16, gap: 10 }}>
            {macros.map(m => (
              <View key={m.label}>
                <View style={[row, { justifyContent: 'space-between', marginBottom: 4 }]}>
                  <View style={[row, { gap: 5 }]}>
                    <Ionicons name="ellipse" size={8} color={m.color} />
                    <Text style={[st.macroLabel, { color: c.textSecondary }]}>{m.label}</Text>
                  </View>
                  <Text style={[st.macroVal, { color: c.text }]}>
                    {m.current} / {m.total} g
                  </Text>
                </View>
                <View style={[st.macroTrack, { backgroundColor: c.border }]}>
                  <View
                    style={[
                      st.macroFill,
                      { width: `${(m.current / m.total) * 100}%` as any, backgroundColor: m.color },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Restantes */}
        <Text style={[st.restantes, { color: c.primary }]}>
          <Text style={{ fontWeight: '700' }}>{kcalRestantes}</Text>
          {' '}kcal restantes
        </Text>
      </View>

      {/* ── Acciones rápidas ────────────────────────────────────────── */}
      <View style={[row, { paddingHorizontal: ph, gap: s.sm, marginBottom: s.sm }]}>
        {[
          { label: 'Registrar\ncomida',  icon: 'restaurant-outline' as const, ruta: '/(tabs)/(nutricion)' as const },
          { label: 'Registrar\nentreno', icon: 'barbell-outline'    as const, ruta: '/(tabs)/(entrenamiento)' as const },
        ].map(a => (
          <TouchableOpacity
            key={a.label}
            style={[st.quickCard, { flex: 1, backgroundColor: c.surface, borderColor: c.border }]}
            activeOpacity={0.75}
            onPress={() => router.push(a.ruta)}
          >
            <View style={[row, { alignItems: 'center', gap: 10 }]}>
              <Ionicons name={a.icon} size={22} color={c.textDisplay} />
              <Text style={[st.quickLabel, { color: c.text, flex: 1 }]}>{a.label}</Text>
              {/* El + no propaga el tap a la card gracias al TouchableOpacity anidado */}
              <TouchableOpacity
                style={[st.fabSmall, { backgroundColor: c.primary }]}
                activeOpacity={0.8}
                onPress={() => {/* TODO */}}
              >
                <Ionicons name="add" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Último entrenamiento ───────────────────────────────────── */}
      <View style={[st.card, { backgroundColor: c.surface, borderColor: c.border, marginHorizontal: ph, marginBottom: s.sm }]}>
        <View style={[row, { justifyContent: 'space-between', marginBottom: 12 }]}>
          <Text style={[st.cardTitle, { color: c.textDisplay }]}>Último entrenamiento</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/(entrenamiento)')}>
            <Text style={[st.seeAll, { color: c.primary }]}>Ver todo</Text>
          </TouchableOpacity>
        </View>

        {/* Sin entrenos — mensaje motivacional */}
        {ultimoEntreno === null && (
          <View style={[row, { gap: 12, alignItems: 'center' }]}>
            <View style={[st.workoutIcon, { backgroundColor: c.primaryBg }]}>
              <Ionicons name="barbell-outline" size={26} color={c.primary} />
            </View>
            <Text style={[st.workoutMuscles, { color: c.textSecondary, flex: 1 }]}>
              {mensajeMotivacion}
            </Text>
          </View>
        )}

        {/* Con datos reales */}
        {ultimoEntreno != null && ultimoEntreno !== undefined && (
          <View style={[row, { alignItems: 'center', gap: 14 }]}>
            {/* Icono */}
            <View style={[st.workoutIcon, { backgroundColor: c.primaryBg }]}>
              <Ionicons name="barbell-outline" size={26} color={c.primary} />
            </View>

            {/* Info */}
            <View style={{ flex: 1 }}>
              <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/(entrenamiento)/sesion/[id]', params: { id: ultimoEntreno.id, from: 'home' } } as any)} activeOpacity={0.7}>
                <Text style={[st.workoutName, { color: c.textDisplay }]} numberOfLines={1}>
                  {ultimoEntreno.nombre}
                </Text>
              </TouchableOpacity>
              {ultimoEntreno.musculos ? (
                <Text style={[st.workoutMuscles, { color: c.textSecondary }]} numberOfLines={1}>
                  {ultimoEntreno.musculos}
                </Text>
              ) : null}
              <View style={[row, { gap: 4, marginTop: 4 }]}>
                <Ionicons name="time-outline" size={12} color={c.textMuted} />
                <Text style={[st.workoutMeta, { color: c.textMuted }]}>
                  {ultimoEntreno.duracionMin > 0 ? `${ultimoEntreno.duracionMin} min` : '< 1 min'}
                </Text>
              </View>
            </View>

            {/* Nº de ejercicios */}
            <View style={[st.ejCircle, { borderColor: c.primary }]}>
              <Text style={[st.ejNum,   { color: c.primary }]}>{ultimoEntreno.numEjercicios}</Text>
              <Text style={[st.ejLabel, { color: c.primary }]}>ej.</Text>
            </View>
          </View>
        )}
      </View>

      {/* ── Progreso ────────────────────────────────────────────────── */}
      <View style={[st.card, { backgroundColor: c.surface, borderColor: c.border, marginHorizontal: ph }]}>
        <View style={[row, { justifyContent: 'space-between', marginBottom: 12 }]}>
          <Text style={[st.cardTitle, { color: c.textDisplay }]}>Progreso</Text>
          <TouchableOpacity>
            <Text style={[st.seeAll, { color: c.primary }]}>Ver más</Text>
          </TouchableOpacity>
        </View>

        <View style={[row, { gap: 8 }]}>
          {/* Peso corporal */}
          <View style={[st.statCard, { flex: 1, backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
            <Text style={[st.statLabel, { color: c.textSecondary }]}>Peso corporal</Text>
            <Text style={[st.statVal,   { color: c.textDisplay   }]}>72,4 kg</Text>
            <View style={{ marginVertical: 6 }}>
              <Sparkline data={weightData} width={72} height={28} color={c.primary} />
            </View>
            <Text style={[st.statDelta, { color: c.success }]}>-0,6 kg esta semana</Text>
          </View>

          {/* Calorías */}
          <View style={[st.statCard, { flex: 1, backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
            <Text style={[st.statLabel, { color: c.textSecondary }]}>Calorías (prom.)</Text>
            <Text style={[st.statVal,   { color: c.textDisplay   }]}>1.892 kcal</Text>
            <View style={{ marginVertical: 6 }}>
              <MiniBarChart data={calData} width={72} height={28} color={c.primary} />
            </View>
            <Text style={[st.statDelta, { color: c.warning }]}>+120 kcal vs. ayer</Text>
          </View>

          {/* Pasos */}
          <View style={[st.statCard, { flex: 1, backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
            <Text style={[st.statLabel, { color: c.textSecondary }]}>Pasos</Text>
            <Text style={[st.statVal,   { color: c.textDisplay   }]}>8.432</Text>
            <View style={{ marginVertical: 6 }}>
              <Sparkline data={stepsData} width={72} height={28} color={c.primary} />
            </View>
            <Text style={[st.statDelta, { color: c.textSecondary }]}>Objetivo: 10.000</Text>
          </View>
        </View>
      </View>

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
  greeting: { fontSize: 17, fontWeight: '600' },
  date:     { fontSize: 13, marginTop: 1 },


  /* Card base */
  card: {
    borderRadius: 16, borderWidth: 1, padding: 16,
  },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  seeAll:    { fontSize: 14 },

  /* Donut */
  donutWrap: { width: 118, height: 118 },
  donutOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  donutNum:  { fontSize: 22, fontWeight: '700', lineHeight: 26 },
  donutUnit: { fontSize: 12, lineHeight: 17 },
  donutOf:   { fontSize: 11, lineHeight: 15 },

  /* Macros */
  macroLabel: { fontSize: 12 },
  macroVal:   { fontSize: 11 },
  macroTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  macroFill:  { height: 5, borderRadius: 3 },
  restantes:  { fontSize: 14, textAlign: 'center', marginTop: 14 },

  /* Quick actions */
  quickCard: {
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  quickLabel: { fontSize: 14, fontWeight: '500', lineHeight: 18 },
  fabSmall: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Workout */
  workoutIcon: {
    width: 52, height: 52, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  workoutName:    { fontSize: 16, fontWeight: '600' },
  workoutMuscles: { fontSize: 13, marginTop: 2 },
  workoutMeta:    { fontSize: 12 },
  ejCircle: {
    width: 54, height: 54, borderRadius: 27,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  ejNum:   { fontSize: 18, fontWeight: '700', lineHeight: 22 },
  ejLabel: { fontSize: 10, fontWeight: '500' },

  /* Progress */
  statCard: {
    borderRadius: 12, borderWidth: 1, padding: 10,
  },
  statLabel: { fontSize: 10, marginBottom: 2 },
  statVal:   { fontSize: 13, fontWeight: '700' },
  statDelta: { fontSize: 9 },
});
