/**
 * CalendarioNutricion — Modal con grid mensual y puntitos por estado del día.
 *
 * - Grid Lun→Dom con las celdas vacías al principio/fin para cuadrar la rejilla.
 * - Puntito de color por día según `estadoPorFecha` (success/warning/danger/muted).
 * - Bloquea navegación a meses futuros (chevron derecho deshabilitado).
 * - Días futuros se pintan apagados y no son seleccionables.
 * - Selección: cierra el modal y devuelve la fecha al padre.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NutritionCalendarShareModal } from '@/components/nutricion/NutritionCalendarShareModal';
import type { Theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useResumenMes } from '@/hooks/useResumenMes';
import { useTheme } from '@/hooks/useTheme';
import {
  añadirMeses,
  esMesFuturo,
  fechaHoyIsoLocal,
  formatMesAñoES,
  getGridMes,
  parseFechaLocal,
} from '@/lib/fechaNutricion';
import type { EstadoDiaNutricion } from '@/lib/nutricionEstadoDia';
import type { UserGoal } from '@/types/database.types';

export type CalendarioNutricionProps = {
  visible: boolean;
  /** Fecha actualmente seleccionada en la pantalla principal (ISO YYYY-MM-DD). */
  fechaActual: string;
  /** Objetivos del usuario (lo trae el padre vía useNutricion para no duplicar fetch). */
  objetivos: UserGoal | null;
  onClose: () => void;
  onSeleccionarDia: (fechaIso: string) => void;
};

const DIAS_CABECERA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

function textoCompartirCalendarioNutricion(
  tituloMes: string,
  estadoPorFecha: Map<string, EstadoDiaNutricion>,
): string {
  let dentro = 0;
  let cerca = 0;
  let sobre = 0;
  estadoPorFecha.forEach((estado) => {
    if (estado === 'dentro') dentro += 1;
    if (estado === 'cerca') cerca += 1;
    if (estado === 'sobre') sobre += 1;
  });
  return `Calendario de alimentación - ${tituloMes}\nDentro del objetivo: ${dentro}\nCerca del límite: ${cerca}\nSobre el objetivo: ${sobre}`;
}

