import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExplorarEjerciciosTab } from '@/components/ExplorarEjerciciosTab';
import { useTheme } from '@/hooks/useTheme';

export default function PerfilEjerciciosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, f, ts, s } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: c.background },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: insets.top + s.xs,
          paddingBottom: s.sm,
          paddingHorizontal: s.sm,
          minHeight: 48,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          backgroundColor: c.surface,
        },
        headerSide: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
        headerTitle: {
          flex: 1,
          ...ts.subheading,
          fontFamily: f.sansMedium,
          color: c.textDisplay,
          textAlign: 'center',
        },
      }),
    [c, f, ts, s, insets.top],
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable style={styles.headerSide} onPress={() => router.back()} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={c.textDisplay} />
        </Pressable>
        <Text style={styles.headerTitle}>Mis Ejercicios</Text>
        <View style={styles.headerSide} />
      </View>
      <ExplorarEjerciciosTab
        initialModoGeneral="creados"
        detailPath="/(tabs)/(perfil)/consulta-ejercicio"
        emptyMessage="No tienes ejercicios en este filtro."
      />
    </View>
  );
}
