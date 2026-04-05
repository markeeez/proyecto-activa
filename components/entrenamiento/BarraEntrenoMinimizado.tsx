/**
 * Barra fija sobre el tab bar cuando hay un entreno activo (minimizado o no).
 */

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useEntreno, useEntrenoDuracionTexto } from '@/context/EntrenoContext';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';

const ALTURA = 56;

function makeStyles(c: Theme, f: ReturnType<typeof useTheme>['f'], ts: ReturnType<typeof useTheme>['ts'], s: ReturnType<typeof useTheme>['s']) {
  return StyleSheet.create({
    bar: {
      height: ALTURA,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.borderVisible,
      paddingHorizontal: s.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: s.sm,
    },
    nombre: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      flex: 1,
      minWidth: 0,
    },
    cron: {
      ...ts.bodySm,
      fontFamily: f.mono,
      color: c.textSecondary,
      flexShrink: 0,
    },
  });
}

export function BarraEntrenoMinimizado() {
  const router = useRouter();
  const { maximizar, entrenoActivo } = useEntreno();
  const duracion = useEntrenoDuracionTexto();
  const { c, f, ts, s } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s), [c, f, ts, s]);

  if (!entrenoActivo) return null;

  const onPress = () => {
    maximizar();
    router.push('/(tabs)/(entrenamiento)/entreno-activo');
  };

  return (
    <Pressable style={styles.bar} onPress={onPress} accessibilityRole="button" accessibilityLabel="Volver al entreno activo">
      <Text style={styles.nombre} numberOfLines={1}>
        {entrenoActivo.nombre}
      </Text>
      <View style={{ flexShrink: 0 }}>
        <Text style={styles.cron}>{duracion}</Text>
      </View>
    </Pressable>
  );
}
