import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LogoLightSb from '@/assets/images/logos/logo_light_sb.svg';
import LogoDarkSb from '@/assets/images/logos/logo_sb.svg';
import type { Theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { progresoService, type ContextoPlanNutricion } from '@/services/progreso.service';
import type { Objetivo } from '@/types/database.types';

type ObjetivoUi = 'perder' | 'mantener' | 'ganar';
type MacroPerfil = 'alta_proteina' | 'equilibrado' | 'alta_carbos';
type GeneroPlan = 'hombre' | 'mujer';

const ACTIVIDAD_OPCIONES = [
  { key: 'sedentario', label: 'Poco o ningun ejercicio', factor: 1.2 },
  { key: 'ligero', label: 'Ejercicio ligero 1-3 dias/semana', factor: 1.375 },
  { key: 'moderado', label: 'Ejercicio moderado 3-5 dias/semana', factor: 1.55 },
  { key: 'activo', label: 'Ejercicio intenso 6-7 dias/semana', factor: 1.725 },
  { key: 'muy_activo', label: 'Entrenamiento muy intenso o trabajo fisico', factor: 1.9 },
] as const;

const OBJETIVOS: {
  id: ObjetivoUi;
  label: string;
  icon: 'fire' | 'account-outline' | 'arm-flex-outline';
}[] = [
  { id: 'perder', label: 'Perder\ngrasa', icon: 'fire' },
  { id: 'mantener', label: 'Mantenerse', icon: 'account-outline' },
  { id: 'ganar', label: 'Ganar\nmusculo', icon: 'arm-flex-outline' },
];

const PERFILES: {
  id: MacroPerfil;
  label: string;
  icon: 'leaf' | 'scale-balance' | 'barley';
}[] = [
  { id: 'alta_proteina', label: 'Alta en\nproteina', icon: 'leaf' },
  { id: 'equilibrado', label: 'Equilibrado', icon: 'scale-balance' },
  { id: 'alta_carbos', label: 'Alta en\ncarbohidratos', icon: 'barley' },
];

function indiceDesdeFactor(f: number | null | undefined): number {
  if (f == null || !Number.isFinite(f)) return 2;
  let best = 0;
  let bestDiff = Infinity;
  ACTIVIDAD_OPCIONES.forEach((op, i) => {
    const d = Math.abs(op.factor - f);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  });
  return best;
}

function macrosDesdePerfil(perfil: MacroPerfil, pesoKg: number, kcalObjetivo: number): { p: number; c: number; f: number } {
  let proteinasG: number;
  let grasasG: number;
  switch (perfil) {
    case 'alta_proteina':
      proteinasG = pesoKg * 2.2;
      grasasG = pesoKg * 0.8;
      break;
    case 'equilibrado':
      proteinasG = pesoKg * 2;
      grasasG = pesoKg * 1;
      break;
    case 'alta_carbos':
      proteinasG = pesoKg * 1.8;
      grasasG = pesoKg * 0.8;
      break;
  }
  return {
    p: Math.round(proteinasG),
    c: Math.round(Math.max(0, (kcalObjetivo - proteinasG * 4 - grasasG * 9) / 4)),
    f: Math.round(grasasG),
  };
}

function objetivoDbDesdeUi(ui: ObjetivoUi): Objetivo {
  if (ui === 'perder') return 'perder_peso';
  if (ui === 'ganar') return 'ganar_masa';
  return 'mantener';
}

function uiDesdeObjetivoDb(o: string): ObjetivoUi {
  if (o === 'ganar_masa') return 'ganar';
  if (o === 'mantener') return 'mantener';
  return 'perder';
}

function fmtDecimal(value: number, decimals = 1): string {
  const t = value.toFixed(decimals);
  return t.endsWith('.0') ? String(Math.round(value)) : t.replace('.', ',');
}

function parseDecimal(raw: string): number {
  return parseFloat(raw.trim().replace(',', '.'));
}

function sanitizeKgInput(raw: string): string {
  let value = '';
  let hasSeparator = false;

  for (const char of raw) {
    if (char >= '0' && char <= '9') {
      value += char;
      continue;
    }

    if ((char === ',' || char === '.') && !hasSeparator) {
      value += char;
      hasSeparator = true;
    }
  }

  return value;
}

function calcularKcalObjetivo(
  genero: GeneroPlan,
  peso: number,
  altura: number,
  edad: number,
  factor: number,
  objetivoUi: ObjetivoUi,
  velocidadKgSem: number,
): number {
  const tmb = genero === 'hombre'
    ? 10 * peso + 6.25 * altura - 5 * edad + 5
    : 10 * peso + 6.25 * altura - 5 * edad - 161;
  const tdee = tmb * factor;
  if (objetivoUi === 'perder') return tdee - velocidadKgSem * 1100;
  if (objetivoUi === 'ganar') return tdee + velocidadKgSem * 500;
  return tdee;
}

function makeStyles(
  c: Theme,
  f: ReturnType<typeof useTheme>['f'],
  ts: ReturnType<typeof useTheme>['ts'],
  s: ReturnType<typeof useTheme>['s'],
  r: ReturnType<typeof useTheme>['r'],
) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: s.lg },
    header: {
      minHeight: 48,
      paddingHorizontal: s.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerButton: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      ...ts.subheading,
      flex: 1,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      textAlign: 'center',
    },
    logoButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: c.borderVisible,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    logo: { width: 21, height: 21 },
    scrollContent: {
      paddingHorizontal: s.md,
      paddingTop: s.xs,
      gap: s.sm,
    },
    card: {
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      padding: s.md,
      gap: s.sm,
    },
    compactCard: {
      paddingVertical: s.sm,
      gap: s.xs,
    },
    daysSelect: {
      minHeight: 42,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: s.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: s.sm,
    },
    daysSelectText: {
      ...ts.bodySm,
      flex: 1,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    title: {
      ...ts.bodySm,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    subtitle: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    objetivoTitle: {
      ...ts.bodySm,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      textAlign: 'center',
    },
    objetivosRow: { flexDirection: 'row', gap: s.sm },
    objetivoButton: {
      flex: 1,
      minHeight: 76,
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.xs,
      borderRadius: r.md,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
    },
    objetivoButtonOn: {
      borderColor: c.primary,
      backgroundColor: c.primaryBg,
    },
    objetivoIconRing: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    objetivoIconRingOn: { borderColor: c.primary },
    objetivoLabel: {
      ...ts.label,
      fontFamily: f.sansBold,
      color: c.textSecondary,
      textAlign: 'center',
    },
    objetivoLabelOn: { color: c.primary },
    targetRow: {
      minHeight: 50,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: c.background,
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
      paddingHorizontal: s.sm,
    },
    targetLabel: {
      ...ts.caption,
      flex: 1,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    targetInputWrap: {
      width: 116,
      height: 36,
      borderRadius: r.technical,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s.xs,
    },
    targetInput: {
      ...ts.bodySm,
      flex: 1,
      padding: 0,
      fontFamily: f.monoBold,
      color: c.textDisplay,
      textAlign: 'right',
    },
    kgText: {
      ...ts.caption,
      fontFamily: f.monoBold,
      color: c.textSecondary,
      marginLeft: s.xs,
    },
    errorText: {
      ...ts.caption,
      fontFamily: f.sansMedium,
      color: c.danger,
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: s.md,
    },
    valuePill: {
      minWidth: 74,
      minHeight: 40,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: s.sm,
      backgroundColor: c.background,
    },
    valuePillText: {
      ...ts.bodySm,
      fontFamily: f.monoBold,
      color: c.textDisplay,
      fontVariant: ['tabular-nums'],
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
    },
    stepButton: {
      width: 38,
      height: 38,
      borderRadius: r.technical,
      borderWidth: 1,
      borderColor: c.borderVisible,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    fakeTrack: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.borderVisible,
      overflow: 'hidden',
    },
    fakeTrackFill: {
      height: 4,
      borderRadius: 2,
      backgroundColor: c.primary,
    },
    sliderWrap: {
      flex: 1,
      minWidth: 0,
      height: 22,
      justifyContent: 'center',
    },
    sliderDisabled: {
      opacity: 0.5,
    },
    sliderLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
    },
    sliderLimit: {
      ...ts.label,
      minWidth: 42,
      fontFamily: f.mono,
      color: c.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    sliderTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: c.borderVisible,
      overflow: 'visible',
    },
    sliderFill: {
      height: 4,
      borderRadius: 2,
      backgroundColor: c.primary,
    },
    sliderThumb: {
      position: 'absolute',
      top: -6,
      width: 16,
      height: 16,
      marginLeft: -8,
      borderRadius: 8,
      backgroundColor: c.primary,
      borderWidth: 2,
      borderColor: c.surface,
    },
    sliderValue: {
      ...ts.caption,
      fontFamily: f.monoBold,
      color: c.textDisplay,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
      marginTop: -4,
    },
    scaleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: s.sm,
    },
    planMenuButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.background,
    },
    kcalRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: s.md,
    },
    kcalValueWrap: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: s.xs,
      flexShrink: 0,
    },
    kcalText: {
      ...ts.heading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      fontVariant: ['tabular-nums'],
    },
    kcalUnit: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    badge: {
      borderRadius: r.technical,
      borderWidth: 1,
      borderColor: c.borderVisible,
      paddingHorizontal: s.sm,
      paddingVertical: s.xs,
      backgroundColor: c.background,
    },
    badgeText: {
      ...ts.label,
      fontFamily: f.monoBold,
      color: c.successText,
    },
    macroRow: { flexDirection: 'row', gap: s.sm },
    macroItem: { flex: 1, gap: s.xs },
    macroLabel: {
      ...ts.caption,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
    },
    macroValue: {
      ...ts.caption,
      fontFamily: f.monoBold,
      color: c.textDisplay,
      fontVariant: ['tabular-nums'],
    },
    macroTrack: {
      height: 3,
      borderRadius: 2,
      backgroundColor: c.borderVisible,
      overflow: 'hidden',
    },
    macroFill: {
      height: 3,
      borderRadius: 2,
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border },
    perfilRow: { flexDirection: 'row', gap: s.sm },
    perfilButton: {
      flex: 1,
      minHeight: 52,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.xs,
      paddingHorizontal: s.xs,
    },
    perfilButtonOn: {
      borderColor: c.primary,
      backgroundColor: c.primaryBg,
    },
    perfilText: {
      ...ts.label,
      fontFamily: f.sansBold,
      color: c.textSecondary,
      textAlign: 'center',
    },
    perfilTextOn: { color: c.primary },
    actionRow: { flexDirection: 'row', gap: s.sm },
    actionButton: {
      flex: 1,
      minHeight: 58,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      padding: s.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
    },
    actionTitle: {
      ...ts.caption,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    actionSub: {
      ...ts.label,
      fontFamily: f.sans,
      color: c.textSecondary,
      marginTop: 2,
    },
    footer: {
      paddingHorizontal: s.md,
      paddingTop: s.xs,
      gap: s.xs,
      backgroundColor: c.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    primaryButton: {
      minHeight: 46,
      borderRadius: r.sm,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonDisabled: { opacity: 0.45 },
    primaryText: {
      ...ts.bodySm,
      fontFamily: f.sansBold,
      color: c.textOnPrimary,
    },
    planMenuLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 40,
    },
    planMenuDismiss: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
    },
    planMenuPopover: {
      position: 'absolute',
      width: 184,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      backgroundColor: c.surfaceElevated,
      paddingVertical: s.xs,
      paddingHorizontal: s.sm,
      zIndex: 30,
    },
    planMenuTitle: {
      fontSize: 12,
      lineHeight: 15,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      paddingHorizontal: s.xs,
      paddingVertical: s.xs,
    },
    planMenuOption: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.xs,
      borderRadius: r.sm,
      paddingHorizontal: s.xs,
    },
    planMenuOptionText: {
      fontSize: 12,
      lineHeight: 15,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    planMenuDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.borderVisible,
      marginVertical: 2,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      borderTopLeftRadius: r.lg,
      borderTopRightRadius: r.lg,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      padding: s.md,
      gap: s.sm,
    },
    modalCenteredBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.68)',
      justifyContent: 'center',
      padding: s.lg,
    },
    modalCenteredCard: {
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.borderVisible,
      paddingHorizontal: s.md,
      paddingTop: s.lg,
      paddingBottom: s.md,
      overflow: 'hidden',
    },
    modalAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: c.primary,
    },
    modalTitle: {
      ...ts.subheading,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      marginBottom: s.sm,
      letterSpacing: 0,
    },
    modalBody: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textSecondary,
      marginBottom: s.md,
      lineHeight: 24,
    },
    modalActionPrimary: {
      minHeight: 48,
      borderRadius: r.sm,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: s.md,
      backgroundColor: c.primary,
    },
    modalActionTextPrimary: {
      ...ts.body,
      color: c.textOnPrimary,
      fontFamily: f.sansBold,
      textAlign: 'center',
      letterSpacing: 0,
    },
    confirmSummary: {
      gap: s.sm,
      marginBottom: s.md,
    },
    confirmLayer: {
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.background,
      padding: s.md,
      gap: s.xs,
    },
    confirmLayerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
    },
    confirmLabel: {
      ...ts.caption,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
    },
    confirmValue: {
      ...ts.body,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      fontVariant: ['tabular-nums'],
    },
    confirmHeroValue: {
      ...ts.heading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      fontVariant: ['tabular-nums'],
    },
    confirmMeta: {
      ...ts.caption,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
    },
    modalActionRow: {
      flexDirection: 'row',
      gap: s.sm,
    },
    modalActionSecondary: {
      minHeight: 48,
      flex: 1,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: s.md,
    },
    modalActionPrimaryFlex: {
      flex: 1,
    },
    modalActionText: {
      ...ts.body,
      fontFamily: f.sansMedium,
      color: c.primary,
      textAlign: 'center',
      letterSpacing: 0,
    },
    modalOption: {
      minHeight: 54,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      justifyContent: 'center',
    },
    modalOptionTitle: {
      ...ts.bodySm,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    modalOptionDesc: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    modalInput: {
      ...ts.body,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surfaceElevated,
      color: c.textDisplay,
      fontFamily: f.sans,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
    },
  });
}

