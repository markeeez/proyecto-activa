/**
 * Pantalla IA en la edicion free: muestra siempre upgrade-screen.
 *
 * La ruta esta oculta del tab bar (ver app/(tabs)/_layout.tsx href: null).
 * Si alguien navega directamente, ve este mensaje, no un stub vacio ni
 * un chat sin implementar.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export default function IAUpgradeScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top + 16 }]}>
      <View style={styles.iconWrap}>
        <Ionicons name="sparkles-outline" size={40} color={c.primary} />
      </View>
      <Text style={[styles.kicker, { color: c.primary, fontFamily: FontFamily.mono }]}>
        ASISTENTE
      </Text>
      <Text style={[styles.title, { color: c.textDisplay, fontFamily: FontFamily.sansBold }]}>
        Disponible proximamente
      </Text>
      <Text style={[styles.subtitle, { color: c.textSecondary, fontFamily: FontFamily.sans }]}>
        El asistente personal de Vertice todavia no esta abierto. Si quieres ser
        de los primeros en probarlo, escribenos desde tu perfil.
      </Text>

      <Pressable
        onPress={() => router.replace('/(tabs)/inicio')}
        style={[styles.cta, { borderColor: c.borderVisible }]}
        accessibilityRole="button"
      >
        <Text style={[styles.ctaText, { color: c.text, fontFamily: FontFamily.sansBold }]}>
          Volver a inicio
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.25)',
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 2.4,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  cta: {
    marginTop: 32,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  ctaText: {
    fontSize: 12,
    letterSpacing: 1.8,
  },
});
