import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type Props = {
  visible: boolean;
  inicioMs: number | null;
};

function formatearTiempo(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ChipCronometrando({ visible, inicioMs }: Props) {
  const { c, f, ts, s, r } = useTheme();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!visible || inicioMs === null) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [visible, inicioMs]);

  const transcurrido = useMemo(() => {
    if (!inicioMs) return 0;
    return Math.max(0, Math.floor((Date.now() - inicioMs) / 1000));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicioMs, tick]);

  if (!visible || inicioMs === null) return null;

  return (
    <View style={[styles.chip, { backgroundColor: c.surfaceElevated, borderColor: c.border, borderRadius: r.technical }]}>
      <Ionicons name="timer-outline" size={13} color={c.primary} />
      <Text style={[styles.texto, { fontFamily: f.mono, color: c.textSecondary, ...ts.caption }]}>
        {formatearTiempo(transcurrido)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'center',
  },
  texto: {},
});
