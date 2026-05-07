/**
 * Barra fija sobre el tab bar cuando hay un entreno activo (minimizado o no).
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TextStyles, type Theme } from '@/constants/theme';
import { useEntreno, useEntrenoDuracionTexto } from '@/context/EntrenoContext';
import { useTheme } from '@/hooks/useTheme';

const ALTURA = 60;
const ICONO_SIZE = 32;
const ACTION_SIZE = 34;

function makeStyles(c: Theme, s: ReturnType<typeof useTheme>['s'], isDark: boolean) {
  const barBg = isDark ? '#101010' : c.surface;
  const iconBg = isDark ? '#0A0A0A' : c.primaryBg;
  const buttonBg = isDark ? '#151515' : c.surfaceElevated;
  const borderColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';

  return StyleSheet.create({
    bar: {
      height: ALTURA,
      backgroundColor: barBg,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      borderColor,
      paddingHorizontal: s.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      overflow: 'hidden',
    },
    pressed: {
      opacity: 0.88,
    },
    iconBadge: {
      width: ICONO_SIZE,
      height: ICONO_SIZE,
      borderRadius: ICONO_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: iconBg,
      flexShrink: 0,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    nombre: {
      ...TextStyles.bodyMedium,
      color: c.textDisplay,
      fontSize: 15,
      lineHeight: 18,
    },
    estado: {
      ...TextStyles.caption,
      color: c.textSecondary,
      fontSize: 11,
      lineHeight: 14,
      marginBottom: 10
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 0,
    },
    tiempoIcon: {
      marginTop: 1,
    },
    tiempoTextos: {
      minWidth: 44,
    },
    tiempoLabel: {
      ...TextStyles.label,
      color: c.textMuted,
    },
    cron: {
      ...TextStyles.bodyMedium,
      color: c.textDisplay,
      fontSize: 15,
      lineHeight: 18,
    },
    action: {
      width: ACTION_SIZE,
      height: ACTION_SIZE,
      borderRadius: ACTION_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: buttonBg,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.18)',
      flexShrink: 0,
    },
    accentLine: {
      position: 'absolute',
      left: 0,
      bottom: 0,
      width: 104,
      height: 2,
      backgroundColor: c.primary,
    },
  });
}

export function BarraEntrenoMinimizado() {
  const router = useRouter();
  const { maximizar, entrenoActivo } = useEntreno();
  const duracion = useEntrenoDuracionTexto();
  const { c, s, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(c, s, isDark), [c, s, isDark]);

  if (!entrenoActivo) return null;

  const ejercicios = entrenoActivo.lineas.length;
  const subtitulo =
    ejercicios === 0
      ? 'Aún no has añadido ejercicios'
      : `${ejercicios} ${ejercicios === 1 ? 'ejercicio añadido' : 'ejercicios añadidos'}`;

  const onPress = () => {
    maximizar();
    router.push('/(tabs)/(entrenamiento)/entreno-activo');
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Volver al entreno activo"
    >
      <View style={styles.iconBadge}>
        <Ionicons name="barbell-outline" size={19} color={c.primary} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.nombre} numberOfLines={1}>
          {entrenoActivo.nombre}
        </Text>
        <Text style={styles.estado} numberOfLines={1}>
          {subtitulo}
        </Text>
      </View>

      <View style={styles.meta}>
        <Ionicons name="time-outline" size={19} color={c.primary} style={styles.tiempoIcon} />
        <View style={styles.tiempoTextos}>
          <Text style={styles.tiempoLabel} numberOfLines={1}>
            TIEMPO
          </Text>
          <Text style={styles.cron} numberOfLines={1}>
            {duracion}
          </Text>
        </View>
      </View>

      <View style={styles.action}>
        <Ionicons name="chevron-up" size={17} color={c.primary} />
      </View>

      <View style={styles.accentLine} pointerEvents="none" />
    </Pressable>
  );
}
