import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlowButton } from '@/components/ui/GlowButton';
import { Colors, FontFamily } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { leerParam } from '@/lib/onboardingParams';
import { notificacionesService } from '@/services/notificaciones.service';

const TOTAL_PASOS = 7;
const AUTH = Colors.dark;
const BG = AUTH.background;
const CYAN = AUTH.primary;
const WHITE = AUTH.textDisplay;
const SURFACE = AUTH.surface;
const BORDER_SOFT = AUTH.border;
const LABEL = AUTH.textMuted;

const PARAM_KEYS = [
  'objetivo',
  'genero',
  'edad',
  'pesoKg',
  'alturaCm',
  'factorActividad',
  'kcal',
  'proteinas',
  'carbos',
  'grasas',
] as const;

type ParamKey = (typeof PARAM_KEYS)[number];

export default function OnboardingNotificacionesPantalla() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const rawParams = useLocalSearchParams<Record<ParamKey, string | string[]>>();
  const [solicitando, setSolicitando] = useState(false);

  const continuar = () => {
    const params: Partial<Record<ParamKey, string>> = {};
    for (const key of PARAM_KEYS) {
      const value = leerParam(rawParams[key]);
      if (value != null) params[key] = value;
    }
    router.push({ pathname: '/(onboarding)/descanso', params });
  };

  const activar = async () => {
    if (solicitando) return;
    setSolicitando(true);
    try {
      const permisos = await notificacionesService.pedirPermisos();
      if (permisos.granted && user?.id) {
        await notificacionesService.registrarDispositivo(user.id).catch(() => undefined);
      }
    } finally {
      setSolicitando(false);
      continuar();
    }
  };

  return (
    <View style={[st.root, { paddingTop: insets.top + 10 }]}>
      <View style={st.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={22} color={WHITE} />
        </Pressable>
        <View style={st.progressTrack}>
          <View style={[st.progressFill, { width: `${(6 / TOTAL_PASOS) * 100}%` }]} />
        </View>
        <Text style={st.headerStep}>PASO 6 DE {TOTAL_PASOS}</Text>
      </View>

      <View style={st.body}>
        <View style={st.iconWrap}>
          <Ionicons name="notifications-outline" size={34} color={CYAN} />
        </View>
        <Text style={st.kicker}>RECORDATORIOS</Text>
        <Text style={st.title}>Que Vertice te eche una mano</Text>
        <Text style={st.subtitle}>
          Activa avisos utiles para comidas, calorias, peso y entrenos. Seran breves y se enviaran solo cuando falte una accion importante.
        </Text>

        <View style={st.previewCard}>
          <PreviewRow icon="restaurant-outline" title="Comidas y calorias bajo control" />
          <PreviewRow icon="barbell-outline" title="Entreno y peso cuando toque" />
          <PreviewRow icon="time-outline" title="Recordatorios personales editables" />
        </View>
      </View>

      <View style={[st.footer, { paddingBottom: insets.bottom + 12 }]}>
        <GlowButton borderRadius={12} glowPadding={28}>
          <Pressable style={st.cta} onPress={() => void activar()} disabled={solicitando} accessibilityRole="button">
            {solicitando ? <ActivityIndicator color={BG} /> : <Text style={st.ctaText}>CONTINUAR</Text>}
          </Pressable>
        </GlowButton>
      </View>
    </View>
  );
}

function PreviewRow({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={st.previewRow}>
      <Ionicons name={icon} size={18} color={CYAN} />
      <Text style={st.previewText}>{title}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: BORDER_SOFT, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: CYAN },
  headerStep: { color: LABEL, fontFamily: FontFamily.mono, fontSize: 10, letterSpacing: 1.2 },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iconWrap: {
    width: 74,
    height: 74,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  kicker: { color: CYAN, fontFamily: FontFamily.mono, fontSize: 10, letterSpacing: 2.4, textAlign: 'center' },
  title: { marginTop: 8, color: WHITE, fontFamily: FontFamily.sansBold, fontSize: 25, lineHeight: 31, textAlign: 'center' },
  subtitle: { marginTop: 10, color: AUTH.textSecondary, fontFamily: FontFamily.sans, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  previewCard: { alignSelf: 'stretch', marginTop: 22, borderRadius: 12, borderWidth: 1, borderColor: BORDER_SOFT, backgroundColor: SURFACE, padding: 14, gap: 14 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewText: { flex: 1, color: WHITE, fontFamily: FontFamily.sansMedium, fontSize: 13, lineHeight: 17 },
  footer: { gap: 10 },
  cta: { height: 48, borderRadius: 12, backgroundColor: CYAN, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: BG, fontFamily: FontFamily.sansBold, fontSize: 12, letterSpacing: 2.3 },
});
