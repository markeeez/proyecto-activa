/**
 * Onboarding paso 1: datos corporales y nivel de actividad.
 *
 * Recoge género, edad, peso, altura y nivel de actividad del usuario.
 * Navega a /(onboarding)/objetivo pasando los datos como route params.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LogoSVG from '@/assets/images/logo_sb.svg';
import { GlowButton } from '@/components/ui/GlowButton';
import { Colors, FontFamily } from '@/constants/theme';

/* ──────────── Tipos exportados ──────────── */

export type GeneroOnboarding = 'hombre' | 'mujer';

type NivelActividad = 'sedentario' | 'ligero' | 'moderado' | 'activo' | 'muy_activo';
type IconName = ComponentProps<typeof Ionicons>['name'];

/* ──────────── Constantes ──────────── */

const HERO_H = 136;

const AUTH = Colors.dark;
const BG = AUTH.background;
const CYAN = AUTH.primary;
const WHITE = AUTH.textDisplay;
const SURFACE = AUTH.surface;
const BORDER = AUTH.borderVisible;
const BORDER_SOFT = AUTH.border;
const MUTED = AUTH.textMuted;
const LABEL = '#8A8A8A';
const ERROR = AUTH.danger;

const ACTIVITY_OPTIONS: Array<{
  key: NivelActividad;
  icon: IconName;
  title: string;
  description: string;
}> = [
  {
    key: 'sedentario',
    icon: 'bed-outline',
    title: 'Sedentario',
    description: 'Poco o ningún ejercicio',
  },
  {
    key: 'ligero',
    icon: 'walk-outline',
    title: 'Ligero',
    description: 'Ejercicio ligero 1-3 días/semana',
  },
  {
    key: 'moderado',
    icon: 'bicycle-outline',
    title: 'Moderado',
    description: 'Ejercicio moderado 3-5 días/semana',
  },
  {
    key: 'activo',
    icon: 'fitness-outline',
    title: 'Activo',
    description: 'Ejercicio intenso 6-7 días/semana',
  },
  {
    key: 'muy_activo',
    icon: 'flash-outline',
    title: 'Muy activo',
    description: 'Entrenamiento muy intenso, físico exigente',
  },
];

const ACTIVITY_FACTORS: Record<NivelActividad, string> = {
  sedentario: '1.2',
  ligero: '1.375',
  moderado: '1.55',
  activo: '1.725',
  muy_activo: '1.9',
};

/* ──────────── Pantalla ──────────── */

