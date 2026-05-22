import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlowButton } from '@/components/ui/GlowButton';
import { Colors, FontFamily } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTimerDescanso, type ModoDescanso } from '@/hooks/useTimerDescanso';
import { fechaHoyIsoLocal } from '@/lib/fechaNutricion';
import { leerGenero, leerNumero, leerObjetivoUi } from '@/lib/onboardingParams';
import type { ObjetivoUi } from '@/lib/onboardingParams';
import { supabase } from '@/lib/supabase';
import { activacionService } from '@/services/activacion.service';
import type { Objetivo } from '@/types/database.types';

const TOTAL_PASOS = 7;
const AUTH = Colors.dark;
const BG = AUTH.background;
const CYAN = AUTH.primary;
const WHITE = AUTH.textDisplay;
const SURFACE = AUTH.surface;
const BORDER_SOFT = AUTH.border;
const LABEL = AUTH.textMuted;

function objetivoDbDesdeUi(ui: ObjetivoUi): Objetivo {
  if (ui === 'perder') return 'perder_peso';
  if (ui === 'ganar') return 'ganar_masa';
  return 'mantener';
}

function formatearDuracion(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type Parsed = {
  ok: boolean;
  objetivo?: ObjetivoUi;
  genero?: 'hombre' | 'mujer';
  edad: number | null;
  peso: number | null;
  altura: number | null;
  factor: number | null;
  kcal: number | null;
  proteinas: number | null;
  carbos: number | null;
  grasas: number | null;
};

export default function OnboardingDescansoPantalla() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { preferencia, setModo, setDuracionSeg } = useTimerDescanso();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const [guardando, setGuardando] = useState(false);

  const parsed = useMemo<Parsed>(() => {
    const objetivo = leerObjetivoUi(params.objetivo);
    const genero = leerGenero(params.genero);
    const edad = leerNumero(params.edad);
    const peso = leerNumero(params.pesoKg);
    const altura = leerNumero(params.alturaCm);
    const factor = leerNumero(params.factorActividad);
    const kcal = leerNumero(params.kcal);
    const proteinas = leerNumero(params.proteinas);
    const carbos = leerNumero(params.carbos);
    const grasas = leerNumero(params.grasas);
    const ok = Boolean(
      objetivo && genero &&
      edad != null && peso != null && altura != null && factor != null &&
      kcal != null && proteinas != null && carbos != null && grasas != null,
    );
    return { ok, objetivo, genero, edad, peso, altura, factor, kcal, proteinas, carbos, grasas };
  }, [params]);

  const finalizar = async () => {
    if (guardando) return;
    if (!user?.id || !parsed.ok || !parsed.objetivo || !parsed.genero) {
      Alert.alert('Faltan datos', 'No hemos podido leer todos los datos. Vuelve al paso anterior y vuelve a intentarlo.');
      return;
    }
    setGuardando(true);
    try {
      const { error } = await supabase.rpc('finalizar_onboarding', {
        p_genero: parsed.genero,
        p_edad: parsed.edad!,
        p_altura_cm: parsed.altura!,
        p_peso_kg: parsed.peso!,
        p_factor_actividad: parsed.factor!,
        p_objetivo: objetivoDbDesdeUi(parsed.objetivo),
        p_kcal: parsed.kcal!,
        p_proteinas: parsed.proteinas!,
        p_carbos: parsed.carbos!,
        p_grasas: parsed.grasas!,
        p_fecha: fechaHoyIsoLocal(),
      });
      if (error) throw error;

      // No bloqueante: si la rutina inicial no se puede crear, seguimos.
      try {
        await activacionService.asegurarRutinaInicial(user.id);
      } catch (err) {
        if (__DEV__) console.warn('[descanso] asegurarRutinaInicial', err);
      }

      router.replace('/(tabs)/inicio');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No se pudo guardar tu configuración.';
      Alert.alert('No se pudo guardar', msg);
      setGuardando(false);
    }
  };

  return (
    <View style={[st.root, { paddingTop: insets.top + 10 }]}>
      <View style={st.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} disabled={guardando} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={22} color={WHITE} />
        </Pressable>
        <View style={st.progressTrack}>
          <View style={[st.progressFill, { width: '100%' }]} />
        </View>
        <Text style={st.headerStep}>PASO 7 DE {TOTAL_PASOS}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scroll}>
        <Text style={st.kicker}>VÉRTICE</Text>
        <Text style={st.title}>Descanso entre series</Text>
        <Text style={st.subtitle}>Deja listo cómo quieres medir tus descansos cuando empieces tu primera rutina.</Text>

        <View style={st.options}>
          {([
            ['fijo', 'Tiempo fijo', 'Cuenta atrás tras cada serie.'],
            ['auto', 'Automático', 'Mide el tiempo real entre series.'],
            ['off', 'Desactivado', 'Sin timer de descanso.'],
          ] as [ModoDescanso, string, string][]).map(([modo, title, description]) => {
            const selected = preferencia.modo === modo;
            return (
              <Pressable
                key={modo}
                style={[st.option, selected && st.optionSelected]}
                onPress={() => setModo(modo)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${title}. ${description}`}
              >
                <View style={st.optionText}>
                  <Text style={st.optionTitle}>{title}</Text>
                  <Text style={st.optionDescription}>{description}</Text>
                </View>
                <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? CYAN : LABEL} />
              </Pressable>
            );
          })}
        </View>

        {preferencia.modo === 'fijo' ? (
          <View style={st.durationWrap}>
            <Pressable
              style={st.durationButton}
              onPress={() => setDuracionSeg(Math.max(15, preferencia.duracionSeg - 15))}
              accessibilityLabel="Quitar 15 segundos"
            >
              <Text style={st.durationButtonText}>−</Text>
            </Pressable>
            <View style={st.durationValueWrap}>
              <Text style={st.durationValue}>{formatearDuracion(preferencia.duracionSeg)}</Text>
              <Text style={st.durationLabel}>min:seg</Text>
            </View>
            <Pressable
              style={st.durationButton}
              onPress={() => setDuracionSeg(Math.min(600, preferencia.duracionSeg + 15))}
              accessibilityLabel="Añadir 15 segundos"
            >
              <Text style={st.durationButtonText}>+</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <View style={[st.footer, { paddingBottom: insets.bottom + 12 }]}>
        <GlowButton borderRadius={12} glowPadding={28}>
          <Pressable style={st.cta} onPress={() => void finalizar()} disabled={guardando} accessibilityRole="button">
            {guardando ? <ActivityIndicator color={BG} /> : <Text style={st.ctaText}>ENTRAR EN VÉRTICE</Text>}
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
  headerStep: { color: LABEL, fontFamily: FontFamily.mono, fontSize: 10, letterSpacing: 1.2 },
  scroll: { paddingBottom: 16 },
  kicker: { color: CYAN, fontFamily: FontFamily.mono, fontSize: 10, letterSpacing: 2.4 },
  title: { marginTop: 8, color: WHITE, fontFamily: FontFamily.sansBold, fontSize: 22, lineHeight: 27 },
  subtitle: { marginTop: 8, marginBottom: 18, color: AUTH.textSecondary, fontFamily: FontFamily.sans, fontSize: 13, lineHeight: 18 },
  options: { gap: 8 },
  option: { minHeight: 64, borderRadius: 12, borderWidth: 1, borderColor: BORDER_SOFT, backgroundColor: SURFACE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  optionSelected: { borderColor: CYAN },
  optionText: { flex: 1, paddingRight: 10 },
  optionTitle: { color: WHITE, fontFamily: FontFamily.sansBold, fontSize: 13, lineHeight: 17 },
  optionDescription: { marginTop: 3, color: AUTH.textSecondary, fontFamily: FontFamily.sans, fontSize: 11, lineHeight: 15 },
  durationWrap: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER_SOFT,
  },
  durationButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationButtonText: { color: WHITE, fontFamily: FontFamily.sansBold, fontSize: 18 },
  durationValueWrap: { alignItems: 'center' },
  durationValue: { minWidth: 56, color: WHITE, fontFamily: FontFamily.monoBold, fontSize: 22, textAlign: 'center' },
  durationLabel: { marginTop: 2, color: LABEL, fontFamily: FontFamily.mono, fontSize: 10 },
  footer: { paddingTop: 8 },
  cta: { height: 48, borderRadius: 12, backgroundColor: CYAN, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: BG, fontFamily: FontFamily.sansBold, fontSize: 12, letterSpacing: 2.1 },
});
