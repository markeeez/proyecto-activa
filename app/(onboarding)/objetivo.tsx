/**
 * Onboarding paso 2: objetivo nutricional, macros y guardado en Supabase.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { router, useLocalSearchParams } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';

import LogoSVG from '@/assets/images/logo_sb.svg';
import { GlowButton } from '@/components/ui/GlowButton';
import { Colors, FontFamily } from '@/constants/theme';
import { useThemeMode } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { fechaHoyIsoLocal } from '@/lib/fechaNutricion';
import { supabase } from '@/lib/supabase';
import type { Objetivo } from '@/types/database.types';
import type { GeneroOnboarding } from './datos';

type ObjetivoUi = 'perder' | 'mantener' | 'ganar';

type MacroPerfil = 'alta_proteina' | 'equilibrado' | 'alta_carbos';
type IconName = ComponentProps<typeof Ionicons>['name'];

function macrosDesdePerfil(perfil: MacroPerfil, pesoKg: number, kcalObjetivo: number): { p: number; c: number; f: number } {
  let proteinas_g: number;
  let grasas_g: number;
  switch (perfil) {
    case 'alta_proteina':
      proteinas_g = pesoKg * 2.2;
      grasas_g = pesoKg * 0.8;
      break;
    case 'equilibrado':
      proteinas_g = pesoKg * 2.0;
      grasas_g = pesoKg * 1.0;
      break;
    case 'alta_carbos':
      proteinas_g = pesoKg * 1.8;
      grasas_g = pesoKg * 0.8;
      break;
  }
  const carbos_g = (kcalObjetivo - proteinas_g * 4 - grasas_g * 9) / 4;
  const c = Math.max(0, carbos_g);
  return {
    p: Math.round(proteinas_g),
    c: Math.round(c),
    f: Math.round(grasas_g),
  };
}

function objetivoDbDesdeUi(ui: ObjetivoUi): Objetivo {
  switch (ui) {
    case 'perder':
      return 'perder_peso';
    case 'mantener':
      return 'mantener';
    case 'ganar':
      return 'ganar_masa';
  }
}

function fmtKgParaMensaje(kg: number): string {
  const t = kg.toFixed(1);
  return t.endsWith('.0') ? String(Math.round(kg)) : t;
}

function normalizarPesoObjetivoInput(value: string): string {
  let out = '';
  let separadorUsado = false;
  for (const ch of value) {
    const esDigito = ch >= '0' && ch <= '9';
    const esSeparador = ch === '.' || ch === ',';
    if (esDigito) {
      out += ch;
      continue;
    }
    if (esSeparador && !separadorUsado) {
      out += ch;
      separadorUsado = true;
    }
  }
  return out;
}

function inicialesUsuario(user: { user_metadata?: Record<string, unknown>; email?: string | null } | null): string {
  if (!user) return '?';
  const meta = user.user_metadata as Record<string, string | undefined> | undefined;
  const name = meta?.full_name ?? meta?.name ?? meta?.username;
  if (name && String(name).trim()) {
    const parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    return String(name).slice(0, 2).toUpperCase();
  }
  const email = user.email ?? '';
  const local = email.split('@')[0] ?? '';
  return local.slice(0, 2).toUpperCase() || '?';
}

function calcularKcalObjetivo(
  genero: GeneroOnboarding,
  peso: number,
  altura: number,
  edad: number,
  factor: number,
  objetivoUi: ObjetivoUi,
  velocidadKgSem: number,
): number {
  const tmb =
    genero === 'hombre'
      ? 10 * peso + 6.25 * altura - 5 * edad + 5
      : 10 * peso + 6.25 * altura - 5 * edad - 161;
  const tdee = tmb * factor;
  if (objetivoUi === 'perder') return tdee - velocidadKgSem * 1100;
  if (objetivoUi === 'ganar') return tdee + velocidadKgSem * 500;
  return tdee;
}

const PIE_SIZE = 90;
const PIE_CENTER = PIE_SIZE / 2;
const PIE_RADIUS = 38;
const PIE_GAP_DEG = 2;

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

const OBJETIVOS: { id: ObjetivoUi; label: string; icon: IconName }[] = [
  { id: 'perder', label: 'Perder grasa', icon: 'trending-down-outline' },
  { id: 'mantener', label: 'Mantener', icon: 'swap-horizontal-outline' },
  { id: 'ganar', label: 'Ganar masa', icon: 'trophy-outline' },
];

const PERFILES: { id: MacroPerfil; label: string; icon: IconName }[] = [
  { id: 'alta_proteina', label: 'Alta proteína', icon: 'flame-outline' },
  { id: 'equilibrado', label: 'Equilibrado', icon: 'options-outline' },
  { id: 'alta_carbos', label: 'Alta en carbs', icon: 'leaf-outline' },
];

function pieSlicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const toRad = (deg: number) => (deg - 90) * (Math.PI / 180);
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

function pieLabelPosition(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const midAngle = (startAngle + endAngle) / 2;
  const toRad = (deg: number) => (deg - 90) * (Math.PI / 180);
  return {
    x: cx + r * Math.cos(toRad(midAngle)),
    y: cy + r * Math.sin(toRad(midAngle)),
  };
}

function macroPieSlices(pct: { prot: number; carb: number; gras: number }) {
  const visible = [
    { key: 'proteinas', label: 'P', pct: Math.max(0, pct.prot), color: CYAN },
    { key: 'carbos', label: 'C', pct: Math.max(0, pct.carb), color: `${CYAN}B3` },
    { key: 'grasas', label: 'G', pct: Math.max(0, pct.gras), color: `${CYAN}66` },
  ].filter((segment) => segment.pct > 0);
  const total = visible.reduce((sum, segment) => sum + segment.pct, 0);
  if (total <= 0) return [];

  let currentAngle = 0;
  const gap = visible.length > 1 ? PIE_GAP_DEG : 0;
  return visible.map((segment) => {
    const angle = (segment.pct / total) * 360;
    const startAngle = currentAngle + gap / 2;
    const endAngle = currentAngle + angle - gap / 2;
    currentAngle += angle;
    return {
      key: segment.key,
      label: segment.label,
      color: segment.color,
      path: pieSlicePath(PIE_CENTER, PIE_CENTER, PIE_RADIUS, startAngle, Math.max(startAngle, endAngle)),
      labelPosition: pieLabelPosition(PIE_CENTER, PIE_CENTER, PIE_RADIUS * 0.58, startAngle, Math.max(startAngle, endAngle)),
    };
  });
}

export default function OnboardingObjetivoPantalla() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    genero?: string;
    edad?: string;
    pesoKg?: string;
    alturaCm?: string;
    factorActividad?: string;
  }>();
  const { user } = useAuth();
  const { isDark, setMode } = useThemeMode();

  const paso1 = useMemo(() => {
    const g = (Array.isArray(params.genero) ? params.genero[0] : params.genero) as GeneroOnboarding | undefined;
    const edad = Array.isArray(params.edad) ? params.edad[0] : params.edad;
    const pesoKg = Array.isArray(params.pesoKg) ? params.pesoKg[0] : params.pesoKg;
    const alturaCm = Array.isArray(params.alturaCm) ? params.alturaCm[0] : params.alturaCm;
    const fac = Array.isArray(params.factorActividad) ? params.factorActividad[0] : params.factorActividad;
    return { g, edad, pesoKg, alturaCm, fac };
  }, [params]);

  const parsed = useMemo(() => {
    const genero = paso1.g === 'mujer' ? 'mujer' : paso1.g === 'hombre' ? 'hombre' : null;
    const edad = paso1.edad ? parseInt(paso1.edad, 10) : NaN;
    const peso = paso1.pesoKg ? parseFloat(paso1.pesoKg) : NaN;
    const altura = paso1.alturaCm ? parseFloat(paso1.alturaCm) : NaN;
    const factor = paso1.fac ? parseFloat(paso1.fac) : NaN;
    const ok =
      genero != null &&
      Number.isFinite(edad) &&
      edad > 0 &&
      Number.isFinite(peso) &&
      peso > 0 &&
      Number.isFinite(altura) &&
      altura > 0 &&
      Number.isFinite(factor) &&
      factor > 0;
    return { ok, genero: genero as GeneroOnboarding | null, edad, peso, altura, factor };
  }, [paso1]);

  useEffect(() => {
    if (!parsed.ok) {
      router.replace('/(onboarding)/datos');
    }
  }, [parsed.ok]);

  const [objetivoUi, setObjetivoUi] = useState<ObjetivoUi>('mantener');
  const [pesoObjetivo, setPesoObjetivo] = useState('');
  const [velocidad, setVelocidad] = useState(0.5);
  const [macroPerfil, setMacroPerfil] = useState<MacroPerfil | null>('equilibrado');
  const [gramosPersonalizado, setGramosPersonalizado] = useState<{ p: number; c: number; f: number } | null>(null);
  const [modoPlan, setModoPlan] = useState<'manual' | 'ia'>('manual');
  const [modalPlanOpen, setModalPlanOpen] = useState(false);
  const [modalProt, setModalProt] = useState('');
  const [modalCarb, setModalCarb] = useState('');
  const [modalFat, setModalFat] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [modalFinalVisible, setModalFinalVisible] = useState(false);
  const [avatarPicked, setAvatarPicked] = useState<{ uri: string; mimeType: string } | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [temaElegido, setTemaElegido] = useState<'dark' | 'light'>(isDark ? 'dark' : 'light');

  const temaModal = temaElegido === 'light' ? Colors.light : Colors.dark;
  const modalBg = temaModal.background;
  const modalSurface = temaModal.surface;
  const modalBorder = temaModal.borderVisible;
  const modalBorderSoft = temaModal.border;
  const modalText = temaModal.textDisplay;
  const modalSecondary = temaModal.textSecondary;
  const modalMuted = temaModal.textMuted;
  const modalInner = temaElegido === 'light' ? temaModal.surfaceElevated : '#101010';

  const kcalTdee = useMemo(() => {
    if (!parsed.ok || !parsed.genero) return 0;
    return calcularKcalObjetivo(
      parsed.genero,
      parsed.peso,
      parsed.altura,
      parsed.edad,
      parsed.factor,
      objetivoUi,
      objetivoUi === 'mantener' ? 0 : velocidad,
    );
  }, [parsed, objetivoUi, velocidad]);

  const kcalTdeeRedondeada = Math.max(0, Math.round(kcalTdee));

  const kcalMostrar = useMemo(() => {
    if (macroPerfil !== null) {
      return kcalTdeeRedondeada;
    }
    if (!gramosPersonalizado) return kcalTdeeRedondeada;
    const { p, c, f: fat } = gramosPersonalizado;
    return Math.round(p * 4 + c * 4 + fat * 9);
  }, [macroPerfil, kcalTdeeRedondeada, gramosPersonalizado]);

  const gramos = useMemo(() => {
    if (macroPerfil !== null) {
      return macrosDesdePerfil(macroPerfil, parsed.peso, kcalMostrar);
    }
    return gramosPersonalizado ?? { p: 0, c: 0, f: 0 };
  }, [macroPerfil, parsed.peso, kcalMostrar, gramosPersonalizado]);

  const pctMacros = useMemo(() => {
    const k = kcalMostrar;
    if (k <= 0) return { prot: 0, carb: 0, gras: 0 };
    const prot_pct = Math.round(((gramos.p * 4) / k) * 100);
    const carb_pct = Math.round(((gramos.c * 4) / k) * 100);
    const gras_pct = 100 - prot_pct - carb_pct;
    return { prot: prot_pct, carb: carb_pct, gras: gras_pct };
  }, [gramos, kcalMostrar]);

  const kcalModalPreview = useMemo(() => {
    const p = parseFloat(modalProt.replace(',', '.'));
    const carb = parseFloat(modalCarb.replace(',', '.'));
    const fat = parseFloat(modalFat.replace(',', '.'));
    if (!Number.isFinite(p) || !Number.isFinite(carb) || !Number.isFinite(fat)) return 0;
    return Math.round(p * 4 + carb * 4 + fat * 9);
  }, [modalProt, modalCarb, modalFat]);

  const errorPesoObjetivo = useMemo(() => {
    if (objetivoUi === 'mantener') return null;
    const po = pesoObjetivo.trim().replace(',', '.');
    if (!po) return null;
    const n = parseFloat(po);
    if (!Number.isFinite(n) || n <= 0) return null;
    const w = parsed.peso;
    const wTxt = fmtKgParaMensaje(w);
    if (objetivoUi === 'perder' && n >= w) {
      return `El peso objetivo debe ser menor que tu peso actual (${wTxt} kg)`;
    }
    if (objetivoUi === 'ganar' && n <= w) {
      return `El peso objetivo debe ser mayor que tu peso actual (${wTxt} kg)`;
    }
    return null;
  }, [objetivoUi, pesoObjetivo, parsed.peso]);

  const formGuardarOk = useMemo(() => {
    if (kcalMostrar <= 0) return false;
    if (objetivoUi === 'mantener') return true;
    const po = pesoObjetivo.trim().replace(',', '.');
    if (!po) return false;
    const n = parseFloat(po);
    if (!Number.isFinite(n) || n <= 0) return false;
    if (errorPesoObjetivo) return false;
    return true;
  }, [objetivoUi, pesoObjetivo, kcalMostrar, errorPesoObjetivo]);

  const pieSegments = useMemo(() => macroPieSlices(pctMacros), [pctMacros]);

  const bumpVelocidad = (sign: number) => {
    if (objetivoUi === 'mantener') return;
    setVelocidad((v) => {
      const next = Math.round((v + sign * 0.1) * 10) / 10;
      return Math.max(0.1, Math.min(1, next));
    });
  };

  const abrirModalPlan = () => {
    setModalProt(String(gramos.p));
    setModalCarb(String(gramos.c));
    setModalFat(String(gramos.f));
    setModalPlanOpen(true);
  };

  const aplicarPlanPersonalizado = () => {
    const p = parseFloat(modalProt.replace(',', '.'));
    const carb = parseFloat(modalCarb.replace(',', '.'));
    const fat = parseFloat(modalFat.replace(',', '.'));
    if (!Number.isFinite(p) || !Number.isFinite(carb) || !Number.isFinite(fat) || p < 0 || carb < 0 || fat < 0) {
      Alert.alert('Valores no válidos', 'Introduce gramos válidos (números ≥ 0).');
      return;
    }
    setGramosPersonalizado({ p: Math.round(p), c: Math.round(carb), f: Math.round(fat) });
    setMacroPerfil(null);
    setModalPlanOpen(false);
  };

  const seleccionarPerfil = (id: MacroPerfil) => {
    setMacroPerfil(id);
    setGramosPersonalizado(null);
  };

  const restablecerPlan = () => {
    setMacroPerfil('equilibrado');
    setGramosPersonalizado(null);
    setModalPlanOpen(false);
  };

  const irANutricion = async () => {
    setMode(temaElegido);
    await Notifications.requestPermissionsAsync();
    router.replace('/(tabs)/inicio');
  };

  const anadirFoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    setAvatarPicked({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg' });
  };

  const saltarFinal = () => {
    void irANutricion();
  };

  const empezarFinal = async () => {
    if (!user?.id) {
      irANutricion();
      return;
    }
    setFinalizando(true);
    try {
      if (avatarPicked) {
        const resFetch = await fetch(avatarPicked.uri);
        const buf = await resFetch.arrayBuffer();
        const contentType = avatarPicked.mimeType || 'image/jpeg';
        // Requiere bucket público `avatars` en Supabase Storage (Storage → New bucket → avatars → Public: on).
        const { error: upErr } = await supabase.storage.from('avatars').upload(`${user.id}/avatar.jpg`, buf, {
          upsert: true,
          contentType,
        });
        if (upErr) {
          Alert.alert('Error', upErr.message ?? 'No se pudo subir la foto.');
          return;
        }
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(`${user.id}/avatar.jpg`);
        const { error: authErr } = await supabase.auth.updateUser({
          data: { avatar_url: pub.publicUrl },
        });
        if (authErr) {
          Alert.alert('Error', authErr.message ?? 'No se pudo guardar la foto de perfil.');
          return;
        }
      }
      await irANutricion();
    } finally {
      setFinalizando(false);
    }
  };

  const onGuardar = async () => {
    if (!user?.id || !parsed.ok || !parsed.genero || !formGuardarOk) return;
    setGuardando(true);
    try {
      const fecha = fechaHoyIsoLocal();
      const pesoKg = parsed.peso;
      const alturaCm = parsed.altura;

      const { error: errMetrics } = await supabase.from('user_body_metrics').upsert(
        {
          user_id: user.id,
          peso_kg: pesoKg,
          altura_cm: alturaCm,
          fecha,
        },
        { onConflict: 'user_id,fecha' },
      );
      if (errMetrics) {
        Alert.alert('Error', errMetrics.message ?? 'No se pudieron guardar las métricas.');
        return;
      }

      const { error: errProfile } = await supabase
        .from('profiles')
        .update({
          genero: parsed.genero,
          edad: parsed.edad,
          altura_cm: parsed.altura,
          factor_actividad: parsed.factor,
        })
        .eq('id', user.id);
      if (errProfile) {
        console.error('[onboarding] profiles update', errProfile);
      }

      const objetivo = objetivoDbDesdeUi(objetivoUi);
      const { error: errGoals } = await supabase.from('user_goals').upsert(
        {
          user_id: user.id,
          objetivo,
          calorias_objetivo: kcalMostrar,
          proteinas_objetivo: gramos.p,
          carbos_objetivo: gramos.c,
          grasas_objetivo: gramos.f,
          peso_objetivo: objetivoUi !== 'mantener' ? parseFloat(pesoObjetivo.replace(',', '.')) : null,
        },
        { onConflict: 'user_id' },
      );
      if (errGoals) {
        Alert.alert('Error', errGoals.message ?? 'No se pudieron guardar los objetivos.');
        return;
      }

      setModalFinalVisible(true);
    } finally {
      setGuardando(false);
    }
  };

  if (!parsed.ok) {
    return (
      <View style={[st.root, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={CYAN} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={st.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[st.screen, { paddingTop: insets.top + 10 }]}>
        <View style={st.header}>
          <View style={st.headerSide}>
            <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Volver">
              <Ionicons name="chevron-back" size={22} color={WHITE} />
            </Pressable>
          </View>
          <View style={st.progressTrack}>
            <View style={st.progressFill} />
          </View>
          <Text style={st.headerStep}>PASO 2 DE 2</Text>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={st.scroll}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[0]}
        >
          <View style={st.heroSticky}>
            <Text style={st.kicker}>TU PLAN</Text>
            <View style={st.titleRow}>
              <View style={st.titleBlock}>
                <Text style={st.title}>DEFINE TU OBJETIVO</Text>
                <Text style={[st.title, st.titleAccent]}>Y TU PLAN IDEAL</Text>
              </View>
              <LogoSVG width={58} height={66} style={st.logo} />
            </View>
          </View>

          <View style={st.heroCopy}>
            <Text style={st.subtitle}>
              {modoPlan === 'manual'
                ? 'Calculamos tus necesidades diarias\ny te sugerimos un plan adaptado a ti.'
                : 'Cuéntale a la IA tus preferencias\ny construye tu plan ideal.'}
            </Text>
            <Pressable
              style={st.heroModeButton}
              onPress={() => setModoPlan((modo) => (modo === 'manual' ? 'ia' : 'manual'))}
              accessibilityRole="button"
              accessibilityLabel={modoPlan === 'manual' ? 'Activar modo IA' : 'Volver al modo manual'}
            >
              <Ionicons name={modoPlan === 'manual' ? 'sparkles' : 'create-outline'} size={16} color={CYAN} />
              <Text style={st.heroModeButtonText}>{modoPlan === 'manual' ? 'IA' : 'Manual'}</Text>
            </Pressable>
          </View>

          {modoPlan === 'manual' ? (
            <>
          <View style={st.card}>
            <FieldLabel>¿CUÁL ES TU OBJETIVO?</FieldLabel>
            <View style={st.objectiveRow}>
              {OBJETIVOS.map(({ id, label, icon }) => {
                const selected = objetivoUi === id;
                return (
                  <Pressable
                    key={id}
                    style={[st.objectiveButton, selected && st.optionSelected]}
                    onPress={() => setObjetivoUi(id)}
                  >
                    <Ionicons name={icon} size={23} color={selected ? CYAN : LABEL} />
                    <Text style={[st.objectiveText, selected && st.selectedText]} numberOfLines={1}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {objetivoUi !== 'mantener' ? (
              <View style={st.goalDetails}>
                <View style={st.goalField}>
                  <FieldLabel>PESO OBJETIVO</FieldLabel>
                  <View style={[st.goalInputRow, errorPesoObjetivo && st.inputRowError]}>
                    <TextInput
                      style={st.input}
                      value={pesoObjetivo}
                      onChangeText={(value) => setPesoObjetivo(normalizarPesoObjetivoInput(value))}
                      placeholder="kg"
                      placeholderTextColor={MUTED}
                      keyboardType="decimal-pad"
                      selectionColor={CYAN}
                    />
                    <Text style={st.suffix}>kg</Text>
                  </View>
                  {errorPesoObjetivo ? <Text style={st.errorText}>{errorPesoObjetivo}</Text> : null}
                </View>

                <View style={st.goalField}>
                  <FieldLabel>VELOCIDAD (kg/semana)</FieldLabel>
                  <View style={st.velocityRow}>
                    <Pressable style={st.stepButton} onPress={() => bumpVelocidad(-1)}>
                      <Text style={st.stepButtonText}>−</Text>
                    </Pressable>
                    <Text style={st.velocityValue}>{velocidad.toFixed(1)}</Text>
                    <Pressable style={st.stepButton} onPress={() => bumpVelocidad(1)}>
                      <Text style={st.stepButtonText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : null}
          </View>

          <FieldLabel>TUS CALORÍAS DIARIAS</FieldLabel>
          <View style={[st.card, st.kcalCard]}>
            <View style={st.kcalTextBlock}>
              <Text style={st.kcalLabel}>TU OBJETIVO</Text>
              <Text style={st.kcalValue}>{kcalMostrar}</Text>
              <Text style={st.kcalUnit}>kcal / día</Text>
            </View>
            <View style={st.pieWrap}>
              <Svg width={PIE_SIZE} height={PIE_SIZE} viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}>
                <G>
                  {pieSegments.map((segment) => (
                    <Path key={segment.key} d={segment.path} fill={segment.color} />
                  ))}
                  {pieSegments.map((segment) => (
                    <SvgText
                      key={`${segment.key}-label`}
                      x={segment.labelPosition.x}
                      y={segment.labelPosition.y}
                      fill={WHITE}
                      stroke={BG}
                      strokeWidth={0.6}
                      fontFamily={FontFamily.monoBold}
                      fontSize={11}
                      textAnchor="middle"
                      alignmentBaseline="middle"
                    >
                      {segment.label}
                    </SvgText>
                  ))}
                </G>
              </Svg>
            </View>
          </View>

          <FieldLabel>DISTRIBUCIÓN DE MACROS</FieldLabel>
          <View style={st.macroPerfilRow}>
            {PERFILES.map(({ id, label, icon }) => {
              const selected = macroPerfil === id;
              return (
                <Pressable
                  key={id}
                  style={[st.macroPerfilButton, selected && st.optionSelected]}
                  onPress={() => seleccionarPerfil(id)}
                >
                  <Ionicons name={icon} size={20} color={selected ? CYAN : LABEL} />
                  <Text style={[st.macroPerfilText, selected && st.selectedText]} numberOfLines={1}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={st.macroCardsRow}>
            <MacroCard title="PROTEÍNAS" grams={gramos.p} pct={pctMacros.prot} kcal={gramos.p * 4} color={CYAN} />
            <MacroCard title="CARBOS" grams={gramos.c} pct={pctMacros.carb} kcal={gramos.c * 4} color={`${CYAN}B3`} />
            <MacroCard title="GRASAS" grams={gramos.f} pct={pctMacros.gras} kcal={gramos.f * 9} color={`${CYAN}66`} />
          </View>

          <View style={[st.card, st.infoCard]}>
            <Ionicons name="sparkles" size={20} color={CYAN} />
            <View style={st.infoTextBlock}>
              <Text style={st.infoTitle}>Estos valores están adaptados a tu perfil</Text>
              <Text style={st.infoDescription}>Podrás ajustarlos más adelante.</Text>
            </View>
          </View>

          <Pressable style={[st.card, st.planRow]} onPress={abrirModalPlan}>
            <View style={st.planRowLeft}>
              <Ionicons name="options-outline" size={20} color={CYAN} />
              <Text style={st.planRowText}>Personalizar plan</Text>
            </View>
            <Ionicons name="chevron-up" size={18} color={LABEL} />
          </Pressable>
            </>
          ) : (
            <AiChatSkeleton />
          )}
        </ScrollView>

        <View style={[st.footer, { paddingBottom: insets.bottom + 12 }]}>
          <View style={(!formGuardarOk || guardando || modoPlan === 'ia') && st.ctaDisabled}>
            <GlowButton borderRadius={12} glowPadding={28}>
              <Pressable
                style={st.cta}
                onPress={() => void onGuardar()}
                disabled={!formGuardarOk || guardando || modoPlan === 'ia'}
              >
                {guardando ? (
                  <ActivityIndicator color={BG} />
                ) : (
                  <Text style={st.ctaText}>{modoPlan === 'ia' ? 'MODO IA EN PRUEBA' : 'GUARDAR Y EMPEZAR'}</Text>
                )}
              </Pressable>
            </GlowButton>
          </View>
        </View>
      </View>

      <Modal visible={modalPlanOpen} transparent animationType="slide" onRequestClose={() => setModalPlanOpen(false)}>
        <Pressable style={st.modalBackdrop} onPress={() => setModalPlanOpen(false)}>
          <Pressable
            style={[st.modalCard, { paddingBottom: insets.bottom + 16 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <Text style={st.modalTitle}>Personalizar plan</Text>
              <Text style={st.modalDescription}>
                Introduce los gramos diarios que quieres consumir. Las calorías se calcularán automáticamente.
              </Text>

              <FieldLabel>PROTEÍNAS (G)</FieldLabel>
              <View style={st.inputRow}>
                <TextInput
                  style={st.input}
                  value={modalProt}
                  onChangeText={setModalProt}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={MUTED}
                  selectionColor={CYAN}
                />
                <Text style={st.suffix}>g</Text>
              </View>

              <FieldLabel>CARBOS (G)</FieldLabel>
              <View style={st.inputRow}>
                <TextInput
                  style={st.input}
                  value={modalCarb}
                  onChangeText={setModalCarb}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={MUTED}
                  selectionColor={CYAN}
                />
                <Text style={st.suffix}>g</Text>
              </View>

              <FieldLabel>GRASAS (G)</FieldLabel>
              <View style={st.inputRow}>
                <TextInput
                  style={st.input}
                  value={modalFat}
                  onChangeText={setModalFat}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={MUTED}
                  selectionColor={CYAN}
                />
                <Text style={st.suffix}>g</Text>
              </View>

              <View style={st.modalKcalCard}>
                <Text style={st.kcalLabel}>CALORÍAS ESTIMADAS</Text>
                <Text style={st.modalKcalLive}>{kcalModalPreview} kcal</Text>
              </View>

              <View style={st.modalActions}>
                <GlowButton borderRadius={12} glowPadding={24}>
                  <Pressable style={st.cta} onPress={aplicarPlanPersonalizado}>
                    <Text style={st.ctaText}>APLICAR</Text>
                  </Pressable>
                </GlowButton>
                {macroPerfil === null ? (
                  <Pressable style={st.ghostButton} onPress={restablecerPlan}>
                    <Text style={st.ghostButtonText}>Restablecer plan</Text>
                  </Pressable>
                ) : null}
                <Pressable style={st.ghostButton} onPress={() => setModalPlanOpen(false)}>
                  <Text style={st.ghostButtonText}>Cancelar</Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={modalFinalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {}}
      >
        <View style={[st.finalModalRoot, { backgroundColor: modalBg, paddingTop: insets.top + 10 }]}>
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={st.finalModalScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={st.finalModalHeader}>
              <Text style={st.kicker}>TU PERFIL</Text>
              <Text style={[st.finalModalTitle, { color: modalText }]}>UN ÚLTIMO PASO</Text>
              <Text style={[st.finalModalSubtitle, { color: modalSecondary }]}>
                Estos ajustes son opcionales, puedes cambiarlos después en tu perfil.
              </Text>
            </View>

            <View style={st.finalModalBody}>
              <View style={[st.card, { backgroundColor: modalSurface, borderColor: modalBorderSoft }]}>
                <FieldLabel>TEMA DE LA APP</FieldLabel>
                <View style={st.themeRow}>
                  <Pressable
                    style={[
                      st.themeButton,
                      { backgroundColor: modalInner, borderColor: modalBorderSoft },
                      temaElegido === 'dark' && st.optionSelected,
                    ]}
                    onPress={() => setTemaElegido('dark')}
                  >
                    <Ionicons name="moon-outline" size={18} color={temaElegido === 'dark' ? CYAN : LABEL} />
                    <Text style={[st.themeButtonText, { color: modalText }, temaElegido === 'dark' && st.selectedText]}>Oscuro</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      st.themeButton,
                      { backgroundColor: modalInner, borderColor: modalBorderSoft },
                      temaElegido === 'light' && st.optionSelected,
                    ]}
                    onPress={() => setTemaElegido('light')}
                  >
                    <Ionicons name="sunny-outline" size={18} color={temaElegido === 'light' ? CYAN : LABEL} />
                    <Text style={[st.themeButtonText, { color: modalText }, temaElegido === 'light' && st.selectedText]}>Claro</Text>
                  </Pressable>
                </View>
                <Text style={[st.themeHint, { color: modalMuted }]}>Se aplicará al entrar en la pantalla principal.</Text>
              </View>

              <View style={[st.card, { backgroundColor: modalSurface, borderColor: modalBorderSoft }]}>
                <FieldLabel>FOTO DE PERFIL</FieldLabel>
                <View style={st.avatarWrap}>
                  <View style={[st.avatarCircle, { backgroundColor: modalInner, borderColor: modalBorder }]}>
                    {avatarPicked ? (
                      <Image source={{ uri: avatarPicked.uri }} style={st.avatarImage} contentFit="cover" />
                    ) : (
                      <Text style={[st.avatarInitials, { color: LABEL }]}>{inicialesUsuario(user)}</Text>
                    )}
                  </View>
                  <Pressable onPress={() => void anadirFoto()}>
                    <Text style={st.photoLink}>{avatarPicked ? 'Cambiar foto' : 'Añadir foto'}</Text>
                  </Pressable>
                  {!avatarPicked ? (
                    <Text style={[st.photoHelp, { color: modalMuted }]}>Encuadra la foto y pulsa CORTAR para confirmar</Text>
                  ) : null}
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={[st.finalModalFooter, { backgroundColor: modalBg, paddingBottom: insets.bottom + 12 }]}>
            <View style={finalizando && st.ctaDisabled}>
              <GlowButton borderRadius={12} glowPadding={28}>
                <Pressable style={st.cta} onPress={() => void empezarFinal()} disabled={finalizando}>
                  {finalizando ? (
                    <ActivityIndicator color={modalBg} />
                  ) : (
                    <Text style={st.ctaText}>EMPEZAR</Text>
                  )}
                </Pressable>
              </GlowButton>
            </View>
            <Pressable onPress={saltarFinal} disabled={finalizando}>
              <Text style={[st.skipLink, { color: modalMuted }]}>Saltar por ahora</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={st.label}>{children}</Text>;
}

function AiChatSkeleton() {
  return (
    <View style={st.aiChatShell}>
      <View style={st.aiChatHeader}>
        <View style={st.aiChatIcon}>
          <Ionicons name="sparkles" size={22} color={CYAN} />
        </View>
        <View style={st.aiChatHeaderText}>
          <Text style={st.aiChatTitle}>Asistente de plan</Text>
          <Text style={st.aiChatSubtitle}>Chat en preparación para generar tu plan con IA.</Text>
        </View>
      </View>

      <View style={st.aiMessageStack}>
        <View style={[st.aiBubble, st.aiBubbleAssistant]}>
          <View style={[st.aiSkeletonLine, { width: '86%' }]} />
          <View style={[st.aiSkeletonLine, { width: '62%' }]} />
        </View>
        <View style={[st.aiBubble, st.aiBubbleUser]}>
          <View style={[st.aiSkeletonLine, st.aiSkeletonLineAccent, { width: '72%' }]} />
        </View>
        <View style={[st.aiBubble, st.aiBubbleAssistant]}>
          <View style={[st.aiSkeletonLine, { width: '78%' }]} />
          <View style={[st.aiSkeletonLine, { width: '48%' }]} />
          <View style={st.aiOptionRow}>
            <View style={st.aiOptionPill} />
            <View style={st.aiOptionPill} />
          </View>
        </View>
      </View>

      <View style={st.aiInputPreview}>
        <Text style={st.aiInputText}>Escribe tus horarios, gustos y objetivo...</Text>
        <Ionicons name="send-outline" size={18} color={CYAN} />
      </View>
    </View>
  );
}

function MacroCard({
  title,
  grams,
  pct,
  kcal,
  color,
}: {
  title: string;
  grams: number;
  pct: number;
  kcal: number;
  color: string;
}) {
  return (
    <View style={st.macroCard}>
      <Text style={st.macroCardTitle}>{title}</Text>
      <Text style={st.macroCardGrams}>{grams}g</Text>
      <View style={st.macroBarTrack}>
        <View style={[st.macroBarFill, { backgroundColor: color }]} />
      </View>
      <Text style={[st.macroCardPct, { color }]}>{pct}%</Text>
      <Text style={st.macroCardKcal}>{kcal} kcal</Text>
    </View>
  );
}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 8,
  },
  headerSide: {
    width: 24,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerStep: {
    color: LABEL,
    fontFamily: FontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
    backgroundColor: BORDER_SOFT,
  },
  progressFill: {
    width: '60%',
    height: 3,
    borderRadius: 1.5,
    backgroundColor: CYAN,
  },
  scroll: {
    paddingBottom: 12,
  },
  heroSticky: {
    backgroundColor: BG,
    paddingTop: 8,
    paddingBottom: 10,
    zIndex: 10,
    elevation: 10,
  },
  heroCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 10,
  },
  kicker: {
    color: CYAN,
    fontFamily: FontFamily.mono,
    fontSize: 10,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  titleBlock: {
    flex: 1,
    paddingRight: 10,
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
    flex: 1,
    color: AUTH.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  heroModeButton: {
    minHeight: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: SURFACE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  heroModeButtonText: {
    color: CYAN,
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
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
  objectiveRow: {
    flexDirection: 'row',
    gap: 8,
  },
  objectiveButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 5,
  },
  optionSelected: {
    borderColor: CYAN,
    shadowColor: CYAN,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  objectiveText: {
    color: WHITE,
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
  },
  selectedText: {
    color: CYAN,
  },
  aiChatShell: {
    minHeight: 420,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: SURFACE,
    padding: 12,
    marginBottom: 6,
  },
  aiChatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_SOFT,
  },
  aiChatIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${CYAN}55`,
    backgroundColor: '#101010',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiChatHeaderText: {
    flex: 1,
  },
  aiChatTitle: {
    color: WHITE,
    fontFamily: FontFamily.sansBold,
    fontSize: 16,
    lineHeight: 20,
    textTransform: 'uppercase',
  },
  aiChatSubtitle: {
    marginTop: 2,
    color: MUTED,
    fontFamily: FontFamily.sans,
    fontSize: 11,
    lineHeight: 14,
  },
  aiMessageStack: {
    gap: 10,
    paddingVertical: 14,
  },
  aiBubble: {
    maxWidth: '86%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    padding: 10,
    gap: 7,
  },
  aiBubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#101010',
  },
  aiBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: `${CYAN}1F`,
    borderColor: `${CYAN}55`,
  },
  aiSkeletonLine: {
    height: 8,
    borderRadius: 4,
    backgroundColor: BORDER,
  },
  aiSkeletonLineAccent: {
    backgroundColor: `${CYAN}77`,
  },
  aiOptionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  aiOptionPill: {
    width: 72,
    height: 26,
    borderRadius: 10,
    backgroundColor: BORDER_SOFT,
  },
  aiInputPreview: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: '#101010',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginTop: 'auto',
  },
  aiInputText: {
    color: MUTED,
    fontFamily: FontFamily.sans,
    fontSize: 12,
  },
  goalDetails: {
    marginTop: 8,
    gap: 6,
  },
  goalField: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: '#101010',
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
    marginBottom: 10,
  },
  goalInputRow: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: SURFACE,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  inputRowError: {
    borderColor: ERROR,
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
  errorText: {
    color: ERROR,
    fontFamily: FontFamily.sans,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
  },
  velocityRow: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: SURFACE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 4,
  },
  velocityValue: {
    minWidth: 52,
    color: WHITE,
    fontFamily: FontFamily.mono,
    fontSize: 18,
    textAlign: 'center',
  },
  stepButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {
    color: WHITE,
    fontFamily: FontFamily.monoBold,
    fontSize: 18,
    lineHeight: 22,
  },
  kcalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 120,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  pieWrap: {
    width: PIE_SIZE,
    height: PIE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 40
  },
  kcalTextBlock: {
    flex: 1,
    alignItems: 'flex-start',
    paddingRight: 12,
    marginLeft: 40
  },
  kcalLabel: {
    color: LABEL,
    fontFamily: FontFamily.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  kcalValue: {
    marginTop: 4,
    color: CYAN,
    fontFamily: FontFamily.monoBold,
    fontSize: 36,
    lineHeight: 42,
  },
  kcalUnit: {
    color: MUTED,
    fontFamily: FontFamily.mono,
    fontSize: 11,
  },
  macroPerfilRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  macroPerfilButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 4,
  },
  macroPerfilText: {
    color: WHITE,
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    textAlign: 'center',
  },
  macroCardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  macroCard: {
    flex: 1,
    minHeight: 122,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: SURFACE,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  macroCardTitle: {
    color: LABEL,
    fontFamily: FontFamily.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  macroCardGrams: {
    marginTop: 6,
    color: WHITE,
    fontFamily: FontFamily.sansBold,
    fontSize: 18,
    lineHeight: 22,
  },
  macroBarTrack: {
    width: '60%',
    height: 3,
    borderRadius: 1.5,
    backgroundColor: BORDER_SOFT,
    overflow: 'hidden',
    marginVertical: 6,
  },
  macroBarFill: {
    width: '72%',
    height: 3,
    borderRadius: 1.5,
  },
  macroCardPct: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    lineHeight: 15,
  },
  macroCardKcal: {
    marginTop: 3,
    color: MUTED,
    fontFamily: FontFamily.mono,
    fontSize: 10,
    lineHeight: 14,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoTextBlock: {
    flex: 1,
  },
  infoTitle: {
    color: WHITE,
    fontFamily: FontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  infoDescription: {
    color: MUTED,
    fontFamily: FontFamily.sans,
    fontSize: 11,
    lineHeight: 14,
  },
  planRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planRowText: {
    color: WHITE,
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '86%',
    paddingHorizontal: 20,
    paddingTop: 18,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: BG,
  },
  modalTitle: {
    color: WHITE,
    fontFamily: FontFamily.sansBold,
    fontSize: 20,
    lineHeight: 24,
    textTransform: 'uppercase',
  },
  modalDescription: {
    marginTop: 8,
    marginBottom: 14,
    color: AUTH.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  modalKcalCard: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    marginTop: 2,
    marginBottom: 14,
  },
  modalKcalLive: {
    marginTop: 4,
    color: CYAN,
    fontFamily: FontFamily.monoBold,
    fontSize: 22,
    lineHeight: 28,
  },
  modalActions: {
    gap: 10,
  },
  ghostButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: {
    color: WHITE,
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
  },
  finalModalRoot: {
    flex: 1,
    backgroundColor: BG,
  },
  finalModalScroll: {
    flexGrow: 1,
    paddingBottom: 12,
  },
  finalModalHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  finalModalTitle: {
    marginTop: 8,
    color: WHITE,
    fontFamily: FontFamily.sansBold,
    fontSize: 20,
    lineHeight: 24,
    textTransform: 'uppercase',
  },
  finalModalSubtitle: {
    marginTop: 10,
    color: AUTH.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  finalModalBody: {
    paddingHorizontal: 20,
    gap: 6,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: '#101010',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  themeButtonText: {
    color: WHITE,
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
  },
  themeHint: {
    marginTop: 8,
    color: MUTED,
    fontFamily: FontFamily.mono,
    fontSize: 10,
    lineHeight: 14,
  },
  avatarWrap: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarInitials: {
    color: LABEL,
    fontFamily: FontFamily.sansBold,
    fontSize: 34,
    letterSpacing: 1,
  },
  photoLink: {
    marginTop: 14,
    color: CYAN,
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
  },
  photoHelp: {
    marginTop: 8,
    color: MUTED,
    fontFamily: FontFamily.mono,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  finalModalFooter: {
    paddingHorizontal: 20,
    paddingTop: 6,
    backgroundColor: BG,
  },
  skipLink: {
    marginTop: 14,
    color: MUTED,
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    textAlign: 'center',
  },
});