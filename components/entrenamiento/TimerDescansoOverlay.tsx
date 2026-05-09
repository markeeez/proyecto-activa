import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type Props = {
  visible: boolean;
  finMs: number;
  nombreEjercicio: string;
  numeroSerie: number;
  onSkip: () => void;
  onAddTime: (deltaSeg: number) => void;
  bottomInset: number;
};

function formatearCuenta(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function TimerDescansoOverlay({
  visible,
  finMs,
  nombreEjercicio,
  numeroSerie,
  onSkip,
  onAddTime,
  bottomInset,
}: Props) {
  const { c, f, ts, s, r } = useTheme();
  const translateY = useRef(new Animated.Value(200)).current;
  const [montado, setMontado] = useState(false);
  const [tick, setTick] = useState(0);
  const disparedRef = useRef(false);

  // Animación slide-in / slide-out
  useEffect(() => {
    if (visible) {
      setMontado(true);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start();
    } else {
      disparedRef.current = false;
      Animated.timing(translateY, {
        toValue: 200,
        duration: 280,
        useNativeDriver: true,
      }).start(() => setMontado(false));
    }
  }, [visible, translateY]);

  // Intervalo que actualiza la cuenta y dispara el dismiss al llegar a 0
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      const restante = finMs - Date.now();
      setTick((t) => t + 1);
      if (restante <= 0 && !disparedRef.current) {
        disparedRef.current = true;
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSkip();
      }
    }, 250);
    return () => clearInterval(id);
  }, [visible, finMs, onSkip]);

  const restanteMs = useMemo(
    () => Math.max(0, finMs - Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finMs, tick],
  );

  const colorCuenta = restanteMs < 10_000 ? c.warning : c.textDisplay;

  const bottom = bottomInset + 68;

  if (!montado) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom,
          marginHorizontal: s.md,
          backgroundColor: c.surface,
          borderColor: c.borderVisible,
          borderRadius: r.md,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      {/* Acento superior */}
      <View style={[styles.acento, { backgroundColor: c.primary }]} />

      {/* Fila superior: label + cerrar */}
      <View style={styles.filaLabel}>
        <Text
          style={[styles.label, { fontFamily: f.mono, color: c.textSecondary, ...ts.caption }]}
          numberOfLines={1}
        >
          {nombreEjercicio} — Serie {numeroSerie}
        </Text>
        <Pressable onPress={onSkip} hitSlop={10} accessibilityLabel="Saltar descanso">
          <Text style={[{ fontFamily: f.sans, color: c.textMuted, ...ts.caption }]}>✕</Text>
        </Pressable>
      </View>

      {/* Cuenta regresiva */}
      <Text style={[styles.cuenta, { fontFamily: f.monoBold, color: colorCuenta }]}>
        {formatearCuenta(restanteMs)}
      </Text>

      {/* Botones */}
      <View style={styles.filaBotones}>
        <Pressable
          style={[styles.boton, { backgroundColor: c.surfaceElevated, borderColor: c.border, borderRadius: r.sm }]}
          onPress={() => onAddTime(-15)}
          accessibilityLabel="Quitar 15 segundos"
        >
          <Text style={[styles.botonTxt, { fontFamily: f.sansMedium, color: c.textDisplay, ...ts.bodySm }]}>−15</Text>
        </Pressable>

        <Pressable
          style={[styles.botonSaltar, { backgroundColor: c.primary, borderRadius: r.sm }]}
          onPress={onSkip}
          accessibilityLabel="Saltar descanso"
        >
          <Text style={[styles.botonTxt, { fontFamily: f.sansBold, color: c.textOnPrimary, ...ts.bodySm }]}>Saltar</Text>
        </Pressable>

        <Pressable
          style={[styles.boton, { backgroundColor: c.surfaceElevated, borderColor: c.border, borderRadius: r.sm }]}
          onPress={() => onAddTime(15)}
          accessibilityLabel="Añadir 15 segundos"
        >
          <Text style={[styles.botonTxt, { fontFamily: f.sansMedium, color: c.textDisplay, ...ts.bodySm }]}>+15</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  acento: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  filaLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: { flex: 1, marginRight: 8 },
  cuenta: {
    fontSize: 48,
    lineHeight: 56,
    textAlign: 'center',
    marginBottom: 12,
  },
  filaBotones: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  boton: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  botonSaltar: {
    flex: 2,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonTxt: {},
});
