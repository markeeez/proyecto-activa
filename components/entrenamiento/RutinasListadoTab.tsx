/**
 * Tab Rutinas — acciones + listado compacto sin scroll (datos mock).
 */

import { useMemo, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type RutinaMock = {
  id: string;
  nombre: string;
  ejercicios: string[];
};

type FiltroRutinas = 'mis' | 'favoritas';

function makeStyles(c: Theme, f: ReturnType<typeof useTheme>['f'], ts: ReturnType<typeof useTheme>['ts'], s: ReturnType<typeof useTheme>['s'], r: ReturnType<typeof useTheme>['r']) {
  return StyleSheet.create({
    root: {
      flex: 1,
      minHeight: 0,
      paddingHorizontal: s.md,
      paddingBottom: s.sm,
      gap: s.sm,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.sm,
      paddingVertical: s.md,
      borderRadius: r.sm,
      backgroundColor: c.primary,
      borderWidth: 1,
      borderColor: c.primary,
    },
    primaryBtnText: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textOnPrimary,
      letterSpacing: 0.3,
    },
    secondaryRow: {
      flexDirection: 'row',
      gap: s.sm,
    },
    secondaryBtn: {
      flex: 1,
      paddingVertical: s.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.technical,
      backgroundColor: c.surface,
    },
    secondaryBtnText: {
      ...ts.bodySm,
      fontFamily: f.mono,
      color: c.textDisplay,
      letterSpacing: 0.4,
    },
    accordionWrap: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.lg,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    accordionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
    },
    accordionLabel: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.7,
    },
    accordionValue: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    accordionOptions: {
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    accordionOption: {
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
    },
    accordionOptionActive: {
      backgroundColor: c.primaryBg,
    },
    accordionOptionText: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.text,
    },
    listArea: {
      flex: 1,
      minHeight: 0,
      gap: s.xs,
    },
    sectionMeta: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textMuted,
      letterSpacing: 0.5,
      marginTop: s.xs,
    },
    card: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.lg,
      backgroundColor: c.surfaceElevated,
      paddingHorizontal: s.sm,
      paddingTop: s.sm,
      paddingBottom: s.xs,
    },
    cardTitle: {
      ...ts.body,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      marginBottom: s.xs,
    },
    startBtn: {
      marginTop: s.xs,
      paddingVertical: s.sm,
      alignItems: 'center',
      borderRadius: r.technical,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    startBtnText: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.primary,
      letterSpacing: 0.8,
    },
    ejerciciosBox: {
      marginTop: s.xs,
      paddingTop: s.xs,
      borderTopWidth: 1,
      borderTopColor: c.border,
      gap: 2,
    },
    ejercicioLine: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
    },
  });
}

type Props = {
  rutinasMis: RutinaMock[];
  rutinasFavoritas: RutinaMock[];
};

export function RutinasListadoTab({ rutinasMis, rutinasFavoritas }: Props) {
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [accordionOpen, setAccordionOpen] = useState(false);
  const [filtro, setFiltro] = useState<FiltroRutinas>('mis');
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  const lista = filtro === 'mis' ? rutinasMis : rutinasFavoritas;

  const toggleAccordion = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAccordionOpen((o) => !o);
  };

  const seleccionarFiltro = (next: FiltroRutinas) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFiltro(next);
    setAccordionOpen(false);
    setExpandidoId(null);
  };

  const filtroLabel = filtro === 'mis' ? 'Mis rutinas' : 'Favoritas';

  return (
    <View style={styles.root}>
      <Pressable style={styles.primaryBtn} onPress={() => {}} accessibilityRole="button">
        <Ionicons name="add" size={22} color={c.textOnPrimary} />
        <Text style={styles.primaryBtnText}>Empezar entreno vacío</Text>
      </Pressable>

      <View style={styles.secondaryRow}>
        <Pressable style={styles.secondaryBtn} onPress={() => {}} accessibilityRole="button">
          <Text style={styles.secondaryBtnText}>NUEVA RUTINA</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => {}} accessibilityRole="button">
          <Text style={styles.secondaryBtnText}>EXPLORAR</Text>
        </Pressable>
      </View>

      <View style={styles.accordionWrap}>
        <Pressable style={styles.accordionHeader} onPress={toggleAccordion} accessibilityRole="button">
          <Text style={styles.accordionLabel}>MIS RUTINAS</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.accordionValue}>{filtroLabel}</Text>
            <Ionicons name={accordionOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.textSecondary} />
          </View>
        </Pressable>
        {accordionOpen && (
          <View style={styles.accordionOptions}>
            <Pressable
              style={[styles.accordionOption, filtro === 'mis' && styles.accordionOptionActive]}
              onPress={() => seleccionarFiltro('mis')}
            >
              <Text style={styles.accordionOptionText}>Mis rutinas (creadas)</Text>
            </Pressable>
            <Pressable
              style={[styles.accordionOption, filtro === 'favoritas' && styles.accordionOptionActive]}
              onPress={() => seleccionarFiltro('favoritas')}
            >
              <Text style={styles.accordionOptionText}>Favoritas</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text style={styles.sectionMeta} numberOfLines={1}>
        {lista.length} RUTINA{lista.length === 1 ? '' : 'S'}
      </Text>

      <View style={styles.listArea}>
        {lista.map((rut) => {
          const expandido = expandidoId === rut.id;
          return (
            <View key={rut.id} style={styles.card}>
              <Pressable onPress={() => setExpandidoId(expandido ? null : rut.id)} accessibilityRole="button">
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {rut.nombre}
                </Text>
                {expandido && (
                  <View style={styles.ejerciciosBox}>
                    {rut.ejercicios.map((ex, i) => (
                      <Text key={i} style={styles.ejercicioLine} numberOfLines={1}>
                        · {ex}
                      </Text>
                    ))}
                  </View>
                )}
              </Pressable>
              <Pressable style={styles.startBtn} onPress={() => {}} accessibilityRole="button">
                <Text style={styles.startBtnText}>EMPEZAR RUTINA</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
