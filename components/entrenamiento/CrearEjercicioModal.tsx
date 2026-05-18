/**
 * Formulario mínimo para ejercicio personalizado (modal).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';
import type { Exercise } from '@/types/database.types';
import { ejerciciosService } from '@/services/ejercicios.service';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (nombre: string, musculoPrimario: string) => Promise<Exercise | null>;
};

function makeStyles(c: Theme, f: ReturnType<typeof useTheme>['f'], ts: ReturnType<typeof useTheme>['ts'], s: ReturnType<typeof useTheme>['s'], r: ReturnType<typeof useTheme>['r']) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      padding: s.lg,
    },
    card: {
      backgroundColor: c.surfaceElevated,
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.borderVisible,
      padding: s.md,
      gap: s.md,
    },
    title: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      textAlign: 'center',
    },
    field: {
      borderBottomWidth: 1,
      borderBottomColor: c.borderVisible,
      paddingBottom: s.xs,
    },
    input: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
      paddingVertical: s.xs,
    },
    musculoChip: {
      paddingVertical: s.xs,
      paddingHorizontal: s.sm,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
    },
    musculoChipOn: {
      borderColor: c.primary,
      backgroundColor: c.primaryBg,
    },
    musculoChipTxt: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
    },
    musculoChipTxtOn: {
      color: c.primary,
    },
    row: {
      flexDirection: 'row',
      gap: s.sm,
      marginTop: s.sm,
    },
    btn: {
      flex: 1,
      paddingVertical: s.sm,
      alignItems: 'center',
      borderRadius: r.technical,
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    btnPrimary: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    btnPrimaryDisabled: {
      opacity: 0.4,
    },
    btnTxt: {
      ...ts.bodySm,
      fontFamily: f.mono,
      color: c.textSecondary,
    },
    btnTxtPrimary: {
      color: c.textOnPrimary,
    },
    pickerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    pickerSheet: {
      maxHeight: '70%',
      backgroundColor: c.surface,
      borderTopLeftRadius: r.lg,
      borderTopRightRadius: r.lg,
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    pickerTitle: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      padding: s.md,
      letterSpacing: 0.7,
    },
    pickerItem: {
      paddingVertical: s.md,
      paddingHorizontal: s.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    pickerItemTxt: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
    },
    pickerEmpty: {
      padding: s.lg,
      alignItems: 'center',
    },
    pickerEmptyTxt: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textMuted,
      textAlign: 'center',
    },
  });
}

export function CrearEjercicioModal({ visible, onClose, onSubmit }: Props) {
  const insets = useSafeAreaInsets();
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [nombre, setNombre] = useState('');
  const [musculo, setMusculo] = useState<string | null>(null);
  const [opcionesMusculo, setOpcionesMusculo] = useState<string[]>([]);
  const [pickerMusculo, setPickerMusculo] = useState(false);
  const [loading, setLoading] = useState(false);

  const cargarMusculos = useCallback(async () => {
    const list = await ejerciciosService.obtenerMusculosDisponibles();
    setOpcionesMusculo(list);
  }, []);

  useEffect(() => {
    if (visible) {
      void cargarMusculos();
    }
  }, [visible, cargarMusculos]);

  const cerrar = () => {
    setNombre('');
    setMusculo(null);
    setPickerMusculo(false);
    onClose();
  };

  const canCrear = nombre.trim() !== '' && Boolean(musculo?.trim());

  const guardar = async () => {
    if (!canCrear) return;
    setLoading(true);
    try {
      const ex = await onSubmit(nombre.trim(), musculo!.trim());
      if (ex) cerrar();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={cerrar}>
        <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.card}>
            <Text style={styles.title}>Nuevo ejercicio</Text>
            <View style={styles.field}>
              <TextInput
                style={styles.input}
                placeholder="Nombre"
                placeholderTextColor={c.textMuted}
                value={nombre}
                onChangeText={setNombre}
                autoCorrect={false}
              />
            </View>
            <Pressable
              style={[styles.musculoChip, musculo && styles.musculoChipOn]}
              onPress={() => setPickerMusculo(true)}
              accessibilityRole="button"
              accessibilityLabel="Músculo principal"
            >
              <Text style={[styles.musculoChipTxt, musculo && styles.musculoChipTxtOn]} numberOfLines={1}>
                {musculo ?? 'Músculo principal'}
              </Text>
            </Pressable>
            <View style={styles.row}>
              <Pressable style={styles.btn} onPress={cerrar} disabled={loading}>
                <Text style={styles.btnTxt}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnPrimary, !canCrear && !loading && styles.btnPrimaryDisabled]}
                onPress={guardar}
                disabled={loading || !canCrear}
              >
                {loading ? (
                  <ActivityIndicator color={c.textOnPrimary} />
                ) : (
                  <Text style={[styles.btnTxt, styles.btnTxtPrimary]}>Crear</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={pickerMusculo} transparent animationType="fade" onRequestClose={() => setPickerMusculo(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setPickerMusculo(false)}>
          <Pressable style={[styles.pickerSheet, { paddingBottom: insets.bottom + s.md }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>MÚSCULO PRINCIPAL</Text>
            <FlatList
              data={opcionesMusculo}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyTxt}>No hay músculos en el catálogo. Añade ejercicios en Supabase primero.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pickerItem}
                  onPress={() => {
                    setMusculo(item);
                    setPickerMusculo(false);
                  }}
                >
                  <Text style={styles.pickerItemTxt}>{item}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
