import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import type { ComponentProps } from 'react';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
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
import { leerObjetivoUi, type GeneroOnboarding } from '@/lib/onboardingParams';

export type { GeneroOnboarding };

type IconName = ComponentProps<typeof Ionicons>['name'];

const TOTAL_PASOS = 6;
const AUTH = Colors.dark;
const BG = AUTH.background;
const CYAN = AUTH.primary;
const WHITE = AUTH.textDisplay;
const SURFACE = AUTH.surface;
const BORDER = AUTH.borderVisible;
const BORDER_SOFT = AUTH.border;
const MUTED = AUTH.textMuted;
const LABEL = AUTH.textMuted;
const ERROR = AUTH.danger;

function validarEdad(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return 'Introduce sólo números.';
  const n = Number(raw);
  if (n < 13 || n > 100) return 'La edad debe estar entre 13 y 100 años.';
  return null;
}

function validarPeso(value: string): string | null {
  const raw = value.trim().replace(',', '.');
  if (!raw) return null;
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return 'Usa un formato como 72 o 72,5.';
  const n = Number(raw);
  if (n < 30 || n > 300) return 'El peso debe estar entre 30 y 300 kg.';
  return null;
}

function validarAltura(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return 'Introduce sólo números.';
  const n = Number(raw);
  if (n < 120 || n > 230) return 'La altura debe estar entre 120 y 230 cm.';
  return null;
}

