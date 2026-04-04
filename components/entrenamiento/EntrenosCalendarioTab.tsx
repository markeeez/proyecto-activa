/**
 * Tab Entrenos — rejilla semanal 2×4 sin scroll (7 días + resumen).
 */

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';

const WEEK_NAV_H = 52;
const GRID_GAP = 6;
const GRID_PADDING = 8;

export type DiaSemanaEntreno = {
  corto: string;
  fecha: Date;
  diaNum: number;
  tieneEntreno: boolean;
  esHoy: boolean;
};

type Props = {
  dias: DiaSemanaEntreno[];
  etiquetaSemana: string;
  onSemanaAnterior: () => void;
  onSemanaSiguiente: () => void;
  resumenSemanal: { sesiones: number; minutos: number; volumen: string };
  /** Altura del área de contenido (debajo de la cabecera global), para reparto fijo de filas. */
  contentHeight: number;
};

function makeStyles(
  c: Theme,
  f: ReturnType<typeof useTheme>['f'],
  ts: ReturnType<typeof useTheme>['ts'],
  s: ReturnType<typeof useTheme>['s'],
  r: ReturnType<typeof useTheme>['r'],
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      minHeight: 0,
      paddingHorizontal: s.md,
      paddingBottom: s.sm,
    },
    weekRow: {
      height: WEEK_NAV_H,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: s.xs,
    },
    weekNavBtn: {
      width: 40,
      height: 40,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.technical,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    weekLabel: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.6,
    },
    grid: {
      flexDirection: 'column',
      gap: GRID_GAP,
      padding: GRID_PADDING,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.lg,
      backgroundColor: c.surface,
    },
    row: {
      flexDirection: 'row',
      gap: GRID_GAP,
    },
    cell: {
      flex: 1,
      minWidth: 0,
      minHeight: 0,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: r.sm,
      backgroundColor: c.surfaceElevated,
      paddingHorizontal: s.sm,
      paddingVertical: s.xs,
      justifyContent: 'space-between',
    },
    cellHoy: {
      borderColor: c.primary,
      borderWidth: 1,
    },
    cellResumen: {
      justifyContent: 'center',
      gap: s.xs,
    },
    diaCorto: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.5,
    },
    diaNum: {
      ...ts.heading,
      fontFamily: f.monoBold,
      color: c.textDisplay,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.primary,
      alignSelf: 'flex-end',
    },
    dotOff: {
      backgroundColor: c.textMuted,
      opacity: 0.35,
    },
    resumenTitle: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.primary,
      letterSpacing: 0.7,
    },
    resumenLine: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.text,
    },
    resumenMono: {
      ...ts.bodySm,
      fontFamily: f.monoBold,
      color: c.textDisplay,
    },
  });
}

export function EntrenosCalendarioTab({
  dias,
  etiquetaSemana,
  onSemanaAnterior,
  onSemanaSiguiente,
  resumenSemanal,
  contentHeight,
}: Props) {
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const innerH = Math.max(0, contentHeight - WEEK_NAV_H - s.md);
  const rowH = Math.max(48, (innerH - GRID_PADDING * 2 - GRID_GAP * 3) / 4);

  const celdas = useMemo(() => {
    const ordered = [...dias.slice(0, 7)];
    while (ordered.length < 7) {
      ordered.push({
        corto: '—',
        fecha: new Date(),
        diaNum: 0,
        tieneEntreno: false,
        esHoy: false,
      });
    }
    const rows: (DiaSemanaEntreno | 'resumen')[][] = [];
    for (let r = 0; r < 3; r++) {
      rows.push([ordered[r * 2], ordered[r * 2 + 1]]);
    }
    rows.push([ordered[6], 'resumen']);
    return rows;
  }, [dias]);

  return (
    <View style={styles.root}>
      <View style={styles.weekRow}>
        <Pressable style={styles.weekNavBtn} onPress={onSemanaAnterior} accessibilityRole="button">
          <Ionicons name="chevron-back" size={22} color={c.textDisplay} />
        </Pressable>
        <Text style={styles.weekLabel} numberOfLines={1}>
          {etiquetaSemana.toUpperCase()}
        </Text>
        <Pressable style={styles.weekNavBtn} onPress={onSemanaSiguiente} accessibilityRole="button">
          <Ionicons name="chevron-forward" size={22} color={c.textDisplay} />
        </Pressable>
      </View>

      <View style={[styles.grid, { height: innerH }]}>
        {celdas.map((pair, rowIndex) => (
          <View key={rowIndex} style={[styles.row, { height: rowH }]}>
            {pair.map((item, colIndex) => {
              if (item === 'resumen') {
                return (
                  <View
                    key="resumen"
                    style={[styles.cell, styles.cellResumen, { minHeight: rowH }]}
                  >
                    <Text style={styles.resumenTitle}>RESUMEN SEMANAL</Text>
                    <Text style={styles.resumenLine}>
                      Sesiones: <Text style={styles.resumenMono}>{resumenSemanal.sesiones}</Text>
                    </Text>
                    <Text style={styles.resumenLine}>
                      Tiempo: <Text style={styles.resumenMono}>{resumenSemanal.minutos} min</Text>
                    </Text>
                    <Text style={styles.resumenLine} numberOfLines={1}>
                      Vol. <Text style={styles.resumenMono}>{resumenSemanal.volumen}</Text>
                    </Text>
                  </View>
                );
              }
              const d = item;
              return (
                <Pressable
                  key={`${d.corto}-${d.diaNum}-${colIndex}`}
                  style={[
                    styles.cell,
                    d.esHoy && styles.cellHoy,
                    { minHeight: rowH },
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.diaCorto}>{d.corto}</Text>
                  <Text style={styles.diaNum}>{d.diaNum > 0 ? d.diaNum : '—'}</Text>
                  <View style={[styles.dot, !d.tieneEntreno && styles.dotOff]} />
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
