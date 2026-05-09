import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type Props = {
  finMs: number;
  onSkip: () => void;
  onAddTime: (deltaSeg: number) => void;
};

function formatCuenta(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function TimerDescansoInline({ finMs, onSkip, onAddTime }: Props) {
  const { c, f, ts, r } = useTheme();
  const [tick, setTick] = useState(0);
  const disparedRef = useRef(false);

  useEffect(() => {
    disparedRef.current = false;
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
  }, [finMs, onSkip]);

  const restanteMs = useMemo(
    () => Math.max(0, finMs - Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finMs, tick],
  );

  const colorCuenta = restanteMs < 10_000 ? c.warning : c.primary;

  return (
    <View style={[styles.row, { borderColor: c.borderVisible, borderRadius: r.sm, backgroundColor: c.surfaceElevated }]}>
      <Pressable
        style={[styles.btn, { borderColor: c.border, borderRadius: r.sm, backgroundColor: c.surface }]}
        onPress={() => onAddTime(-15)}
        accessibilityLabel="Quitar 15 segundos"
      >
        <Text style={[{ fontFamily: f.sansMedium, color: c.textDisplay, ...ts.bodySm }]}>−15</Text>
      </Pressable>

      <Pressable style={styles.center} onPress={onSkip} accessibilityLabel="Saltar descanso">
        <Text style={[styles.cuenta, { fontFamily: f.monoBold, color: colorCuenta }]}>
          {formatCuenta(restanteMs)}
        </Text>
        <Text style={[{ fontFamily: f.sans, color: c.textMuted, ...ts.caption }]}>Saltar ›</Text>
      </Pressable>

      <Pressable
        style={[styles.btn, { borderColor: c.border, borderRadius: r.sm, backgroundColor: c.surface }]}
        onPress={() => onAddTime(15)}
        accessibilityLabel="Añadir 15 segundos"
      >
        <Text style={[{ fontFamily: f.sansMedium, color: c.textDisplay, ...ts.bodySm }]}>+15</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  btn: {
    width: 52,
    height: 38,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuenta: {
    fontSize: 28,
    lineHeight: 32,
  },
});