export default function OnboardingDatosPantalla() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ objetivo?: string | string[] }>();
  const objetivo = leerObjetivoUi(params.objetivo);

  const [genero, setGenero] = useState<GeneroOnboarding>('hombre');
  const [edad, setEdad] = useState('');
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState('');
  const [touched, setTouched] = useState({ edad: false, peso: false, altura: false });

  const edadError = validarEdad(edad);
  const pesoError = validarPeso(peso);
  const alturaError = validarAltura(altura);
  const formOk = useMemo(
    () => Boolean(objetivo && edad.trim() && peso.trim() && altura.trim() && !edadError && !pesoError && !alturaError),
    [altura, alturaError, edad, edadError, objetivo, peso, pesoError],
  );

  const continuar = () => {
    setTouched({ edad: true, peso: true, altura: true });
    if (!formOk || !objetivo) return;
    router.push({
      pathname: '/(onboarding)/actividad',
      params: {
        objetivo,
        genero,
        edad: edad.trim(),
        pesoKg: peso.trim().replace(',', '.'),
        alturaCm: altura.trim(),
      },
    });
  };

  return (
    <KeyboardAvoidingView style={st.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[st.screen, { paddingTop: insets.top + 10 }]}>
        <View style={st.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={22} color={WHITE} />
          </Pressable>
          <View style={st.progressTrack}>
            <View style={[st.progressFill, { width: `${(2 / TOTAL_PASOS) * 100}%` }]} />
          </View>
          <Text style={st.headerStep}>PASO 2 DE {TOTAL_PASOS}</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={st.scroll}
        >
          <Text style={st.kicker}>VÉRTICE</Text>
          <Text style={st.title}>Tus datos</Text>
          <Text style={st.subtitle}>Sólo necesitamos lo básico para calcular un punto de partida útil.</Text>

          <View style={st.card}>
            <FieldLabel>Género</FieldLabel>
            <View style={st.genderRow}>
              {(['hombre', 'mujer'] as const).map((item) => {
                const selected = genero === item;
                return (
                  <Pressable
                    key={item}
                    style={[st.genderButton, selected && st.genderButtonSelected]}
                    onPress={() => setGenero(item)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Ionicons name={item === 'hombre' ? 'male-outline' : 'female-outline'} size={24} color={selected ? CYAN : LABEL} />
                    <Text style={[st.genderText, selected && st.selectedText]}>{item === 'hombre' ? 'Masculino' : 'Femenino'}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={st.card}>
            <FieldLabel>Edad</FieldLabel>
            <InputRow
              icon="calendar-outline"
              value={edad}
              onChangeText={setEdad}
              onBlur={() => setTouched((prev) => ({ ...prev, edad: true }))}
              placeholder="25"
              suffix="años"
              keyboardType="number-pad"
              maxLength={3}
              error={touched.edad ? edadError : null}
            />
          </View>

          <View style={st.card}>
            <FieldLabel>Peso actual</FieldLabel>
            <InputRow
              icon="scale-outline"
              value={peso}
              onChangeText={setPeso}
              onBlur={() => setTouched((prev) => ({ ...prev, peso: true }))}
              placeholder="72,5"
              suffix="kg"
              keyboardType="decimal-pad"
              maxLength={6}
              error={touched.peso ? pesoError : null}
            />
          </View>

          <View style={st.card}>
            <FieldLabel>Altura</FieldLabel>
            <InputRow
              icon="resize-outline"
              value={altura}
              onChangeText={setAltura}
              onBlur={() => setTouched((prev) => ({ ...prev, altura: true }))}
              placeholder="175"
              suffix="cm"
              keyboardType="number-pad"
              maxLength={3}
              error={touched.altura ? alturaError : null}
            />
          </View>
        </ScrollView>

        <View style={[st.footer, { paddingBottom: insets.bottom + 12 }]}>
          <View style={!formOk && st.ctaDisabled}>
            <GlowButton borderRadius={12} glowPadding={28}>
              <Pressable style={st.cta} onPress={continuar} accessibilityRole="button" disabled={!formOk}>
                <Text style={st.ctaText}>CONTINUAR</Text>
                <Ionicons name="arrow-forward" size={20} color={BG} />
              </Pressable>
            </GlowButton>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={st.label}>{children}</Text>;
}

function InputRow({
  icon,
  value,
  onChangeText,
  onBlur,
  placeholder,
  suffix,
  keyboardType,
  maxLength,
  error,
}: {
  icon: IconName;
  value: string;
  onChangeText: (value: string) => void;
  onBlur: () => void;
  placeholder: string;
  suffix: string;
  keyboardType: 'number-pad' | 'decimal-pad';
  maxLength?: number;
  error: string | null;
}) {
  return (
    <>
      <View style={[st.inputRow, error && st.inputRowError]}>
        <Ionicons name={icon} size={20} color={CYAN} />
        <TextInput
          style={st.input}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={MUTED}
          keyboardType={keyboardType}
          maxLength={maxLength}
          returnKeyType="done"
        />
        <Text style={st.suffix}>{suffix}</Text>
      </View>
      {error ? <Text style={st.errorText}>{error}</Text> : null}
    </>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  screen: { flex: 1, backgroundColor: BG, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: BORDER_SOFT, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: CYAN },
  headerStep: { color: LABEL, fontFamily: FontFamily.mono, fontSize: 10, letterSpacing: 1.5 },
  scroll: { paddingBottom: 16 },
  kicker: { color: CYAN, fontFamily: FontFamily.mono, fontSize: 10, letterSpacing: 2.4 },
  title: { marginTop: 8, color: WHITE, fontFamily: FontFamily.sansBold, fontSize: 22, lineHeight: 27 },
  subtitle: { marginTop: 8, marginBottom: 18, color: AUTH.textSecondary, fontFamily: FontFamily.sans, fontSize: 13, lineHeight: 18 },
  card: { padding: 10, borderRadius: 12, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER_SOFT, marginBottom: 10 },
  label: { marginBottom: 7, color: LABEL, fontFamily: FontFamily.mono, fontSize: 9, letterSpacing: 1.4 },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderButton: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: '#101010', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  genderButtonSelected: { borderColor: CYAN },
  genderText: { color: WHITE, fontFamily: FontFamily.sansMedium, fontSize: 13 },
  selectedText: { color: CYAN },
  inputRow: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: BORDER_SOFT, backgroundColor: '#101010', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 },
  inputRowError: { borderColor: ERROR },
  input: { flex: 1, color: WHITE, fontFamily: FontFamily.sans, fontSize: 13 },
  suffix: { color: LABEL, fontFamily: FontFamily.sans, fontSize: 12 },
  errorText: { marginTop: 7, color: ERROR, fontFamily: FontFamily.sans, fontSize: 11, lineHeight: 15 },
  footer: { paddingTop: 6 },
  ctaDisabled: { opacity: 0.45 },
  cta: { height: 48, borderRadius: 12, backgroundColor: CYAN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ctaText: { color: BG, fontFamily: FontFamily.sansBold, fontSize: 12, letterSpacing: 2.3 },
});
