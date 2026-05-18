import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlowButton } from '@/components/ui/GlowButton';
import { Colors, FontFamily } from '@/constants/theme';
import { trackOnboardingEvent } from '@/lib/onboardingAnalytics';
import { leerGenero, leerNumero, leerObjetivoUi, leerParam } from '@/lib/onboardingParams';

type NivelActividad = 'sedentario' | 'ligero' | 'moderado' | 'activo' | 'muy_activo';

const TOTAL_PASOS = 6;
const AUTH = Colors.dark;
const BG = AUTH.background;
const CYAN = AUTH.primary;
const WHITE = AUTH.textDisplay;
const SURFACE = AUTH.surface;
const BORDER_SOFT = AUTH.border;
const LABEL = AUTH.textMuted;

const ACTIVITY_OPTIONS: { key: NivelActividad; title: string; description: string }[] = [
  { key: 'sedentario', title: 'Sedentario', description: 'Poco o ningún ejercicio' },
  { key: 'ligero', title: 'Ligero', description: 'Ejercicio 1-3 días/semana' },
  { key: 'moderado', title: 'Moderado', description: 'Ejercicio 3-5 días/semana' },
  { key: 'activo', title: 'Activo', description: 'Ejercicio intenso 6-7 días/semana' },
  { key: 'muy_activo', title: 'Muy activo', description: 'Actividad física muy exigente' },
];

const ACTIVITY_FACTORS: Record<NivelActividad, string> = {
  sedentario: '1.2',
  ligero: '1.375',
  moderado: '1.55',
  activo: '1.725',
  muy_activo: '1.9',
};

function nivelInicialDesdeFactor(factor: number | null): NivelActividad {
  if (factor == null) return 'moderado';
  const entries = Object.entries(ACTIVITY_FACTORS) as [NivelActividad, string][];
  let mejor: NivelActividad = 'moderado';
  let dif = Infinity;
  for (const [key, value] of entries) {
    const d = Math.abs(Number(value) - factor);
    if (d < dif) {
      dif = d;
      mejor = key;
    }
  }
  return mejor;
}

export default function OnboardingActividadPantalla() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    objetivo?: string | string[];
    genero?: string | string[];
    edad?: string | string[];
    pesoKg?: string | string[];
    alturaCm?: string | string[];
    factorActividad?: string | string[];
  }>();
  const objetivo = leerObjetivoUi(params.objetivo);
  const genero = leerGenero(params.genero);
  const edad = leerParam(params.edad);
  const pesoKg = leerParam(params.pesoKg);
  const alturaCm = leerParam(params.alturaCm);

  const [nivelActividad, setNivelActividad] = useState<NivelActividad>(
    nivelInicialDesdeFactor(leerNumero(params.factorActividad)),
  );

  const continuar = () => {
    if (!objetivo || !genero || !edad || !pesoKg || !alturaCm) return;
    trackOnboardingEvent('profile_basics_completed', { objetivo });
    router.push({
      pathname: '/(onboarding)/plan',
      params: {
        objetivo,
        genero,
        edad,
        pesoKg,
        alturaCm,
        factorActividad: ACTIVITY_FACTORS[nivelActividad],
      },
    });
  };

  return (
    <View style={[st.root, { paddingTop: insets.top + 10 }]}>
      <View style={st.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={22} color={WHITE} />
        </Pressable>
        <View style={st.progressTrack}>
          <View style={[st.progressFill, { width: `${(3 / TOTAL_PASOS) * 100}%` }]} />
        </View>
        <Text style={st.headerStep}>PASO 3 DE {TOTAL_PASOS}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scroll}>
        <Text style={st.kicker}>VÉRTICE</Text>
        <Text style={st.title}>Tu actividad</Text>
        <Text style={st.subtitle}>Esto ajusta mejor tus calorías de partida. Si dudas, elige la opción que más se parezca a tu semana normal.</Text>

        <View style={st.activityList}>
          {ACTIVITY_OPTIONS.map((item) => {
            const selected = nivelActividad === item.key;
            return (
              <Pressable
                key={item.key}
                style={[st.activityRow, selected && st.activityRowSelected]}
                onPress={() => setNivelActividad(item.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${item.title}. ${item.description}`}
              >
                <View style={st.activityText}>
                  <Text style={st.activityTitle}>{item.title}</Text>
                  <Text style={st.activityDescription}>{item.description}</Text>
                </View>
                <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? CYAN : LABEL} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[st.footer, { paddingBottom: insets.bottom + 12 }]}>
        <GlowButton borderRadius={12} glowPadding={28}>
          <Pressable style={st.cta} onPress={continuar} accessibilityRole="button">
            <Text style={st.ctaText}>VER MI PLAN</Text>
            <Ionicons name="arrow-forward" size={20} color={BG} />
          </Pressable>
        </GlowButton>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: BORDER_SOFT, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: CYAN },
  headerStep: { color: LABEL, fontFamily: FontFamily.mono, fontSize: 10, letterSpacing: 1.5 },
  scroll: { paddingBottom: 16 },
  kicker: { color: CYAN, fontFamily: FontFamily.mono, fontSize: 10, letterSpacing: 2.4 },
  title: { marginTop: 8, color: WHITE, fontFamily: FontFamily.sansBold, fontSize: 22, lineHeight: 27 },
  subtitle: { marginTop: 8, marginBottom: 18, color: AUTH.textSecondary, fontFamily: FontFamily.sans, fontSize: 13, lineHeight: 18 },
  activityList: { gap: 8 },
  activityRow: { minHeight: 64, borderRadius: 12, borderWidth: 1, borderColor: BORDER_SOFT, backgroundColor: SURFACE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  activityRowSelected: { borderColor: CYAN },
  activityText: { flex: 1, paddingRight: 10 },
  activityTitle: { color: WHITE, fontFamily: FontFamily.sansBold, fontSize: 13, lineHeight: 17 },
  activityDescription: { marginTop: 3, color: AUTH.textSecondary, fontFamily: FontFamily.sans, fontSize: 11, lineHeight: 15 },
  footer: { paddingTop: 8 },
  cta: { height: 48, borderRadius: 12, backgroundColor: CYAN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ctaText: { color: BG, fontFamily: FontFamily.sansBold, fontSize: 12, letterSpacing: 2.3 },
});