export default function PersonalizarPlanPantalla() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { user } = useAuth();
  const { c, f, ts, s, r, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);
  const Logo = isDark ? LogoDarkSb : LogoLightSb;

  const [cargando, setCargando] = useState(true);
  const [ctx, setCtx] = useState<ContextoPlanNutricion | null>(null);
  const [actividadIdx, setActividadIdx] = useState(2);
  const [menuDiasOpen, setMenuDiasOpen] = useState(false);
  const [menuDiasAnchor, setMenuDiasAnchor] = useState({ x: 0, y: 0 });
  const [objetivoUi, setObjetivoUi] = useState<ObjetivoUi>('mantener');
  const [pesoObjetivo, setPesoObjetivo] = useState('');
  const [velocidad, setVelocidad] = useState(0.5);
  const [macroPerfil, setMacroPerfil] = useState<MacroPerfil | null>('equilibrado');
  const [gramosPersonalizado, setGramosPersonalizado] = useState<{ p: number; c: number; f: number } | null>(null);
  const [modalPlanOpen, setModalPlanOpen] = useState(false);
  const [menuPlanOpen, setMenuPlanOpen] = useState(false);
  const [menuPlanAnchor, setMenuPlanAnchor] = useState({ x: 0, y: 0 });
  const [modalProt, setModalProt] = useState('');
  const [modalCarb, setModalCarb] = useState('');
  const [modalFat, setModalFat] = useState('');
  const [modalConfirmarGuardar, setModalConfirmarGuardar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [sliderWidth, setSliderWidth] = useState(1);
  const sliderStartRatio = useRef(0);

  const factorSel = ACTIVIDAD_OPCIONES[actividadIdx]?.factor ?? 1.55;
  const actividadSel = ACTIVIDAD_OPCIONES[actividadIdx] ?? ACTIVIDAD_OPCIONES[3];

  const load = useCallback(async () => {
    if (!user?.id) return;
    setCargando(true);
    try {
      const [plan, nut] = await Promise.all([
        progresoService.obtenerPlanActual(user.id),
        progresoService.obtenerContextoPlanNutricion(user.id),
      ]);
      setCtx(nut);
      setActividadIdx(indiceDesdeFactor(nut.factorActividad));

      if (plan) {
        setObjetivoUi(uiDesdeObjetivoDb(plan.objetivo));
        setPesoObjetivo(plan.peso_objetivo != null ? fmtDecimal(plan.peso_objetivo) : '');
        setGramosPersonalizado({
          p: plan.proteinas_objetivo,
          c: plan.carbos_objetivo,
          f: plan.grasas_objetivo,
        });
        setMacroPerfil(null);
      } else {
        setPesoObjetivo('');
        setMacroPerfil('equilibrado');
        setGramosPersonalizado(null);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudieron cargar los datos del plan.');
    } finally {
      setCargando(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const tdeeReady = useMemo(() => {
    if (!ctx) return false;
    return Boolean(ctx.genero && ctx.edad && ctx.edad > 0 && ctx.alturaCm && ctx.alturaCm > 0 && ctx.pesoKg && ctx.pesoKg > 0);
  }, [ctx]);

  const kcalTdee = useMemo(() => {
    if (!tdeeReady || !ctx?.genero || ctx.edad == null || ctx.alturaCm == null || ctx.pesoKg == null) return 0;
    return calcularKcalObjetivo(
      ctx.genero,
      ctx.pesoKg,
      ctx.alturaCm,
      ctx.edad,
      factorSel,
      objetivoUi,
      objetivoUi === 'mantener' ? 0 : velocidad,
    );
  }, [ctx, factorSel, objetivoUi, tdeeReady, velocidad]);

  const kcalTdeeRedondeada = Math.max(0, Math.round(kcalTdee));
  const pesoActual = ctx?.pesoKg != null && ctx.pesoKg > 0 ? ctx.pesoKg : null;
  const pesoParaMacros = pesoActual ?? 0;

  const kcalMostrar = useMemo(() => {
    if (macroPerfil !== null) return kcalTdeeRedondeada;
    if (!gramosPersonalizado) return kcalTdeeRedondeada;
    return Math.round(gramosPersonalizado.p * 4 + gramosPersonalizado.c * 4 + gramosPersonalizado.f * 9);
  }, [gramosPersonalizado, kcalTdeeRedondeada, macroPerfil]);

  const gramos = useMemo(() => {
    if (pesoParaMacros <= 0) return { p: 0, c: 0, f: 0 };
    if (macroPerfil !== null) return macrosDesdePerfil(macroPerfil, pesoParaMacros, kcalMostrar);
    return gramosPersonalizado ?? { p: 0, c: 0, f: 0 };
  }, [gramosPersonalizado, kcalMostrar, macroPerfil, pesoParaMacros]);

  const pctMacros = useMemo(() => {
    if (kcalMostrar <= 0) return { prot: 0, carb: 0, gras: 0 };
    const prot = Math.round(((gramos.p * 4) / kcalMostrar) * 100);
    const carb = Math.round(((gramos.c * 4) / kcalMostrar) * 100);
    return { prot, carb, gras: Math.max(0, 100 - prot - carb) };
  }, [gramos, kcalMostrar]);

  const pesoObjetivoError = useMemo(() => {
    if (objetivoUi === 'mantener') return null;
    const raw = pesoObjetivo.trim();
    if (!raw) return null;
    const parsed = parseDecimal(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return 'Introduce un peso objetivo valido.';
    if (pesoActual == null) return null;
    if (objetivoUi === 'perder' && parsed >= pesoActual) {
      return `Debe ser menor que tu peso actual (${fmtDecimal(pesoActual)} kg).`;
    }
    if (objetivoUi === 'ganar' && parsed <= pesoActual) {
      return `Debe ser mayor que tu peso actual (${fmtDecimal(pesoActual)} kg).`;
    }
    return null;
  }, [objetivoUi, pesoActual, pesoObjetivo]);

  const formGuardarOk = useMemo(() => {
    if (kcalMostrar <= 0 || gramos.p < 0 || gramos.c < 0 || gramos.f < 0) return false;
    if (objetivoUi === 'mantener') return true;
    const parsed = parseDecimal(pesoObjetivo);
    return Number.isFinite(parsed) && parsed > 0 && !pesoObjetivoError;
  }, [gramos, kcalMostrar, objetivoUi, pesoObjetivo, pesoObjetivoError]);

  const balanceLabel = useMemo(() => {
    if (objetivoUi === 'mantener') return 'Mantenimiento';
    if (objetivoUi === 'perder') return velocidad > 0.6 ? 'Deficit agresivo' : 'Deficit moderado';
    return velocidad > 0.6 ? 'Superavit agresivo' : 'Superavit controlado';
  }, [objetivoUi, velocidad]);

  const sliderCopy = useMemo(() => {
    if (objetivoUi === 'ganar') {
      const surplus = Math.round(velocidad * 500);
      return {
        title: 'Superavit para ganar musculo',
        min: '+50 kcal',
        max: '+500 kcal',
        value: `+${surplus} kcal/dia`,
      };
    }

    return {
      title: 'Velocidad del objetivo',
      min: '0,1 kg',
      max: '1 kg',
      value: `${velocidad.toFixed(1).replace('.', ',')} kg/semana`,
    };
  }, [objetivoUi, velocidad]);

  const objetivoResumen = useMemo(() => {
    if (objetivoUi === 'perder') return 'Perder grasa';
    if (objetivoUi === 'ganar') return 'Ganar musculo';
    return 'Mantenerse';
  }, [objetivoUi]);

  const ritmoResumen = useMemo(() => {
    if (objetivoUi === 'mantener') return 'Mantenimiento';
    return sliderCopy.value;
  }, [objetivoUi, sliderCopy.value]);

  const kcalModalPreview = useMemo(() => {
    const p = parseDecimal(modalProt);
    const carb = parseDecimal(modalCarb);
    const fat = parseDecimal(modalFat);
    if (!Number.isFinite(p) || !Number.isFinite(carb) || !Number.isFinite(fat)) return 0;
    return Math.round(p * 4 + carb * 4 + fat * 9);
  }, [modalCarb, modalFat, modalProt]);

  const updateVelocidadFromRatio = useCallback((ratioRaw: number) => {
    if (objetivoUi === 'mantener') return;
    const ratio = Math.max(0, Math.min(1, ratioRaw));
    const next = Math.round((0.1 + ratio * 0.9) * 100) / 100;
    setVelocidad(next);
  }, [objetivoUi]);

  const sliderResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => objetivoUi !== 'mantener',
      onMoveShouldSetPanResponder: () => objetivoUi !== 'mantener',
      onPanResponderGrant: (event) => {
        const ratio = event.nativeEvent.locationX / Math.max(sliderWidth, 1);
        sliderStartRatio.current = Math.max(0, Math.min(1, ratio));
        updateVelocidadFromRatio(sliderStartRatio.current);
      },
      onPanResponderMove: (_, gestureState) => {
        updateVelocidadFromRatio(sliderStartRatio.current + gestureState.dx / Math.max(sliderWidth, 1));
      },
    }),
    [objetivoUi, sliderWidth, updateVelocidadFromRatio],
  );

  const abrirModalPlan = () => {
    setModalProt(String(gramos.p));
    setModalCarb(String(gramos.c));
    setModalFat(String(gramos.f));
    setModalPlanOpen(true);
  };

  const aplicarPlanPersonalizado = () => {
    const p = parseDecimal(modalProt);
    const carb = parseDecimal(modalCarb);
    const fat = parseDecimal(modalFat);
    if (!Number.isFinite(p) || !Number.isFinite(carb) || !Number.isFinite(fat) || p < 0 || carb < 0 || fat < 0) {
      Alert.alert('Valores no validos', 'Introduce gramos validos para cada macro.');
      return;
    }
    setGramosPersonalizado({ p: Math.round(p), c: Math.round(carb), f: Math.round(fat) });
    setMacroPerfil(null);
    setModalPlanOpen(false);
  };

  const abrirCrearConV = () => {
    setMenuPlanOpen(false);
    Alert.alert('Crear con V', 'Esta opcion estara disponible pronto.');
  };

  const abrirPersonalizarDesdeMenu = () => {
    setMenuPlanOpen(false);
    abrirModalPlan();
  };

  const seleccionarObjetivo = (next: ObjetivoUi) => {
    setObjetivoUi(next);
    setMacroPerfil('equilibrado');
    setGramosPersonalizado(null);
  };

  const onGuardar = async () => {
    if (!user?.id || !formGuardarOk) return;
    setGuardando(true);
    try {
      const { error } = await supabase.from('user_goals').upsert(
        {
          user_id: user.id,
          objetivo: objetivoDbDesdeUi(objetivoUi),
          calorias_objetivo: kcalMostrar,
          proteinas_objetivo: gramos.p,
          carbos_objetivo: gramos.c,
          grasas_objetivo: gramos.f,
          peso_objetivo: objetivoUi !== 'mantener' ? parseDecimal(pesoObjetivo) : null,
        },
        { onConflict: 'user_id' },
      );
      if (error) {
        Alert.alert('Error', error.message ?? 'No se pudo guardar el plan.');
        return;
      }
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ factor_actividad: factorSel })
        .eq('id', user.id);
      if (profileError) {
        Alert.alert('Error', profileError.message ?? 'No se pudieron guardar los dias de entrenamiento.');
        return;
      }
      setModalConfirmarGuardar(false);
      router.replace('/(tabs)/(perfil)');
    } finally {
      setGuardando(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.subtitle}>Inicia sesion para ajustar tu plan.</Text>
      </View>
    );
  }

  if (cargando) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator color={c.primary} size="large" />
        </View>
      </View>
    );
  }

  const velocityPercent = objetivoUi === 'mantener'
    ? 0
    : Math.max(0, Math.min(100, ((velocidad - 0.1) / 0.9) * 100));

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={26} color={c.textDisplay} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Ajustar plan de kcal
          </Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollContent, { paddingBottom: s.md }]}
        >
          <View style={styles.card}>
            <Text style={styles.objetivoTitle}>¿Cual es tu objetivo?</Text>
            <View style={styles.objetivosRow}>
              {OBJETIVOS.map((item) => {
                const selected = objetivoUi === item.id;
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.objetivoButton, selected && styles.objetivoButtonOn]}
                    onPress={() => seleccionarObjetivo(item.id)}
                    accessibilityRole="button"
                  >
                    <View style={[styles.objetivoIconRing, selected && styles.objetivoIconRingOn]}>
                      <MaterialCommunityIcons name={item.icon} size={22} color={selected ? c.primary : c.textSecondary} />
                    </View>
                    <Text style={[styles.objetivoLabel, selected && styles.objetivoLabelOn]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {objetivoUi !== 'mantener' ? (
              <View style={styles.targetRow}>
                <Text style={styles.targetLabel}>
                  {objetivoUi === 'perder' ? '¿A cuantos kg quieres bajar?' : '¿A cuantos kg quieres llegar?'}
                </Text>
                <View style={styles.targetInputWrap}>
                  <TextInput
                    style={styles.targetInput}
                    value={pesoObjetivo}
                    onChangeText={(value) => setPesoObjetivo(sanitizeKgInput(value))}
                    keyboardType="decimal-pad"
                    placeholder={pesoActual != null ? fmtDecimal(pesoActual) : '0'}
                    placeholderTextColor={c.textMuted}
                  />
                  <Text style={styles.kgText}>kg</Text>
                </View>
              </View>
            ) : null}
            {pesoObjetivoError ? <Text style={styles.errorText}>{pesoObjetivoError}</Text> : null}
          </View>

          <Pressable
            style={styles.daysSelect}
            onPress={(event) => {
              setMenuDiasAnchor({
                x: event.nativeEvent.pageX,
                y: event.nativeEvent.pageY,
              });
              setMenuDiasOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Seleccionar dias de entrenamiento"
          >
            <Text style={styles.daysSelectText} numberOfLines={1}>{actividadSel.label}</Text>
            <Ionicons name="chevron-down" size={18} color={c.textSecondary} />
          </Pressable>

          {objetivoUi !== 'mantener' ? (
            <View style={[styles.card, styles.compactCard]}>
              <Text style={styles.title}>{sliderCopy.title}</Text>
              <View style={styles.sliderLine}>
                <Text style={styles.sliderLimit}>{sliderCopy.min}</Text>
                <View
                  style={styles.sliderWrap}
                  onLayout={(event) => setSliderWidth(event.nativeEvent.layout.width)}
                  {...sliderResponder.panHandlers}
                >
                  <View style={styles.sliderTrack}>
                    <View style={[styles.sliderFill, { width: `${velocityPercent}%` }]} />
                    <View style={[styles.sliderThumb, { left: `${velocityPercent}%` }]} />
                  </View>
                </View>
                <Text style={styles.sliderLimit}>{sliderCopy.max}</Text>
              </View>
              <Text style={styles.sliderValue}>{sliderCopy.value}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.title}>Tu plan diario recomendado</Text>
              <Pressable
                style={styles.planMenuButton}
                onPress={(event) => {
                  setMenuPlanAnchor({
                    x: event.nativeEvent.pageX,
                    y: event.nativeEvent.pageY,
                  });
                  setMenuPlanOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Abrir menu del plan"
              >
                <Ionicons name="ellipsis-vertical" size={21} color={c.textDisplay} />
              </Pressable>
            </View>
            {ctx?.genero == null || ctx.edad == null || ctx.alturaCm == null || pesoActual == null ? (
              <Text style={styles.errorText}>Completa genero, edad, altura y peso actual para un calculo mas preciso.</Text>
            ) : null}
            <View style={styles.kcalRow}>
              <View style={styles.kcalValueWrap}>
                <Text style={styles.kcalText}>{kcalMostrar > 0 ? kcalMostrar.toLocaleString('es-ES') : '--'}</Text>
                <Text style={styles.kcalUnit}>kcal</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{balanceLabel}</Text>
              </View>
            </View>

            <View style={styles.macroRow}>
              <MacroSummary styles={styles} c={c} label="Proteinas" grams={gramos.p} pct={pctMacros.prot} color={c.macroProtein} />
              <MacroSummary styles={styles} c={c} label="Carbohidratos" grams={gramos.c} pct={pctMacros.carb} color={c.macroCarbs} />
              <MacroSummary styles={styles} c={c} label="Grasas" grams={gramos.f} pct={pctMacros.gras} color={c.macroFat} />
            </View>

            <View style={styles.divider} />

            <View style={styles.sectionHeader}>
              <Text style={styles.title}>Ajuste de macros</Text>
            </View>
            <View style={styles.perfilRow}>
              {PERFILES.map((perfil) => {
                const selected = macroPerfil === perfil.id;
                return (
                  <Pressable
                    key={perfil.id}
                    style={[styles.perfilButton, selected && styles.perfilButtonOn]}
                    onPress={() => {
                      setMacroPerfil(perfil.id);
                      setGramosPersonalizado(null);
                    }}
                  >
                    <MaterialCommunityIcons name={perfil.icon} size={18} color={selected ? c.primary : c.textSecondary} />
                    <Text style={[styles.perfilText, selected && styles.perfilTextOn]}>{perfil.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

        </ScrollView>

        <View style={[styles.footer, { paddingBottom: s.md + 10 }]}>
          <Pressable
            style={[styles.primaryButton, (!formGuardarOk || guardando) && styles.primaryButtonDisabled]}
            onPress={() => setModalConfirmarGuardar(true)}
            disabled={!formGuardarOk || guardando}
            accessibilityRole="button"
          >
            {guardando ? <ActivityIndicator color={c.textOnPrimary} /> : <Text style={styles.primaryText}>Guardar</Text>}
          </Pressable>
        </View>

        {menuPlanOpen ? (
          <View style={styles.planMenuLayer} pointerEvents="box-none">
            <Pressable style={styles.planMenuDismiss} onPress={() => setMenuPlanOpen(false)} />
            <View
              style={[
                styles.planMenuPopover,
                {
                  top: Math.min(menuPlanAnchor.y + 10, windowHeight - 136),
                  left: Math.min(Math.max(menuPlanAnchor.x - 176, s.md), windowWidth - 198),
                },
              ]}
            >
              <Text style={styles.planMenuTitle} numberOfLines={1}>
                Plan diario
              </Text>
              <Pressable style={styles.planMenuOption} onPress={abrirCrearConV} accessibilityRole="button">
                <Logo width={17} height={17} />
                <Text style={styles.planMenuOptionText}>Crear con V</Text>
              </Pressable>
              <View style={styles.planMenuDivider} />
              <Pressable style={styles.planMenuOption} onPress={abrirPersonalizarDesdeMenu} accessibilityRole="button">
                <Ionicons name="options-outline" size={17} color={c.textDisplay} />
                <Text style={styles.planMenuOptionText}>Personalizar</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {menuDiasOpen ? (
          <View style={styles.planMenuLayer} pointerEvents="box-none">
            <Pressable style={styles.planMenuDismiss} onPress={() => setMenuDiasOpen(false)} />
            <View
              style={[
                styles.planMenuPopover,
                {
                  width: 254,
                  top: Math.min(menuDiasAnchor.y + 10, windowHeight - 224),
                  left: Math.min(Math.max(menuDiasAnchor.x - 127, s.md), windowWidth - 266),
                },
              ]}
            >
              {ACTIVIDAD_OPCIONES.map((op, i) => (
                <Pressable
                  key={op.key}
                  style={styles.planMenuOption}
                  onPress={() => {
                    setActividadIdx(i);
                    setMenuDiasOpen(false);
                  }}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={actividadIdx === i ? 'checkmark-circle' : 'ellipse-outline'}
                    size={17}
                    color={actividadIdx === i ? c.primary : c.textSecondary}
                  />
                  <Text style={styles.planMenuOptionText}>{op.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <Modal visible={modalPlanOpen} transparent animationType="fade" onRequestClose={() => setModalPlanOpen(false)}>
          <Pressable style={styles.modalCenteredBackdrop} onPress={() => setModalPlanOpen(false)}>
            <Pressable style={styles.modalCenteredCard} onPress={(event) => event.stopPropagation()}>
              <View style={styles.modalAccent} />
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ gap: s.sm }}>
                <Text style={styles.modalTitle}>Personalizar macros</Text>
                <Text style={styles.modalBody}>Introduce los gramos diarios. Las calorias se recalculan automaticamente.</Text>
                <TextInput style={styles.modalInput} value={modalProt} onChangeText={setModalProt} keyboardType="decimal-pad" placeholder="Proteinas (g)" placeholderTextColor={c.textMuted} />
                <TextInput style={styles.modalInput} value={modalCarb} onChangeText={setModalCarb} keyboardType="decimal-pad" placeholder="Carbohidratos (g)" placeholderTextColor={c.textMuted} />
                <TextInput style={styles.modalInput} value={modalFat} onChangeText={setModalFat} keyboardType="decimal-pad" placeholder="Grasas (g)" placeholderTextColor={c.textMuted} />
                <Text style={styles.subtitle}>{kcalModalPreview.toLocaleString('es-ES')} kcal</Text>
                <Pressable style={styles.modalActionPrimary} onPress={aplicarPlanPersonalizado}>
                  <Text style={styles.modalActionTextPrimary}>Aplicar</Text>
                </Pressable>
              </KeyboardAvoidingView>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={modalConfirmarGuardar} transparent animationType="fade" onRequestClose={() => setModalConfirmarGuardar(false)}>
          <Pressable style={styles.modalCenteredBackdrop} onPress={() => setModalConfirmarGuardar(false)}>
            <Pressable style={styles.modalCenteredCard} onPress={(event) => event.stopPropagation()}>
              <View style={styles.modalAccent} />
              <Text style={styles.modalTitle}>Confirmar cambios</Text>
              <Text style={styles.modalBody}>Revisa tu nuevo plan antes de aplicarlo.</Text>
              <View style={styles.confirmSummary}>
                <View style={styles.confirmLayer}>
                  <View style={styles.confirmLayerHeader}>
                    <Ionicons name="flag-outline" size={18} color={c.primary} />
                    <Text style={styles.confirmLabel}>Objetivo</Text>
                  </View>
                  <Text style={styles.confirmValue}>{objetivoResumen}</Text>
                  <Text style={styles.confirmMeta}>{actividadSel.label}</Text>
                  <Text style={styles.confirmMeta}>{ritmoResumen}</Text>
                </View>
                <View style={styles.confirmLayer}>
                  <View style={styles.confirmLayerHeader}>
                    <Ionicons name="flame-outline" size={18} color={c.primary} />
                    <Text style={styles.confirmLabel}>Kcal y macros</Text>
                  </View>
                  <Text style={styles.confirmHeroValue}>{kcalMostrar.toLocaleString('es-ES')} kcal</Text>
                  <Text style={styles.confirmMeta}>{gramos.p}P / {gramos.c}C / {gramos.f}G</Text>
                </View>
              </View>
              <View style={styles.modalActionRow}>
                <Pressable
                  style={styles.modalActionSecondary}
                  onPress={() => setModalConfirmarGuardar(false)}
                  disabled={guardando}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalActionText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalActionPrimary, styles.modalActionPrimaryFlex, guardando && styles.primaryButtonDisabled]}
                  onPress={() => void onGuardar()}
                  disabled={guardando}
                  accessibilityRole="button"
                >
                  {guardando ? (
                    <ActivityIndicator color={c.textOnPrimary} />
                  ) : (
                    <Text style={styles.modalActionTextPrimary}>Aplicar</Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

function MacroSummary({
  styles,
  label,
  grams,
  pct,
  color,
}: {
  styles: ReturnType<typeof makeStyles>;
  c: Theme;
  label: string;
  grams: number;
  pct: number;
  color: string;
}) {
  return (
    <View style={styles.macroItem}>
      <Text style={styles.macroLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.macroValue}>{grams} g ({pct}%)</Text>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { backgroundColor: color, width: `${Math.max(0, Math.min(100, pct))}%` }]} />
      </View>
    </View>
  );
}
