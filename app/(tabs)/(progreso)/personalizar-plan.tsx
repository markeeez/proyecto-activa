/**
 * Edición del plan nutricional (user_goals) — misma lógica de cálculo que onboarding objetivo.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { supabase } from '@/lib/supabase';
import { progresoService, type ContextoPlanNutricion } from '@/services/progreso.service';
import type { Objetivo } from '@/types/database.types';
import { ACTIVIDAD_OPCIONES, type GeneroOnboarding } from '../../(onboarding)/datos';

type ObjetivoUi = 'perder' | 'mantener' | 'ganar';
type MacroPerfil = 'alta_proteina' | 'equilibrado' | 'alta_carbos';

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

function uiDesdeObjetivoDb(o: string): ObjetivoUi {
  if (o === 'ganar_masa') return 'ganar';
  if (o === 'mantener') return 'mantener';
  return 'perder';
}

function fmtKgRef(kg: number): string {
  const t = kg.toFixed(1);
  return t.endsWith('.0') ? String(Math.round(kg)) : t;
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

const PERFILES: { id: MacroPerfil; label: string }[] = [
  { id: 'alta_proteina', label: 'Alta proteína' },
  { id: 'equilibrado', label: 'Equilibrado' },
  { id: 'alta_carbos', label: 'Alta en carbos' },
];

function makeStyles(c: Theme, f: ReturnType<typeof useTheme>['f'], ts: ReturnType<typeof useTheme>['ts'], s: ReturnType<typeof useTheme>['s'], r: ReturnType<typeof useTheme>['r']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s.md,
      paddingBottom: s.xs,
      minHeight: 44,
      flexShrink: 0,
    },
    headerSide: { width: 44, alignItems: 'flex-start', justifyContent: 'center' },
    headerTitle: {
      flex: 1,
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      textAlign: 'center',
    },
    body: {
      flex: 1,
      flexDirection: 'column',
      paddingHorizontal: s.md,
      paddingTop: s.sm,
      gap: s.sm,
      minHeight: 0,
    },
    hintPerfil: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.textSecondary,
      textAlign: 'center',
      marginBottom: s.xs,
      flexShrink: 0,
    },
    label: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginBottom: 2,
      letterSpacing: 0.6,
      flexShrink: 0,
    },
    labelFirst: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginBottom: 2,
      letterSpacing: 0.6,
      flexShrink: 0,
    },
    selectorActividad: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.sm,
      paddingHorizontal: s.sm,
      paddingVertical: s.sm,
      backgroundColor: c.surface,
      flexShrink: 0,
    },
    selectorActividadTxt: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.textDisplay,
      flex: 1,
      paddingRight: s.sm,
    },
    chevronActividad: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.primary,
    },
    segmentRowObj: {
      flexDirection: 'row',
      gap: s.xs,
      flexWrap: 'wrap',
      justifyContent: 'center',
      flexShrink: 0,
    },
    segmentBtnObj: {
      paddingVertical: 6,
      paddingHorizontal: s.xs,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      minHeight: 36,
      justifyContent: 'center',
    },
    segmentBtnObjOn: { borderColor: c.primary, backgroundColor: c.primaryBg },
    segmentTxtObj: {
      ...ts.caption,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
    },
    segmentTxtObjOn: { color: c.primary },
    pesoBlock: {
      alignItems: 'center',
      flexShrink: 0,
    },
    pesoLabelCenter: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.6,
      marginBottom: 2,
    },
    pesoValorCenter: {
      ...ts.body,
      fontFamily: f.mono,
      fontWeight: '500',
      color: c.textDisplay,
      textAlign: 'center',
    },
    macroPerfilRow: { flexDirection: 'row', gap: s.xs, flexShrink: 0 },
    macroPerfilBtn: {
      flex: 1,
      paddingVertical: 4,
      paddingHorizontal: 2,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 32,
    },
    macroPerfilBtnOn: { borderColor: c.primary, backgroundColor: c.primaryBg },
    macroPerfilTxt: {
      ...ts.caption,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
      textAlign: 'center',
      fontSize: 11,
    },
    macroPerfilTxtOn: { color: c.primary },
    velocidadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.sm,
      flexShrink: 0,
    },
    velocidadValor: {
      ...ts.body,
      fontFamily: f.mono,
      color: c.textDisplay,
      minWidth: 48,
      textAlign: 'center',
    },
    stepBtn: {
      width: 40,
      height: 40,
      borderRadius: r.technical,
      borderWidth: 1,
      borderColor: c.borderVisible,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    stepBtnTxt: {
      ...ts.body,
      fontFamily: f.monoBold,
      color: c.textDisplay,
    },
    kcalBlock: { alignItems: 'center', flexShrink: 0 },
    kcalValor: {
      fontSize: 48,
      lineHeight: 56,
      fontFamily: f.mono,
      color: c.primary,
    },
    kcalHint: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textMuted,
      marginTop: 2,
    },
    macroCardsRow: { flexDirection: 'row', gap: 4, flexShrink: 0 },
    macroCard: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.sm,
      paddingVertical: s.xs,
      paddingHorizontal: 4,
      backgroundColor: c.surface,
      alignItems: 'center',
    },
    macroCardLabel: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.5,
      fontSize: 10,
      textAlign: 'center',
    },
    macroCardGrams: {
      ...ts.body,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      marginTop: 2,
      fontSize: 14,
    },
    macroCardMeta: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginTop: 2,
      fontSize: 10,
      textAlign: 'center',
    },
    linkPlan: {
      ...ts.caption,
      fontFamily: f.sansMedium,
      color: c.primary,
      textDecorationLine: 'underline',
    },
    planLinksBlock: {
      alignItems: 'center',
      marginTop: s.xs,
      flexShrink: 0,
    },
    planLinksColumn: {
      gap: 2,
    },
    planLinksSeparator: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingHorizontal: s.md,
      paddingTop: s.sm,
      backgroundColor: c.background,
      flexShrink: 0,
    },
    btnPrimary: {
      paddingVertical: s.sm,
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
      paddingVertical: s.sm,
      borderRadius: r.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: 'transparent',
      marginTop: s.xs,
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
      paddingBottom: s.lg,
      maxHeight: '70%',
    },
    modalTitulo: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
    },
    modalOpcion: {
      paddingVertical: s.sm,
      paddingHorizontal: s.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    modalOpcionTxt: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textDisplay,
    },
    modalCardGramos: {
      backgroundColor: c.surfaceElevated,
      borderTopLeftRadius: r.lg,
      borderTopRightRadius: r.lg,
      borderTopWidth: 1,
      borderColor: c.borderVisible,
      paddingHorizontal: s.md,
      paddingTop: s.md,
      maxHeight: '85%',
    },
    modalTituloGramos: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      marginBottom: s.xs,
    },
    modalDesc: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textSecondary,
      marginBottom: s.sm,
    },
    modalLabel: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginBottom: 4,
      letterSpacing: 0.6,
    },
    input: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.sm,
      paddingHorizontal: s.sm,
      paddingVertical: s.xs,
      backgroundColor: c.surface,
    },
    modalKcalLive: {
      ...ts.body,
      fontFamily: f.mono,
      color: c.primary,
      marginTop: s.sm,
      marginBottom: s.sm,
    },
    modalActions: { gap: s.xs, marginBottom: s.sm },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: s.md,
    },
    errorPesoObj: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.danger,
      marginTop: 4,
      marginBottom: s.xs,
    },
  });
}

export default function PersonalizarPlanPantalla() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [cargando, setCargando] = useState(true);
  const [ctx, setCtx] = useState<ContextoPlanNutricion | null>(null);

  const [actividadIdx, setActividadIdx] = useState(2);
  const [modalActividad, setModalActividad] = useState(false);

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

  const factorSel = ACTIVIDAD_OPCIONES[actividadIdx]!.factor;
  const actividadLabel = ACTIVIDAD_OPCIONES[actividadIdx]!.label;

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
        if (plan.peso_objetivo != null && Number.isFinite(plan.peso_objetivo)) {
          setPesoObjetivo(String(plan.peso_objetivo));
        } else {
          setPesoObjetivo('');
        }
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
      Alert.alert('Error', 'No se pudieron cargar los datos.');
    } finally {
      setCargando(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const tdeeReady = useMemo(() => {
    if (!ctx) return false;
    return (
      ctx.genero != null &&
      ctx.edad != null &&
      ctx.edad > 0 &&
      ctx.alturaCm != null &&
      ctx.alturaCm > 0 &&
      ctx.pesoKg != null &&
      ctx.pesoKg > 0
    );
  }, [ctx]);

  const mostrarHintPerfil = useMemo(() => {
    if (!ctx) return false;
    return ctx.genero == null || ctx.edad == null || ctx.alturaCm == null;
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
  }, [tdeeReady, ctx, factorSel, objetivoUi, velocidad]);

  const kcalTdeeRedondeada = Math.max(0, Math.round(kcalTdee));

  const kcalMostrar = useMemo(() => {
    if (macroPerfil !== null) {
      return kcalTdeeRedondeada;
    }
    if (!gramosPersonalizado) return kcalTdeeRedondeada;
    const { p, c, f: fat } = gramosPersonalizado;
    return Math.round(p * 4 + c * 4 + fat * 9);
  }, [macroPerfil, kcalTdeeRedondeada, gramosPersonalizado]);

  const pesoParaMacros = ctx?.pesoKg != null && ctx.pesoKg > 0 ? ctx.pesoKg : 0;

  const gramos = useMemo(() => {
    if (pesoParaMacros <= 0) return { p: 0, c: 0, f: 0 };
    if (macroPerfil !== null) {
      return macrosDesdePerfil(macroPerfil, pesoParaMacros, kcalMostrar);
    }
    return gramosPersonalizado ?? { p: 0, c: 0, f: 0 };
  }, [macroPerfil, pesoParaMacros, kcalMostrar, gramosPersonalizado]);

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

  const pesoActualRef = ctx?.pesoKg != null && ctx.pesoKg > 0 ? ctx.pesoKg : null;

  const errorPesoObjetivo = useMemo(() => {
    if (objetivoUi === 'mantener') return null;
    const po = pesoObjetivo.trim().replace(',', '.');
    if (!po) return null;
    const n = parseFloat(po);
    if (!Number.isFinite(n) || n <= 0) return null;
    const w = pesoActualRef;
    if (w == null) return null;
    const wTxt = fmtKgRef(w);
    if (objetivoUi === 'perder' && n >= w) {
      return `El peso objetivo debe ser menor que tu peso actual (${wTxt} kg)`;
    }
    if (objetivoUi === 'ganar' && n <= w) {
      return `El peso objetivo debe ser mayor que tu peso actual (${wTxt} kg)`;
    }
    return null;
  }, [objetivoUi, pesoObjetivo, pesoActualRef]);

  const formGuardarOk = useMemo(() => {
    if (kcalMostrar <= 0) return false;
    if (gramos.p < 0 || gramos.c < 0 || gramos.f < 0) return false;
    if (objetivoUi !== 'mantener') {
      const po = pesoObjetivo.trim().replace(',', '.');
      if (!po) return false;
      const n = parseFloat(po);
      if (!Number.isFinite(n) || n <= 0) return false;
      if (errorPesoObjetivo) return false;
    }
    return true;
  }, [kcalMostrar, gramos, objetivoUi, pesoObjetivo, errorPesoObjetivo]);

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

  const onGuardar = async () => {
    if (!user?.id || !formGuardarOk) return;
    setGuardando(true);
    try {
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
      router.navigate('/(tabs)/(progreso)');
    } finally {
      setGuardando(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={{ ...ts.body, fontFamily: f.sans, color: c.textSecondary }}>Inicia sesión</Text>
      </View>
    );
  }

  if (cargando) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, justifyContent: 'center' }]}>
        <ActivityIndicator color={c.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <Pressable
              onPress={() => router.navigate('/(tabs)/(progreso)')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Volver"
            >
              <Ionicons name="chevron-back" size={26} color={c.textDisplay} />
            </Pressable>
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Personalizar plan
          </Text>
          <View style={styles.headerSide} />
        </View>

        <View style={styles.body}>
          {mostrarHintPerfil ? (
            <Text style={styles.hintPerfil}>Completa tu perfil para un cálculo más preciso</Text>
          ) : null}

          <Text style={styles.labelFirst}>NIVEL DE ACTIVIDAD</Text>
          <Pressable style={styles.selectorActividad} onPress={() => setModalActividad(true)}>
            <Text style={styles.selectorActividadTxt} numberOfLines={2}>
              {actividadLabel}
            </Text>
            <Text style={styles.chevronActividad}>▼</Text>
          </Pressable>

          <Text style={styles.label}>OBJETIVO</Text>
          <View style={styles.segmentRowObj}>
            {(
              [
                ['perder', 'Perder grasa'],
                ['mantener', 'Mantener'],
                ['ganar', 'Ganar masa'],
              ] as const
            ).map(([val, label]) => (
              <Pressable
                key={val}
                style={[styles.segmentBtnObj, objetivoUi === val && styles.segmentBtnObjOn]}
                onPress={() => setObjetivoUi(val)}
              >
                <Text style={[styles.segmentTxtObj, objetivoUi === val && styles.segmentTxtObjOn]} numberOfLines={1}>
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
              {errorPesoObjetivo ? <Text style={styles.errorPesoObj}>{errorPesoObjetivo}</Text> : null}
            </>
          ) : null}

          <View style={styles.pesoBlock}>
            <Text style={styles.pesoLabelCenter}>PESO ACTUAL</Text>
            <Text style={styles.pesoValorCenter}>
              {ctx?.pesoKg != null && ctx.pesoKg > 0 ? `${fmt(ctx.pesoKg)} kg` : '—'}
            </Text>
          </View>

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
            <Text style={styles.kcalValor}>{kcalMostrar > 0 ? kcalMostrar : '—'}</Text>
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
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + -30 }]}>
          <Pressable
            style={[styles.btnPrimary, (!formGuardarOk || guardando) && styles.btnDis]}
            onPress={() => void onGuardar()}
            disabled={!formGuardarOk || guardando}
          >
            {guardando ? (
              <ActivityIndicator color={c.textOnPrimary} />
            ) : (
              <Text style={styles.btnTxt}>GUARDAR PLAN</Text>
            )}
          </Pressable>
        </View>

      <Modal visible={modalActividad} transparent animationType="slide" onRequestClose={() => setModalActividad(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModalActividad(false)}>
          <Pressable style={[styles.modalCard, { paddingBottom: insets.bottom + s.md }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitulo}>NIVEL DE ACTIVIDAD</Text>
            <ScrollView>
              {ACTIVIDAD_OPCIONES.map((op, i) => (
                <Pressable
                  key={op.label}
                  style={styles.modalOpcion}
                  onPress={() => {
                    setActividadIdx(i);
                    setModalActividad(false);
                  }}
                >
                  <Text style={styles.modalOpcionTxt}>{op.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={modalPlanOpen} transparent animationType="slide" onRequestClose={() => setModalPlanOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModalPlanOpen(false)}>
          <Pressable
            style={[styles.modalCardGramos, { paddingBottom: insets.bottom + s.md }]}
            onPress={(e) => e.stopPropagation()}
          >
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <Text style={styles.modalTituloGramos}>Personalizar plan</Text>
              <Text style={styles.modalDesc}>
                Introduce los gramos diarios que quieres consumir. Las calorías se calcularán automáticamente.
              </Text>

              <Text style={styles.modalLabel}>PROTEÍNAS (G)</Text>
              <TextInput
                style={[styles.input, { marginBottom: s.sm }]}
                value={modalProt}
                onChangeText={setModalProt}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={c.textMuted}
              />

              <Text style={styles.modalLabel}>CARBOS (G)</Text>
              <TextInput
                style={[styles.input, { marginBottom: s.sm }]}
                value={modalCarb}
                onChangeText={setModalCarb}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={c.textMuted}
              />

              <Text style={styles.modalLabel}>GRASAS (G)</Text>
              <TextInput
                style={[styles.input, { marginBottom: s.xs }]}
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
    </View>
  );
}

function fmt(kg: number): string {
  const t = kg.toFixed(1);
  return t.endsWith('.0') ? String(Math.round(kg)) : t;
}