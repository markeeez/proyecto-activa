import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlowButton } from '@/components/ui/GlowButton';
import { Colors, FontFamily } from '@/constants/theme';
import { trackOnboardingEvent } from '@/lib/onboardingAnalytics';
import {
  leerGenero,
  leerNumero,
  leerObjetivoUi,
  type GeneroOnboarding,
  type ObjetivoUi,
} from '@/lib/onboardingParams';

const TOTAL_PASOS = 6;
const AUTH = Colors.dark;
const BG = AUTH.background;
const CYAN = AUTH.primary;
const WHITE = AUTH.textDisplay;
const SURFACE = AUTH.surface;
const BORDER_SOFT = AUTH.border;
const LABEL = AUTH.textMuted;

type MacroPerfil = 'alta_proteina' | 'equilibrado' | 'alta_carbos';

function calcularKcal(genero: GeneroOnboarding, peso: number, altura: number, edad: number, factor: number, objetivo: ObjetivoUi) {
  const tmb = genero === 'hombre'
    ? 10 * peso + 6.25 * altura - 5 * edad + 5
    : 10 * peso + 6.25 * altura - 5 * edad - 161;
  const tdee = tmb * factor;
  if (objetivo === 'perder') return tdee - 550;
  if (objetivo === 'ganar') return tdee + 250;
  return tdee;
}

function calcularMacros(peso: number, kcal: number, perfil: MacroPerfil) {
  let proteinas: number;
  let grasas: number;
  if (perfil === 'alta_proteina') {
    proteinas = Math.round(peso * 2.2);
    grasas = Math.round(peso * 0.8);
  } else if (perfil === 'alta_carbos') {
    proteinas = Math.round(peso * 1.8);
    grasas = Math.round(peso * 0.8);
  } else {
    proteinas = Math.round(peso * 2);
    grasas = Math.round(peso);
  }
  const carbos = Math.max(0, Math.round((kcal - proteinas * 4 - grasas * 9) / 4));
  return { proteinas, carbos, grasas };
}