export function CalendarioNutricion({
  visible,
  fechaActual,
  objetivos,
  onClose,
  onSeleccionarDia,
}: CalendarioNutricionProps) {
  const { c, f, ts, s, r, isDark } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);
  const [modalShare, setModalShare] = useState(false);

  // El mes mostrado arranca en el de la fecha actual; cambia con las flechas.
  const [mesVista, setMesVista] = useState(() => {
    const d = parseFechaLocal(fechaActual);
    return { año: d.getFullYear(), mesIndex: d.getMonth() };
  });

  // Cuando se abre el modal, sincroniza el mes con la fecha actual.
  useEffect(() => {
    if (!visible) return;
    const d = parseFechaLocal(fechaActual);
    setMesVista({ año: d.getFullYear(), mesIndex: d.getMonth() });
  }, [visible, fechaActual]);

  const { estadoPorFecha, cargando } = useResumenMes(
    mesVista.año,
    mesVista.mesIndex,
    objetivos,
  );

  const grid = useMemo(
    () => getGridMes(mesVista.año, mesVista.mesIndex),
    [mesVista.año, mesVista.mesIndex],
  );

  const tituloMes = formatMesAñoES(mesVista.año, mesVista.mesIndex);
  const hoyIso = fechaHoyIsoLocal();
  const mesShare = useMemo(
    () => new Date(mesVista.año, mesVista.mesIndex, 1),
    [mesVista.año, mesVista.mesIndex],
  );
  const fallbackMessageShare = useMemo(
    () => textoCompartirCalendarioNutricion(tituloMes, estadoPorFecha),
    [tituloMes, estadoPorFecha],
  );
  const mesSiguiente = useMemo(
    () => añadirMeses(mesVista.año, mesVista.mesIndex, 1),
    [mesVista.año, mesVista.mesIndex],
  );
  const sigueMesFuturo = esMesFuturo(mesSiguiente.año, mesSiguiente.mesIndex);

  const irMesAnterior = () => {
    setMesVista((m) => añadirMeses(m.año, m.mesIndex, -1));
  };
  const irMesSiguiente = () => {
    if (sigueMesFuturo) return;
    setMesVista((m) => añadirMeses(m.año, m.mesIndex, 1, true));
  };

  const colorEstado = (estado: EstadoDiaNutricion | undefined): string => {
    switch (estado) {
      case 'dentro':
        return c.success;
      case 'cerca':
        return c.warning;
      case 'sobre':
        return c.danger;
      default:
        return c.textMuted;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header con título de la pantalla y botón de cerrar */}
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>Selecciona una fecha</Text>
              <Text style={styles.subtitle}>Consulta tu alimentación de cualquier día</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Cerrar calendario"
            >
              <Ionicons name="close" size={20} color={c.textDisplay} />
            </Pressable>
          </View>

          {/* Navegación de mes */}
          <View style={styles.monthNav}>
            <Pressable
              onPress={irMesAnterior}
              hitSlop={8}
              style={styles.navBtn}
              accessibilityRole="button"
              accessibilityLabel="Mes anterior"
            >
              <Ionicons name="chevron-back" size={18} color={c.textDisplay} />
            </Pressable>

            <View style={styles.monthLabelWrap}>
              <Ionicons name="calendar-outline" size={14} color={c.primary} />
              <Text style={styles.monthLabel}>{tituloMes}</Text>
              {cargando ? (
                <ActivityIndicator size="small" color={c.primary} style={styles.loader} />
              ) : null}
            </View>

            <Pressable
              onPress={irMesSiguiente}
              hitSlop={8}
              style={[styles.navBtn, sigueMesFuturo && styles.navBtnDisabled]}
              disabled={sigueMesFuturo}
              accessibilityRole="button"
              accessibilityLabel="Mes siguiente"
              accessibilityState={{ disabled: sigueMesFuturo }}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={sigueMesFuturo ? c.textMuted : c.textDisplay}
              />
            </Pressable>
          </View>

          {/* Cabecera L M X J V S D */}
          <View style={styles.weekHeader}>
            {DIAS_CABECERA.map((d) => (
              <Text key={d} style={styles.weekHeaderLetter}>
                {d}
              </Text>
            ))}
          </View>

          {/* Grid de días */}
          <View style={styles.grid}>
            {grid.map((celda, i) => {
              if (!celda) {
                return <View key={`empty-${i}`} style={styles.dayCellEmpty} />;
              }

              const estado = estadoPorFecha.get(celda.fechaIso);
              const esHoy = celda.fechaIso === hoyIso;
              const esActivo = celda.fechaIso === fechaActual;
              const esFuturo = celda.esFuturo;

              return (
                <Pressable
                  key={celda.fechaIso}
                  style={styles.dayCellPress}
                  disabled={esFuturo}
                  onPress={() => onSeleccionarDia(celda.fechaIso)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: esActivo, disabled: esFuturo }}
                  accessibilityLabel={`Día ${celda.dia}`}
                >
                  <View
                    style={[
                      styles.dayCell,
                      esActivo && styles.dayCellActive,
                      esHoy && !esActivo && styles.dayCellHoy,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        esActivo && styles.dayNumberActive,
                        esFuturo && styles.dayNumberFuturo,
                      ]}
                    >
                      {celda.dia}
                    </Text>
                    {!esFuturo && estado ? (
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: esActivo ? c.textOnPrimary : colorEstado(estado) },
                        ]}
                      />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Leyenda */}
          <View style={styles.legendCard}>
            <Text style={styles.legendTitle}>Estado del día</Text>
            <View style={styles.legendRow}>
              <LegendItem styles={styles} color={c.success} label="Dentro del objetivo" hint="-5% a +5%" />
              <LegendItem styles={styles} color={c.warning} label="Cerca del límite" hint="< -5% o +5% a +15%" />
              <LegendItem styles={styles} color={c.danger} label="Sobre el objetivo" hint="> +15%" />
              <LegendItem styles={styles} color={c.textMuted} label="Sin datos" />
            </View>
            <Pressable
              style={({ pressed }) => [styles.legendShareButton, pressed && { opacity: 0.7 }]}
              onPress={() => setModalShare(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Compartir calendario de nutrición"
            >
              <Ionicons name="share-outline" size={18} color={c.primary} />
            </Pressable>
          </View>
        </View>
      </View>

      <NutritionCalendarShareModal
        visible={modalShare}
        onClose={() => setModalShare(false)}
        mes={mesShare}
        estadoPorFecha={estadoPorFecha}
        user={user}
        initialDark={isDark}
        fallbackMessage={fallbackMessageShare}
      />
    </Modal>
  );
}

function LegendItem({
  styles,
  color,
  label,
  hint,
}: {
  styles: ReturnType<typeof makeStyles>;
  color: string;
  label: string;
  hint?: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <View style={styles.legendTextBlock}>
        <Text style={styles.legendLabel}>{label}</Text>
        {hint ? <Text style={styles.legendHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

function makeStyles(
  c: Theme,
  f: ReturnType<typeof useTheme>['f'],
  ts: ReturnType<typeof useTheme>['ts'],
  s: ReturnType<typeof useTheme>['s'],
  r: ReturnType<typeof useTheme>['r'],
) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      paddingHorizontal: s.md,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.borderVisible,
      padding: s.md,
      gap: s.md,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: s.sm,
    },
    titleBlock: {
      flex: 1,
      gap: 2,
    },
    title: {
      ...ts.subheading,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      letterSpacing: -0.2,
    },
    subtitle: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.textMuted,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: s.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.sm,
      paddingHorizontal: s.sm,
      paddingVertical: s.xs,
      backgroundColor: c.surfaceElevated,
    },
    navBtn: {
      width: 30,
      height: 30,
      borderRadius: r.technical,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navBtnDisabled: {
      opacity: 0.35,
    },
    monthLabelWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    monthLabel: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      letterSpacing: -0.1,
    },
    loader: {
      marginLeft: 4,
    },
    weekHeader: {
      flexDirection: 'row',
    },
    weekHeaderLetter: {
      flex: 1,
      textAlign: 'center',
      fontSize: 11,
      lineHeight: 14,
      fontFamily: f.mono,
      color: c.textMuted,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: 4,
    },
    dayCellEmpty: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
    },
    dayCellPress: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 2,
    },
    dayCell: {
      width: '88%',
      maxWidth: 44,
      aspectRatio: 1,
      borderRadius: r.sm,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    },
    dayCellActive: {
      backgroundColor: c.primary,
    },
    dayCellHoy: {
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    dayNumber: {
      fontSize: 14,
      lineHeight: 17,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      letterSpacing: -0.2,
    },
    dayNumberActive: {
      color: c.textOnPrimary,
      fontFamily: f.sansBold,
    },
    dayNumberFuturo: {
      color: c.textMuted,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 999,
    },
    legendCard: {
      position: 'relative',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borderVisible,
      paddingTop: s.sm,
      paddingRight: 38,
      gap: s.xs,
    },
    legendTitle: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
    },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: s.xs,
      columnGap: s.sm,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: '46%',
    },
    legendDot: {
      width: 7,
      height: 7,
      borderRadius: 999,
    },
    legendTextBlock: {
      flexShrink: 1,
    },
    legendLabel: {
      ...ts.caption,
      fontSize: 11,
      lineHeight: 14,
      fontFamily: f.sansMedium,
      color: c.text,
    },
    legendHint: {
      fontSize: 9,
      lineHeight: 11,
      fontFamily: f.mono,
      color: c.textMuted,
      letterSpacing: 0.4,
    },
    legendShareButton: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 32,
      height: 32,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
