/**
 * Lista de acciones estilo action sheet (Nothing / modal simple).
 */

import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';

export type OpcionMenuItem = {
  key: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  separatorBefore?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  options: OpcionMenuItem[];
};

function makeStyles(c: Theme, f: ReturnType<typeof useTheme>['f'], ts: ReturnType<typeof useTheme>['ts'], s: ReturnType<typeof useTheme>['s'], r: ReturnType<typeof useTheme>['r']) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: r.lg,
      borderTopRightRadius: r.lg,
      borderWidth: 1,
      borderColor: c.borderVisible,
      paddingTop: s.sm,
      paddingHorizontal: s.md,
    },
    option: {
      paddingVertical: s.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    optionDestructive: {},
    optionLabel: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
    },
    optionLabelDest: {
      color: c.danger,
    },
    separator: {
      height: s.sm,
    },
    cancelBtn: {
      marginTop: s.sm,
      marginBottom: s.xs,
      paddingVertical: s.md,
      alignItems: 'center',
    },
    cancelTxt: {
      ...ts.bodySm,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.5,
    },
  });
}

export function OpcionesMenuModal({ visible, onClose, options }: Props) {
  const insets = useSafeAreaInsets();
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, s.md) }]} onPress={(e) => e.stopPropagation()}>
          {options.map((op) => (
            <View key={op.key}>
              {op.separatorBefore ? <View style={styles.separator} /> : null}
              <Pressable
                style={styles.option}
                onPress={() => {
                  onClose();
                  op.onPress();
                }}
                accessibilityRole="button"
              >
                <Text style={[styles.optionLabel, op.destructive && styles.optionLabelDest]}>{op.label}</Text>
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.cancelBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.cancelTxt}>CERRAR</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