export default function OnboardingPlanPantalla() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    objetivo?: string | string[];
    genero?: string | string[];
    edad?: string | string[];
    pesoKg?: string | string[];
    alturaCm?: string | string[];
    factorActividad?: string | string[];
  }>();
  const [continuando, setContinuando] = useState(false);
  const [macroPerfil, setMacroPerfil] = useState<MacroPerfil>('equilibrado');
  const [customOpen, setCustomOpen] = useState(false);
  const [customProteinas, setCustomProteinas] = useState('');
  const [customCarbos, setCustomCarbos] = useState('');
  const [customGrasas, setCustomGrasas] = useState('');
  const [personalizado, setPersonalizado] = useState<{ kcal: number; proteinas: number; carbos: number; grasas: number } | null>(null);

  const parsed = useMemo(() => {
    const objetivo = leerObjetivoUi(params.objetivo);
    const genero = leerGenero(params.genero);
    const edad = leerNumero(params.edad);
    const peso = leerNumero(params.pesoKg);
    const altura = leerNumero(params.alturaCm);
    const factor = leerNumero(params.factorActividad);
    const ok = Boolean(
      objetivo &&
      genero &&
      edad != null &&
      peso != null &&
      altura != null &&
      factor != null,
    );
    return { ok, objetivo, genero, edad, peso, altura, factor };
  }, [params]);

  const kcalRecomendada = Math.max(0, Math.round(
    parsed.ok && parsed.objetivo && parsed.genero
      ? calcularKcal(parsed.genero, parsed.peso ?? 0, parsed.altura ?? 0, parsed.edad ?? 0, parsed.factor ?? 1.2, parsed.objetivo)
      : 0,
  ));
  const macrosRecomendadas = calcularMacros(parsed.peso ?? 0, kcalRecomendada, macroPerfil);
  const kcal = personalizado?.kcal ?? kcalRecomendada;
  const macros = personalizado
    ? { proteinas: personalizado.proteinas, carbos: personalizado.carbos, grasas: personalizado.grasas }
    : macrosRecomendadas;

  const abrirPersonalizar = () => {
    setCustomProteinas(String(macros.proteinas));
    setCustomCarbos(String(macros.carbos));
    setCustomGrasas(String(macros.grasas));
    setCustomOpen(true);
  };

  const aplicarPersonalizacion = () => {
    const proteinas = Number(customProteinas);
    const carbos = Number(customCarbos);
    const grasas = Number(customGrasas);
    if (![proteinas, carbos, grasas].every((value) => Number.isInteger(value) && value >= 0)) return;
    setPersonalizado({
      kcal: proteinas * 4 + carbos * 4 + grasas * 9,
      proteinas,
      carbos,
      grasas,
    });
    setCustomOpen(false);
  };

  const kcalPersonalizadasPreview =
    Number(customProteinas || 0) * 4 +
    Number(customCarbos || 0) * 4 +
    Number(customGrasas || 0) * 9;

  const restablecerRecomendado = () => {
    setPersonalizado(null);
    setMacroPerfil('equilibrado');
  };

  const continuar = () => {
    if (!parsed.ok || !parsed.objetivo || !parsed.genero) return;
    setContinuando(true);
    trackOnboardingEvent('plan_confirmed', { objetivo: parsed.objetivo, kcal });
    router.push({
      pathname: '/(onboarding)/foto-perfil',
      params: {
        objetivo: parsed.objetivo,
        genero: parsed.genero,
        edad: String(parsed.edad),
        pesoKg: String(parsed.peso),
        alturaCm: String(parsed.altura),
        factorActividad: String(parsed.factor),
        kcal: String(kcal),
        proteinas: String(macros.proteinas),
        carbos: String(macros.carbos),
        grasas: String(macros.grasas),
      },
    });
  };

  if (!parsed.ok) {
    return <View style={[st.root, st.center]}><ActivityIndicator color={CYAN} /></View>;
  }

  return (
    <View style={[st.root, { paddingTop: insets.top + 10 }]}>
      <View style={st.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={22} color={WHITE} />
        </Pressable>
        <View style={st.progressTrack}>
          <View style={[st.progressFill, { width: `${(4 / TOTAL_PASOS) * 100}%` }]} />
        </View>
        <Text style={st.headerStep}>PASO 4 DE {TOTAL_PASOS}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scroll}>
        <Text style={st.title}>Tu plan está listo</Text>
        <Text style={st.subtitle}>Ya tienes una base para registrar comidas y entrenar con más claridad. Podrás ajustar los detalles después.</Text>

        <View style={st.kcalCard}>
          <Text style={st.kcalLabel}>Objetivo diario</Text>
          <Text style={st.kcalValue}>{kcal}</Text>
          <Text style={st.kcalUnit}>kcal</Text>
        </View>

        <View style={st.macroRow}>
          <MacroCard label="Proteínas" value={macros.proteinas} />
          <MacroCard label="Carbos" value={macros.carbos} />
          <MacroCard label="Grasas" value={macros.grasas} />
        </View>

        <View style={st.profileRow}>
          {([
            ['alta_proteina', 'Alta proteína'],
            ['equilibrado', 'Equilibrado'],
            ['alta_carbos', 'Alta en carbos'],
          ] as const).map(([id, label]) => {
            const selected = macroPerfil === id && personalizado == null;
            return (
              <Pressable
                key={id}
                style={[st.profileButton, selected && st.profileButtonSelected]}
                onPress={() => {
                  setMacroPerfil(id);
                  setPersonalizado(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[st.profileText, selected && st.profileTextSelected]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={st.nextCard}>
          <Text style={st.nextTitle}>Lo siguiente</Text>
          <Text style={st.nextText}>Después quedan dos pasos finales opcionales antes de entrar en Vértice.</Text>
        </View>
      </ScrollView>

      <View style={[st.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={st.secondaryCta} onPress={abrirPersonalizar} accessibilityRole="button">
          <Ionicons name="options-outline" size={17} color={CYAN} />
          <Text style={st.secondaryCtaText}>{personalizado ? 'Editar plan personalizado' : 'Personalizar plan'}</Text>
        </Pressable>
        {personalizado ? (
          <Pressable onPress={restablecerRecomendado} accessibilityRole="button">
            <Text style={st.resetText}>Volver al recomendado</Text>
          </Pressable>
        ) : null}
        <GlowButton borderRadius={12} glowPadding={28}>
          <Pressable style={st.cta} onPress={continuar} disabled={continuando} accessibilityRole="button">
            {continuando ? <ActivityIndicator color={BG} /> : <Text style={st.ctaText}>CONTINUAR</Text>}
          </Pressable>
        </GlowButton>
      </View>

      <Modal visible={customOpen} transparent animationType="fade" onRequestClose={() => setCustomOpen(false)}>
        <KeyboardAvoidingView style={st.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={st.modalCard}>
            <Text style={st.modalTitle}>Personalizar plan</Text>
            <Text style={st.modalText}>Introduce tus macros diarios. Las calorías se calculan automáticamente.</Text>
            <View style={st.previewCard}>
              <Text style={st.previewLabel}>Calorías resultantes</Text>
              <Text style={st.previewValue}>{kcalPersonalizadasPreview} kcal</Text>
            </View>
            <CustomInput label="Proteínas" value={customProteinas} onChangeText={setCustomProteinas} suffix="g" />
            <CustomInput label="Carbos" value={customCarbos} onChangeText={setCustomCarbos} suffix="g" />
            <CustomInput label="Grasas" value={customGrasas} onChangeText={setCustomGrasas} suffix="g" />
            <View style={st.modalActions}>
              <Pressable style={st.modalGhost} onPress={() => setCustomOpen(false)} accessibilityRole="button">
                <Text style={st.modalGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable style={st.modalPrimary} onPress={aplicarPersonalizacion} accessibilityRole="button">
                <Text style={st.modalPrimaryText}>Aplicar</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function MacroCard({ label, value }: { label: string; value: number }) {
  return <View style={st.macroCard}><Text style={st.macroLabel}>{label}</Text><Text style={st.macroValue}>{value} g</Text></View>;
}

function CustomInput({
  label,
  value,
  onChangeText,
  suffix,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  suffix: string;
}) {
  const soloEnteros = (next: string) => onChangeText(next.replace(/\D/g, ''));
  return (
    <View>
      <Text style={st.customLabel}>{label}</Text>
      <View style={st.customInputRow}>
        <TextInput
          style={st.customInput}
          value={value}
          onChangeText={soloEnteros}
          keyboardType="number-pad"
          maxLength={4}
          returnKeyType="done"
        />
        <Text style={st.customSuffix}>{suffix}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingHorizontal: 20 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: BORDER_SOFT, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: CYAN },
  headerStep: { color: LABEL, fontFamily: FontFamily.mono, fontSize: 10, letterSpacing: 1.5 },
  scroll: { paddingBottom: 16 },
  title: { color: WHITE, fontFamily: FontFamily.sansBold, fontSize: 22, lineHeight: 27 },
  subtitle: { marginTop: 8, color: AUTH.textSecondary, fontFamily: FontFamily.sans, fontSize: 13, lineHeight: 18 },
  kcalCard: { marginTop: 22, minHeight: 150, borderRadius: 12, borderWidth: 1, borderColor: BORDER_SOFT, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  kcalLabel: { color: LABEL, fontFamily: FontFamily.mono, fontSize: 10, letterSpacing: 1.4 },
  kcalValue: { marginTop: 6, color: CYAN, fontFamily: FontFamily.monoBold, fontSize: 42, lineHeight: 48 },
  kcalUnit: { color: AUTH.textSecondary, fontFamily: FontFamily.mono, fontSize: 12 },
  macroRow: { marginTop: 10, flexDirection: 'row', gap: 8 },
  macroCard: { flex: 1, minHeight: 88, borderRadius: 12, borderWidth: 1, borderColor: BORDER_SOFT, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  macroLabel: { color: LABEL, fontFamily: FontFamily.mono, fontSize: 9, letterSpacing: 1.1 },
  macroValue: { marginTop: 6, color: WHITE, fontFamily: FontFamily.sansBold, fontSize: 17 },
  profileRow: { marginTop: 10, flexDirection: 'row', gap: 8 },
  profileButton: { flex: 1, minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: BORDER_SOFT, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  profileButtonSelected: { borderColor: CYAN },
  profileText: { color: AUTH.textSecondary, fontFamily: FontFamily.sansMedium, fontSize: 11, textAlign: 'center' },
  profileTextSelected: { color: CYAN },
  nextCard: { marginTop: 10, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: BORDER_SOFT, backgroundColor: SURFACE },
  nextTitle: { color: WHITE, fontFamily: FontFamily.sansBold, fontSize: 14 },
  nextText: { marginTop: 5, color: AUTH.textSecondary, fontFamily: FontFamily.sans, fontSize: 12, lineHeight: 17 },
  footer: { paddingTop: 8, gap: 8 },
  secondaryCta: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: BORDER_SOFT, backgroundColor: SURFACE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryCtaText: { color: CYAN, fontFamily: FontFamily.sansBold, fontSize: 12 },
  resetText: { color: AUTH.textSecondary, fontFamily: FontFamily.sansMedium, fontSize: 12, textAlign: 'center' },
  cta: { height: 48, borderRadius: 12, backgroundColor: CYAN, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: BG, fontFamily: FontFamily.sansBold, fontSize: 12, letterSpacing: 2.3 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'center', paddingHorizontal: 20 },
  modalCard: { borderRadius: 16, borderWidth: 1, borderColor: BORDER_SOFT, backgroundColor: BG, padding: 16, gap: 12 },
  modalTitle: { color: WHITE, fontFamily: FontFamily.sansBold, fontSize: 18 },
  modalText: { color: AUTH.textSecondary, fontFamily: FontFamily.sans, fontSize: 12, lineHeight: 17 },
  previewCard: { borderRadius: 10, borderWidth: 1, borderColor: BORDER_SOFT, backgroundColor: SURFACE, padding: 12 },
  previewLabel: { color: LABEL, fontFamily: FontFamily.mono, fontSize: 9, letterSpacing: 1.1 },
  previewValue: { marginTop: 4, color: CYAN, fontFamily: FontFamily.monoBold, fontSize: 20 },
  customLabel: { marginBottom: 6, color: LABEL, fontFamily: FontFamily.mono, fontSize: 9, letterSpacing: 1.1 },
  customInputRow: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: BORDER_SOFT, backgroundColor: '#101010', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  customInput: { flex: 1, color: WHITE, fontFamily: FontFamily.sans, fontSize: 13 },
  customSuffix: { color: LABEL, fontFamily: FontFamily.sans, fontSize: 12 },
  modalActions: { marginTop: 4, flexDirection: 'row', gap: 8 },
  modalGhost: { flex: 1, minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: BORDER_SOFT, alignItems: 'center', justifyContent: 'center' },
  modalGhostText: { color: WHITE, fontFamily: FontFamily.sansMedium, fontSize: 13 },
  modalPrimary: { flex: 1, minHeight: 42, borderRadius: 10, backgroundColor: CYAN, alignItems: 'center', justifyContent: 'center' },
  modalPrimaryText: { color: BG, fontFamily: FontFamily.sansBold, fontSize: 13 },
});
