/**
 * Home Screen — template visual, header con datos reales.
 * Adaptado al design system Active Sky × Nothing.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
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
import { supabase } from '@/lib/supabase';
import { ModalRegistrarComida } from '@/components/ModalRegistrarComida';
import { ModalRegistrarEntreno } from '@/components/ModalRegistrarEntreno';

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
  }, [cargarUltimoEntreno, cargarProgreso]));

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
    fecha: fechaNutricion,
  } = useNutricion();

  const [modalComidaVisible, setModalComidaVisible] = useState(false);
  const [modalEntrenoVisible, setModalEntrenoVisible] = useState(false);

  const kcalConsumed  = resumen?.totalCalorias  ?? 0;
  const kcalTotal     = objetivos?.calorias_objetivo ?? 2000;
  const kcalRestantes = Math.max(0, kcalTotal - kcalConsumed);
  const kcalProgress  = kcalTotal > 0 ? Math.min(kcalConsumed / kcalTotal, 1) : 0;

  const macros = [
    { label: 'Proteínas',     current: resumen?.totalProteinas ?? 0, total: objetivos?.proteinas_objetivo ?? 160, color: c.primary  },
    { label: 'Carbohidratos', current: resumen?.totalCarbos    ?? 0, total: objetivos?.carbos_objetivo    ?? 275, color: c.success  },
    { label: 'Grasas',        current: resumen?.totalGrasas    ?? 0, total: objetivos?.grasas_objetivo    ?? 80,  color: c.macroFat },
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
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top + 6, paddingBottom: 8 }}>

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

        {/* Icono estadísticas */}
        <TouchableOpacity onPress={() => router.push('/(tabs)/(progreso)/estadisticas-ejercicio')} activeOpacity={0.7}>
          <Ionicons name="bar-chart-outline" size={24} color={c.textDisplay} />
        </TouchableOpacity>
      </View>

      {/* ── Resumen diario ──────────────────────────────────────────── */}
      <View style={[st.card, { backgroundColor: c.surface, borderColor: c.border, marginHorizontal: ph, marginBottom: s.md }]}>
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
      <View style={[row, { paddingHorizontal: ph, gap: s.sm, marginBottom: s.md }]}>
        {[
          {
            label: 'Registrar\ncomida',
            icon: 'restaurant-outline' as const,
            ruta: '/(tabs)/(nutricion)' as const,
            onPlus: () => setModalComidaVisible(true),
          },
          {
            label: 'Registrar\nentreno',
            icon: 'barbell-outline' as const,
            ruta: '/(tabs)/(entrenamiento)' as const,
            onPlus: () => setModalEntrenoVisible(true),
          },
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
              <TouchableOpacity
                style={[st.fabSmall, { backgroundColor: c.primary }]}
                activeOpacity={0.8}
                onPress={a.onPlus ?? (() => router.push(a.ruta))}
              >
                <Ionicons name="add" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Último entrenamiento ───────────────────────────────────── */}
      <View style={[st.card, { backgroundColor: c.surface, borderColor: c.border, marginHorizontal: ph, marginBottom: s.md }]}>
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
              <TouchableOpacity
                onPress={() => router.push({
                  pathname: '/(tabs)/inicio/sesion/[id]',
                  params: { id: ultimoEntreno.id },
                } as any)}
                activeOpacity={0.7}
              >
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

      {/* ── Modal registrar comida ─────────────────────────────────── */}
      <ModalRegistrarComida
        visible={modalComidaVisible}
        onClose={() => setModalComidaVisible(false)}
        comidas={resumen?.comidas ?? []}
        fecha={fechaNutricion}
        cargando={cargandoNutricion}
        eliminarAlimento={eliminarAlimento}
      />

      {/* ── Modal registrar entreno ────────────────────────────────── */}
      <ModalRegistrarEntreno
        visible={modalEntrenoVisible}
        onClose={() => setModalEntrenoVisible(false)}
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