export default function OnboardingDatosPantalla() {
  const insets = useSafeAreaInsets();

  const [genero, setGenero] = useState<GeneroOnboarding>('hombre');
  const [edad, setEdad] = useState('');
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState('');
  const [nivelActividad, setNivelActividad] = useState<NivelActividad>('sedentario');

  const edadInvalid = useMemo(() => {
    const v = edad.trim();
    if (!v) return false;
    return !/^\d+$/.test(v);
  }, [edad]);

  const pesoInvalid = useMemo(() => {
    const v = peso.trim();
    if (!v) return false;
    return !/^\d+(?:[.,]\d+)?$/.test(v);
  }, [peso]);

  const alturaInvalid = useMemo(() => {
    const v = altura.trim();
    if (!v) return false;
    return !/^\d+$/.test(v);
  }, [altura]);

  const formOk = useMemo(
    () =>
      Boolean(
        genero &&
          edad.trim() &&
          !edadInvalid &&
          peso.trim() &&
          !pesoInvalid &&
          altura.trim() &&
          !alturaInvalid &&
          nivelActividad,
      ),
    [altura, alturaInvalid, edad, edadInvalid, genero, nivelActividad, peso, pesoInvalid],
  );

  const handleContinue = () => {
    if (!formOk || !genero) return;

    router.push({
      pathname: '/(onboarding)/objetivo',
      params: {
        genero,
        edad: edad.trim(),
        pesoKg: peso.trim().replace(',', '.'),
        alturaCm: altura.trim().replace(',', '.'),
        factorActividad: ACTIVITY_FACTORS[nivelActividad],
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={st.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[st.screen, { paddingTop: insets.top + 10 }]}>
        <View style={st.content}>
          <View style={st.header}>
            <Text style={st.headerKicker}>BIENVENIDO A VÉRTICE</Text>
            <Text style={st.headerStep}>PASO 1 DE 2</Text>
          </View>
          <View style={st.progressLine} />

          <View style={st.hero}>
            <View style={st.heroContent}>
              <View style={st.titleRow}>
                <View style={st.titleBlock}>
                  <Text style={st.title}>EMPECEMOS A</Text>
                  <Text style={[st.title, st.titleAccent]}>CONSTRUIR TU MEJOR VERSIÓN</Text>
                </View>
                <LogoSVG width={58} height={66} style={st.logo} />
              </View>

              <Text style={st.subtitle}>
                Para crear tu plan personalizado, necesitamos conocer un poco más sobre ti.
              </Text>
            </View>
          </View>

          <View style={st.card}>
            <FieldLabel>GÉNERO</FieldLabel>
            <View style={st.genderRow}>
              <Pressable
                style={[st.genderButton, genero === 'hombre' && st.genderButtonSelected]}
                onPress={() => setGenero('hombre')}
              >
                <Ionicons name="male-outline" size={28} color={genero === 'hombre' ? CYAN : LABEL} />
                <Text style={[st.genderText, genero === 'hombre' && st.selectedText]}>Masculino</Text>
              </Pressable>

              <Pressable
                style={[st.genderButton, genero === 'mujer' && st.genderButtonSelected]}
                onPress={() => setGenero('mujer')}
              >
                <Ionicons name="female-outline" size={28} color={genero === 'mujer' ? CYAN : LABEL} />
                <Text style={[st.genderText, genero === 'mujer' && st.selectedText]}>Femenino</Text>
              </Pressable>
            </View>
          </View>

          <View style={st.card}>
            <FieldLabel>EDAD</FieldLabel>
            <InputRow
              icon="calendar-outline"
              value={edad}
              onChangeText={setEdad}
              placeholder="Tu edad"
              suffix="años"
              keyboardType="number-pad"
              invalid={edadInvalid}
            />
          </View>

          <View style={st.twoColumns}>
            <View style={[st.card, st.halfCard]}>
              <FieldLabel>PESO ACTUAL</FieldLabel>
              <InputRow
                icon="scale-outline"
                value={peso}
                onChangeText={setPeso}
                placeholder="Tu peso"
                suffix="kg"
                keyboardType="decimal-pad"
              invalid={pesoInvalid}
              />
            </View>

            <View style={[st.card, st.halfCard]}>
              <FieldLabel>ALTURA</FieldLabel>
              <InputRow
                icon="resize-outline"
                value={altura}
                onChangeText={setAltura}
                placeholder="Tu altura"
                suffix="cm"
                keyboardType="number-pad"
              invalid={alturaInvalid}
              />
            </View>
          </View>

          <View style={st.card}>
            <FieldLabel>NIVEL DE ACTIVIDAD</FieldLabel>
            <View style={st.activityList}>
              {ACTIVITY_OPTIONS.map((option) => {
                const selected = nivelActividad === option.key;

                return (
                  <Pressable
                    key={option.key}
                    style={[st.activityRow, selected && st.activityRowSelected]}
                    onPress={() => setNivelActividad(option.key)}
                  >
                    <Ionicons name={option.icon} size={22} color={CYAN} style={st.activityIcon} />
                    <View style={st.activityTextBlock}>
                      <Text style={st.activityTitle}>{option.title}</Text>
                      <Text style={st.activityDescription}>{option.description}</Text>
                    </View>
                    <View style={[st.radioOuter, selected && st.radioOuterSelected]}>
                      {selected ? <View style={st.radioInner} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={[st.footer, { paddingBottom: insets.bottom + 12 }]}>
          <View style={!formOk && st.ctaDisabled}>
            <GlowButton borderRadius={12} glowPadding={28}>
              <Pressable
                style={st.cta}
                onPress={handleContinue}
                disabled={!formOk}
              >
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

/* ──────────── Componentes auxiliares ──────────── */

function FieldLabel({ children }: { children: string }) {
  return <Text style={st.label}>{children}</Text>;
}

function InputRow({
  icon,
  value,
  onChangeText,
  placeholder,
  suffix,
  keyboardType,
  invalid = false,
}: {
  icon: IconName;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  suffix: string;
  keyboardType: 'number-pad' | 'decimal-pad';
  invalid?: boolean;
}) {
  return (
    <View style={[st.inputRow, invalid && st.inputRowError]}>
      <Ionicons name={icon} size={22} color={CYAN} style={st.inputIcon} />
      <TextInput
        style={st.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={MUTED}
        keyboardType={keyboardType}
        selectionColor={CYAN}
      />
      <Text style={st.suffix}>{suffix}</Text>
    </View>
  );
}

/* ──────────── Estilos ──────────── */

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  screen: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerKicker: {
    color: CYAN,
    fontFamily: FontFamily.mono,
    fontSize: 10,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  headerStep: {
    color: LABEL,
    fontFamily: FontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  progressLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: CYAN,
    marginBottom: 8,
    opacity: 0.95,
  },
  hero: {
    height: HERO_H,
    overflow: 'hidden',
    marginHorizontal: -20,
    marginBottom: 6,
    marginTop: -20,
    position: 'relative',
  },
  heroContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    color: WHITE,
    fontFamily: FontFamily.sansBold,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
    textTransform: 'uppercase',
  },
  titleAccent: {
    color: CYAN,
  },
  logo: {
    marginRight: 2,
  },
  subtitle: {
    width: 284,
    marginTop: 10,
    color: AUTH.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  card: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    marginBottom: 6,
  },
  label: {
    marginBottom: 7,
    color: LABEL,
    fontFamily: FontFamily.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#121212',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  genderButtonSelected: {
    borderColor: CYAN,
    shadowColor: CYAN,
    shadowOpacity: 0.42,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  genderText: {
    color: WHITE,
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
  },
  selectedText: {
    color: CYAN,
  },
  inputRow: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: '#101010',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  inputRowError: {
    borderColor: ERROR,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: WHITE,
    fontFamily: FontFamily.sans,
    fontSize: 13,
    paddingVertical: Platform.select({ ios: 10, default: 6 }),
  },
  suffix: {
    color: LABEL,
    fontFamily: FontFamily.sans,
    fontSize: 12,
    marginLeft: 6,
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 8,
  },
  halfCard: {
    flex: 1,
  },
  activityList: {
    gap: 6,
  },
  activityRow: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: '#101010',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activityRowSelected: {
    borderColor: `${CYAN}55`,
  },
  activityIcon: {
    width: 24,
  },
  activityTextBlock: {
    flex: 1,
    paddingHorizontal: 8,
  },
  activityTitle: {
    color: WHITE,
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    lineHeight: 15,
  },
  activityDescription: {
    color: MUTED,
    fontFamily: FontFamily.sans,
    fontSize: 10,
    lineHeight: 13,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.8,
    borderColor: LABEL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: CYAN,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CYAN,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 6,
    backgroundColor: BG,
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  cta: {
    height: 48,
    borderRadius: 12,
    backgroundColor: CYAN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaText: {
    color: BG,
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    letterSpacing: 2.3,
    textTransform: 'uppercase',
  },
});
