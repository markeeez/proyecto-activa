/**
 * Onboarding paso 2: objetivo nutricional, macros y guardado en Supabase.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { router, useLocalSearchParams } from 'expo-router';
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

import type { Theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { fechaHoyIsoLocal } from '@/lib/fechaNutricion';
import { supabase } from '@/lib/supabase';
import type { Objetivo } from '@/types/database.types';
import type { GeneroOnboarding } from './datos';

type ObjetivoUi = 'perder' | 'mantener' | 'ganar';

type MacroPerfil = 'alta_proteina' | 'equilibrado' | 'alta_carbos';

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

function makeStyles(c: Theme, f: ReturnType<typeof useTheme>['f'], ts: ReturnType<typeof useTheme>['ts'], s: ReturnType<typeof useTheme>['s'], r: ReturnType<typeof useTheme>['r']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: s.md,
      paddingBottom: s.sm,
    },
    headerSide: { width: 44, alignItems: 'flex-start', justifyContent: 'center' },
    pasoTxt: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
    },
    scroll: { flexGrow: 1, paddingHorizontal: s.md },
    label: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginBottom: s.sm,
      marginTop: s.md,
      letterSpacing: 0.6,
    },
    labelFirst: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginBottom: s.sm,
      marginTop: s.lg,
      letterSpacing: 0.6,
    },
    segmentRow: {
      flexDirection: 'row',
      gap: s.xs,
      marginBottom: s.sm,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    segmentBtn: {
      paddingVertical: s.sm,
      paddingHorizontal: s.sm,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
    },
    segmentBtnOn: { borderColor: c.primary, backgroundColor: c.primaryBg },
    segmentTxt: {
      ...ts.caption,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
    },
    segmentTxtOn: { color: c.primary },
    macroPerfilRow: { flexDirection: 'row', gap: s.xs, marginBottom: s.md },
    macroPerfilBtn: {
      flex: 1,
      paddingVertical: s.sm,
      paddingHorizontal: s.xs,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    macroPerfilBtnOn: { borderColor: c.primary, backgroundColor: c.primaryBg },
    macroPerfilTxt: {
      ...ts.caption,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
      textAlign: 'center',
    },
    macroPerfilTxtOn: { color: c.primary },
    input: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.sm,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
      backgroundColor: c.surface,
    },
    errorPesoObjetivo: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.danger,
      marginTop: s.xs,
    },
    kcalBlock: { marginVertical: s.lg, alignItems: 'center' },
    kcalValor: {
      ...ts.displayLg,
      fontFamily: f.mono,
      color: c.primary,
    },
    kcalHint: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textMuted,
      marginTop: s.xs,
    },
    macroCardsRow: { flexDirection: 'row', gap: s.xs, marginBottom: s.md },
    macroCard: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.sm,
      paddingVertical: s.sm,
      paddingHorizontal: s.xs,
      backgroundColor: c.surface,
      alignItems: 'center',
    },
    macroCardLabel: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.6,
      textAlign: 'center',
    },
    macroCardGrams: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      marginTop: s.xs,
    },
    macroCardMeta: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    linkPlan: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.primary,
      textDecorationLine: 'underline',
    },
    planLinksBlock: {
      alignItems: 'center',
      marginBottom: s.md,
    },
    planLinksColumn: {
      gap: s.xs,
    },
    planLinksSeparator: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    velocidadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.md,
      marginBottom: s.sm,
    },
    velocidadValor: {
      ...ts.heading,
      fontFamily: f.mono,
      color: c.textDisplay,
      minWidth: 56,
      textAlign: 'center',
    },
    stepBtn: {
      width: 44,
      height: 44,
      borderRadius: r.technical,
      borderWidth: 1,
      borderColor: c.borderVisible,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    stepBtnTxt: {
      ...ts.subheading,
      fontFamily: f.monoBold,
      color: c.textDisplay,
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingHorizontal: s.md,
      paddingTop: s.sm,
      backgroundColor: c.background,
    },
    btnPrimary: {
      paddingVertical: s.md,
      borderRadius: r.sm,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.primary,
    },
    btnDis: { opacity: 0.45 },
    btnTxt: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textOnPrimary,
      letterSpacing: 0.3,
    },
    btnGhost: {
      paddingVertical: s.md,
      borderRadius: r.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: 'transparent',
      marginTop: s.sm,
    },
    btnGhostTxt: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      letterSpacing: 0.3,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: c.surfaceElevated,
      borderTopLeftRadius: r.lg,
      borderTopRightRadius: r.lg,
      borderTopWidth: 1,
      borderColor: c.borderVisible,
      paddingHorizontal: s.md,
      paddingTop: s.md,
      maxHeight: '85%',
    },
    modalTitulo: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      marginBottom: s.sm,
    },
    modalDesc: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textSecondary,
      marginBottom: s.md,
    },
    modalLabel: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginBottom: s.xs,
      letterSpacing: 0.6,
    },
    modalKcalLive: {
      ...ts.body,
      fontFamily: f.mono,
      color: c.primary,
      marginTop: s.md,
      marginBottom: s.md,
    },
    modalActions: { gap: s.sm, marginBottom: s.md },
    finalModalRoot: {
      flex: 1,
      backgroundColor: c.background,
    },
    finalModalScroll: { flexGrow: 1, paddingBottom: s.md },
    finalModalHeader: {
      paddingTop: s.xl,
      paddingHorizontal: s.lg,
      paddingBottom: s.lg,
      marginBottom: s.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    finalModalTitulo: {
      ...ts.heading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      marginBottom: s.xs,
    },
    finalModalSubtitulo: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textSecondary,
      marginTop: s.xs,
    },
    finalModalBody: {
      paddingHorizontal: s.lg,
    },
    avatarWrap: { alignItems: 'center', marginBottom: s.lg, marginTop: s.sm },
    avatarCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: c.surfaceElevated,
      borderWidth: 1,
      borderColor: c.borderVisible,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: { width: 120, height: 120, borderRadius: 60 },
    avatarIniciales: {
      ...ts.displayMd,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
    },
    linkAnadirFoto: {
      ...ts.body,
      fontFamily: f.sansMedium,
      color: c.primary,
      textDecorationLine: 'underline',
      marginTop: s.md,
    },
    fotoAyuda: {
      ...ts.bodySm,
      fontFamily: f.mono,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: s.sm,
    },
    notifRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: s.sm,
      marginTop: s.xs,
    },
    notifRowLabel: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
      flex: 1,
      paddingRight: s.md,
    },
    notifDesc: {
      ...ts.bodySm,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginBottom: s.xl,
    },
    finalModalFooter: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingHorizontal: s.md,
      paddingTop: s.sm,
      backgroundColor: c.background,
    },
    saltarLink: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: s.md,
    },
  });
}

const PERFILES: { id: MacroPerfil; label: string }[] = [
  { id: 'alta_proteina', label: 'Alta proteína' },
  { id: 'equilibrado', label: 'Equilibrado' },
  { id: 'alta_carbos', label: 'Alta en carbos' },
];

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
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

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
  const [modalPlanOpen, setModalPlanOpen] = useState(false);
  const [modalProt, setModalProt] = useState('');
  const [modalCarb, setModalCarb] = useState('');
  const [modalFat, setModalFat] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [modalFinalVisible, setModalFinalVisible] = useState(false);
  const [avatarPicked, setAvatarPicked] = useState<{ uri: string; mimeType: string } | null>(null);
  const [finalizando, setFinalizando] = useState(false);

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
  };

  const irANutricion = async () => {
    await Notifications.requestPermissionsAsync();
    router.replace('/(tabs)/(nutricion)');
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
      <View style={[styles.root, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={c.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Volver">
              <Ionicons name="chevron-back" size={26} color={c.textDisplay} />
            </Pressable>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={styles.pasoTxt}>Paso 2 de 2</Text>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.labelFirst}>OBJETIVO</Text>
          <View style={styles.segmentRow}>
            {(
              [
                ['perder', 'Perder grasa'],
                ['mantener', 'Mantener'],
                ['ganar', 'Ganar masa'],
              ] as const
            ).map(([val, label]) => (
              <Pressable
                key={val}
                style={[styles.segmentBtn, objetivoUi === val && styles.segmentBtnOn]}
                onPress={() => setObjetivoUi(val)}
              >
                <Text style={[styles.segmentTxt, objetivoUi === val && styles.segmentTxtOn]} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {objetivoUi !== 'mantener' ? (
            <>
              <Text style={styles.label}>PESO OBJETIVO</Text>
              <TextInput
                style={styles.input}
                value={pesoObjetivo}
                onChangeText={setPesoObjetivo}
                placeholder="kg"
                placeholderTextColor={c.textMuted}
                keyboardType="decimal-pad"
              />
              {errorPesoObjetivo ? <Text style={styles.errorPesoObjetivo}>{errorPesoObjetivo}</Text> : null}
            </>
          ) : null}

          {objetivoUi !== 'mantener' ? (
            <>
              <Text style={styles.label}>VELOCIDAD (kg/semana)</Text>
              <View style={styles.velocidadRow}>
                <Pressable style={styles.stepBtn} onPress={() => bumpVelocidad(-1)}>
                  <Text style={styles.stepBtnTxt}>−</Text>
                </Pressable>
                <Text style={styles.velocidadValor}>{velocidad.toFixed(1)}</Text>
                <Pressable style={styles.stepBtn} onPress={() => bumpVelocidad(1)}>
                  <Text style={styles.stepBtnTxt}>+</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          <View style={styles.kcalBlock}>
            <Text style={styles.label} pointerEvents="none">
              KCAL CALCULADAS
            </Text>
            <Text style={styles.kcalValor}>{kcalMostrar}</Text>
            <Text style={styles.kcalHint}>kcal / día objetivo</Text>
          </View>

          <Text style={styles.label}>MACROS</Text>
          <View style={styles.macroPerfilRow}>
            {PERFILES.map(({ id, label }) => (
              <Pressable
                key={id}
                style={[styles.macroPerfilBtn, macroPerfil === id && styles.macroPerfilBtnOn]}
                onPress={() => seleccionarPerfil(id)}
              >
                <Text style={[styles.macroPerfilTxt, macroPerfil === id && styles.macroPerfilTxtOn]} numberOfLines={2}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.macroCardsRow}>
            <View style={styles.macroCard}>
              <Text style={styles.macroCardLabel}>PROTEÍNAS</Text>
              <Text style={styles.macroCardGrams}>{gramos.p}g</Text>
              <Text style={styles.macroCardMeta}>{pctMacros.prot}%</Text>
              <Text style={styles.macroCardMeta}>{gramos.p * 4} kcal</Text>
            </View>
            <View style={styles.macroCard}>
              <Text style={styles.macroCardLabel}>CARBOS</Text>
              <Text style={styles.macroCardGrams}>{gramos.c}g</Text>
              <Text style={styles.macroCardMeta}>{pctMacros.carb}%</Text>
              <Text style={styles.macroCardMeta}>{gramos.c * 4} kcal</Text>
            </View>
            <View style={styles.macroCard}>
              <Text style={styles.macroCardLabel}>GRASAS</Text>
              <Text style={styles.macroCardGrams}>{gramos.f}g</Text>
              <Text style={styles.macroCardMeta}>{pctMacros.gras}%</Text>
              <Text style={styles.macroCardMeta}>{gramos.f * 9} kcal</Text>
            </View>
          </View>

          <View style={[styles.planLinksBlock, macroPerfil === null ? styles.planLinksColumn : null]}>
            {macroPerfil !== null ? (
              <Pressable onPress={abrirModalPlan}>
                <Text style={styles.linkPlan}>Personalizar plan</Text>
              </Pressable>
            ) : (
              <>
                <Pressable onPress={restablecerPlan}>
                  <Text style={styles.linkPlan}>Restablecer plan</Text>
                </Pressable>
                <Text style={styles.planLinksSeparator}>o</Text>
                <Pressable onPress={abrirModalPlan}>
                  <Text style={styles.linkPlan}>Personalizar plan</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + s.md }]}>
          <Pressable
            style={[styles.btnPrimary, (!formGuardarOk || guardando) && styles.btnDis]}
            onPress={() => void onGuardar()}
            disabled={!formGuardarOk || guardando}
          >
            {guardando ? (
              <ActivityIndicator color={c.textOnPrimary} />
            ) : (
              <Text style={styles.btnTxt}>GUARDAR Y EMPEZAR</Text>
            )}
          </Pressable>
        </View>
      </View>

      <Modal visible={modalPlanOpen} transparent animationType="slide" onRequestClose={() => setModalPlanOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModalPlanOpen(false)}>
          <Pressable
            style={[styles.modalCard, { paddingBottom: insets.bottom + s.md }]}
            onPress={(e) => e.stopPropagation()}
          >
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <Text style={styles.modalTitulo}>Personalizar plan</Text>
              <Text style={styles.modalDesc}>
                Introduce los gramos diarios que quieres consumir. Las calorías se calcularán automáticamente.
              </Text>

              <Text style={styles.modalLabel}>PROTEÍNAS (G)</Text>
              <TextInput
                style={[styles.input, { marginBottom: s.md }]}
                value={modalProt}
                onChangeText={setModalProt}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={c.textMuted}
              />

              <Text style={styles.modalLabel}>CARBOS (G)</Text>
              <TextInput
                style={[styles.input, { marginBottom: s.md }]}
                value={modalCarb}
                onChangeText={setModalCarb}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={c.textMuted}
              />

              <Text style={styles.modalLabel}>GRASAS (G)</Text>
              <TextInput
                style={[styles.input, { marginBottom: s.sm }]}
                value={modalFat}
                onChangeText={setModalFat}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={c.textMuted}
              />

              <Text style={styles.modalKcalLive}>{kcalModalPreview} kcal</Text>

              <View style={styles.modalActions}>
                <Pressable style={styles.btnPrimary} onPress={aplicarPlanPersonalizado}>
                  <Text style={styles.btnTxt}>APLICAR</Text>
                </Pressable>
                <Pressable style={styles.btnGhost} onPress={() => setModalPlanOpen(false)}>
                  <Text style={styles.btnGhostTxt}>Cancelar</Text>
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
        <View style={[styles.finalModalRoot, { paddingTop: insets.top }]}>
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.finalModalScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.finalModalHeader}>
              <Text style={styles.finalModalTitulo}>Un último paso</Text>
              <Text style={styles.finalModalSubtitulo}>
                Estos ajustes son opcionales, puedes cambiarlos después en tu perfil
              </Text>
            </View>

            <View style={styles.finalModalBody}>
              <Text style={[styles.label, { marginTop: 0 }]}>FOTO DE PERFIL</Text>
              <View style={styles.avatarWrap}>
                <View style={styles.avatarCircle}>
                  {avatarPicked ? (
                    <Image source={{ uri: avatarPicked.uri }} style={styles.avatarImage} contentFit="cover" />
                  ) : (
                    <Text style={styles.avatarIniciales}>{inicialesUsuario(user)}</Text>
                  )}
                </View>
                <Pressable onPress={() => void anadirFoto()}>
                  <Text style={styles.linkAnadirFoto}>{avatarPicked ? 'Cambiar foto' : 'Añadir foto'}</Text>
                </Pressable>
                {!avatarPicked ? (
                  <Text style={styles.fotoAyuda}>Encuadra la foto y pulsa CORTAR para confirmar</Text>
                ) : null}
              </View>
            </View>
          </ScrollView>

          <View style={[styles.finalModalFooter, { paddingBottom: insets.bottom + s.md }]}>
            <Pressable
              style={[styles.btnPrimary, finalizando && styles.btnDis]}
              onPress={() => void empezarFinal()}
              disabled={finalizando}
            >
              {finalizando ? (
                <ActivityIndicator color={c.textOnPrimary} />
              ) : (
                <Text style={styles.btnTxt}>EMPEZAR</Text>
              )}
            </Pressable>
            <Pressable onPress={saltarFinal} disabled={finalizando}>
              <Text style={styles.saltarLink}>Saltar por ahora</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}