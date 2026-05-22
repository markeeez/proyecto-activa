import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlowButton } from '@/components/ui/GlowButton';
import { Colors, FontFamily } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { subirAvatar } from '@/lib/avatar';
import { leerParam } from '@/lib/onboardingParams';
import { supabase } from '@/lib/supabase';

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

export default function OnboardingFotoPerfilPantalla() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const rawParams = useLocalSearchParams<Record<ParamKey, string | string[]>>();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    const meta = user?.user_metadata as { avatar_url?: string } | undefined;
    setAvatarUrl(meta?.avatar_url ?? null);
  }, [user]);

  const elegirFoto = async () => {
    if (!user?.id || subiendo) return;
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      const ask = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!ask.granted) {
        Alert.alert('Permiso necesario', 'Habilita el acceso a tus fotos para elegir un avatar.');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    setSubiendo(true);
    try {
      const asset = result.assets[0];
      const publicUrl = await subirAvatar(user.id, asset.uri, asset.mimeType ?? 'image/jpeg');
      const { error } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      if (error) throw error;
      setAvatarUrl(publicUrl);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No se pudo subir la imagen.';
      Alert.alert('No se pudo subir', msg);
    } finally {
      setSubiendo(false);
    }
  };

  const continuar = () => {
    const params: Partial<Record<ParamKey, string>> = {};
    for (const key of PARAM_KEYS) {
      const value = leerParam(rawParams[key]);
      if (value != null) params[key] = value;
    }
    router.push({ pathname: '/(onboarding)/notificaciones', params });
  };

  return (
    <View style={[st.root, { paddingTop: insets.top + 10 }]}>
      <View style={st.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={22} color={WHITE} />
        </Pressable>
        <View style={st.progressTrack}>
          <View style={[st.progressFill, { width: `${(5 / TOTAL_PASOS) * 100}%` }]} />
        </View>
        <Text style={st.headerStep}>PASO 5 DE {TOTAL_PASOS}</Text>
      </View>

      <Text style={st.kicker}>VÉRTICE</Text>
      <Text style={st.title}>Añade una foto</Text>
      <Text style={st.subtitle}>Opcional. Hace tu perfil más tuyo y puedes cambiarla cuando quieras.</Text>

      <View style={st.card}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={st.avatar} contentFit="cover" />
        ) : (
          <View style={[st.avatar, st.avatarFallback]}>
            <Ionicons name="person-outline" size={42} color={CYAN} />
          </View>
        )}
        <Pressable style={st.secondaryCta} onPress={() => void elegirFoto()} disabled={subiendo} accessibilityRole="button">
          {subiendo ? <ActivityIndicator color={CYAN} /> : <Text style={st.secondaryCtaText}>{avatarUrl ? 'Cambiar foto' : 'Elegir foto'}</Text>}
        </Pressable>
      </View>

      <View style={[st.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable onPress={continuar} disabled={subiendo} accessibilityRole="button">
          <Text style={st.skipText}>Saltar por ahora</Text>
        </Pressable>
        <GlowButton borderRadius={12} glowPadding={28}>
          <Pressable style={st.cta} onPress={continuar} disabled={subiendo} accessibilityRole="button">
            <Text style={st.ctaText}>CONTINUAR</Text>
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
  kicker: { color: CYAN, fontFamily: FontFamily.mono, fontSize: 10, letterSpacing: 2.4 },
  title: { marginTop: 8, color: WHITE, fontFamily: FontFamily.sansBold, fontSize: 22, lineHeight: 27 },
  subtitle: { marginTop: 8, color: AUTH.textSecondary, fontFamily: FontFamily.sans, fontSize: 13, lineHeight: 18 },
  card: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  avatar: { width: 132, height: 132, borderRadius: 66, backgroundColor: SURFACE },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BORDER_SOFT },
  secondaryCta: { minWidth: 150, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: BORDER_SOFT, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  secondaryCtaText: { color: CYAN, fontFamily: FontFamily.sansBold, fontSize: 12 },
  footer: { gap: 10 },
  skipText: { color: AUTH.textSecondary, fontFamily: FontFamily.sansMedium, fontSize: 12, textAlign: 'center' },
  cta: { height: 48, borderRadius: 12, backgroundColor: CYAN, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: BG, fontFamily: FontFamily.sansBold, fontSize: 12, letterSpacing: 2.3 },
});
