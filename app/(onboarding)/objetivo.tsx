import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LogoSVG from '@/assets/images/logos/logo_sb.svg';
import { GlowButton } from '@/components/ui/GlowButton';
import { Colors, FontFamily } from '@/constants/theme';
import { trackOnboardingEvent } from '@/lib/onboardingAnalytics';
import type { ObjetivoUi } from '@/lib/onboardingParams';

export type { ObjetivoUi };

type IconName = ComponentProps<typeof Ionicons>['name'];

const TOTAL_PASOS = 6;
const AUTH = Colors.dark;
const BG = AUTH.background;
const CYAN = AUTH.primary;
const WHITE = AUTH.textDisplay;
const SURFACE = AUTH.surface;
const BORDER_SOFT = AUTH.border;
const LABEL = AUTH.textMuted;

const OBJETIVOS: { id: ObjetivoUi; icon: IconName; titulo: string; descripcion: string }[] = [
  { id: 'perder', icon: 'trending-down-outline', titulo: 'Perder grasa', descripcion: 'Quiero bajar peso sin dejar de progresar en el gimnasio.' },
  { id: 'mantener', icon: 'swap-horizontal-outline', titulo: 'Mantener', descripcion: 'Quiero ordenar mis hábitos y ver mis avances con claridad.' },
  { id: 'ganar', icon: 'trending-up-outline', titulo: 'Ganar masa', descripcion: 'Quiero comer y entrenar con datos para subir de forma controlada.' },
];

export default function OnboardingObjetivoPantalla() {
  const insets = useSafeAreaInsets();
  const [objetivo, setObjetivo] = useState<ObjetivoUi>('mantener');

  useEffect(() => {
    trackOnboardingEvent('onboarding_started');
  }, []);

  const continuar = () => {
    trackOnboardingEvent('goal_selected', { objetivo });
    router.push({ pathname: '/(onboarding)/datos', params: { objetivo } });
  };

  return (
    <View style={[st.root, { paddingTop: insets.top + 10 }]}>
      <View style={st.header}>
        <Text style={st.headerKicker}>VÉRTICE</Text>
        <Text style={st.headerStep}>PASO 1 DE {TOTAL_PASOS}</Text>
      </View>
      <View style={st.progressTrack}>
        <View style={[st.progressFill, { width: `${(1 / TOTAL_PASOS) * 100}%` }]} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scroll}>
        <View style={st.hero}>
          <View style={st.titleBlock}>
            <Text style={st.title}>TODO TU PROGRESO</Text>
            <Text style={[st.title, st.titleAccent]}>EN UN MISMO SITIO</Text>
          </View>
          <LogoSVG width={58} height={66} />
        </View>
        <Text style={st.subtitle}>
          Elige tu objetivo y prepararemos un punto de partida para registrar comidas, apuntar pesos y ver avances.
        </Text>
        <View style={st.options}>
          {OBJETIVOS.map((item) => {
            const selected = objetivo === item.id;
            return (
              <Pressable
                key={item.id}
                style={[st.option, selected && st.optionSelected]}
                onPress={() => setObjetivo(item.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${item.titulo}. ${item.descripcion}`}
              >
                <View style={[st.iconBox, selected && st.iconBoxSelected]}>
                  <Ionicons name={item.icon} size={22} color={selected ? BG : CYAN} />
                </View>
                <View style={st.optionCopy}>
                  <Text style={st.optionTitle}>{item.titulo}</Text>
                  <Text style={st.optionDescription}>{item.descripcion}</Text>
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
            <Text style={st.ctaText}>CONTINUAR</Text>
            <Ionicons name="arrow-forward" size={20} color={BG} />
          </Pressable>
        </GlowButton>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerKicker: { color: CYAN, fontFamily: FontFamily.mono, fontSize: 10, letterSpacing: 2.4 },
  headerStep: { color: LABEL, fontFamily: FontFamily.mono, fontSize: 10, letterSpacing: 1.5 },
  progressTrack: { height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: BORDER_SOFT, marginBottom: 20 },
  progressFill: { height: '100%', backgroundColor: CYAN },
  scroll: { paddingBottom: 16 },
  hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  titleBlock: { flex: 1 },
  title: { color: WHITE, fontFamily: FontFamily.sansBold, fontSize: 22, lineHeight: 27 },
  titleAccent: { color: CYAN },
  subtitle: { marginTop: 14, color: AUTH.textSecondary, fontFamily: FontFamily.sans, fontSize: 13, lineHeight: 18 },
  options: { marginTop: 22, gap: 10 },
  option: { minHeight: 92, borderRadius: 12, borderWidth: 1, borderColor: BORDER_SOFT, backgroundColor: SURFACE, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  optionSelected: { borderColor: CYAN, shadowColor: CYAN, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  iconBox: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101010', borderWidth: 1, borderColor: BORDER_SOFT },
  iconBoxSelected: { backgroundColor: CYAN, borderColor: CYAN },
  optionCopy: { flex: 1 },
  optionTitle: { color: WHITE, fontFamily: FontFamily.sansBold, fontSize: 15, lineHeight: 19 },
  optionDescription: { marginTop: 4, color: AUTH.textSecondary, fontFamily: FontFamily.sans, fontSize: 12, lineHeight: 16 },
  footer: { paddingTop: 8 },
  cta: { height: 48, borderRadius: 12, backgroundColor: CYAN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ctaText: { color: BG, fontFamily: FontFamily.sansBold, fontSize: 12, letterSpacing: 2.3 },
});
