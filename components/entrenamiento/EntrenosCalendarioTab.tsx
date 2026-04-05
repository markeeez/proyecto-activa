/**
 * Tab Entrenos — rejilla semanal 2×4 sin scroll (7 días + resumen).
 * Datos de sesiones desde Supabase por semana visible.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Theme } from '@/constants/theme';
import { useEntreno } from '@/context/EntrenoContext';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  entrenamientoService,
  type SesionResumen,
} from '@/services/entrenamiento.service';

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
  /** Ignorado: el resumen se calcula con datos reales de Supabase. */
  resumenSemanal: { sesiones: number; minutos: number; volumen: string };
  /** Altura del área de contenido (debajo de la cabecera global), para reparto fijo de filas. */
  contentHeight: number;
};

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, n: number): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + n);
  return x;
}

function formatearTiempoSemanaTotal(totalMin: number): string {
  if (totalMin <= 0) return '0 min';
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function formatearVolumenResumen(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  return `${kg.toFixed(1)} kg`;
}

function formatearDuracionTarjeta(hora_inicio: string | null, hora_fin: string | null): string {
  if (hora_fin == null) return 'En curso';
  const m = entrenamientoService.calcularDuracionMinutos(hora_inicio, hora_fin);
  if (m <= 0) return '< 1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (rest === 0) return `${h}h`;
  return `${h}h ${rest}min`;
}

function mesAbrevEs(fecha: Date): string {
  return fecha
    .toLocaleDateString('es-ES', { month: 'short' })
    .replace(/\.$/, '')
    .toLowerCase();
}

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
    weekRowCenter: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.sm,
      minWidth: 0,
      paddingHorizontal: s.xs,
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
      flexShrink: 1,
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
      position: 'relative',
      minWidth: 0,
      minHeight: 80,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: r.sm,
      backgroundColor: c.surfaceElevated,
      overflow: 'hidden',
    },
    cellHoy: {
      borderColor: c.primary,
      borderWidth: 1,
    },
    cellResumen: {
      flexDirection: 'column',
      justifyContent: 'center',
      gap: s.xs,
    },
    cellLeft: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 36,
      flexDirection: 'column',
      justifyContent: 'space-between',
      paddingLeft: s.xs,
      paddingVertical: s.xs,
    },
    cellRight: {
      position: 'absolute',
      left: 40,
      right: 0,
      top: 0,
      bottom: 0,
    },
    diaCorto: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.5,
    },
    diaNumDisplay: {
      ...ts.displayMd,
      fontFamily: f.sansMedium,
      fontSize: 26,
      lineHeight: 30,
      color: c.textDisplay,
      letterSpacing: -0.2,
    },
    mesCorto: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.5,
    },
    sessionCard: {
      backgroundColor: c.surfaceElevated,
      borderRadius: r.technical,
      borderLeftWidth: 2,
      borderLeftColor: c.primary,
      paddingVertical: 4,
      paddingHorizontal: s.sm,
    },
    sessionCardInner: {
      flexDirection: 'column',
    },
    sessionCardNombre: {
      ...ts.caption,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    sessionCardDur: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginTop: 2,
      minWidth: 0,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      padding: s.md,
    },
    modalCard: {
      backgroundColor: c.surface,
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.borderVisible,
      padding: s.md,
      maxWidth: 400,
      width: '100%',
      alignSelf: 'center',
    },
    modalTitle: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      marginBottom: s.sm,
    },
    modalBody: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.text,
      marginBottom: s.md,
    },
    modalActions: {
      gap: s.sm,
    },
    modalBtnPrimary: {
      paddingVertical: s.sm,
      paddingHorizontal: s.md,
      borderRadius: r.technical,
      backgroundColor: c.primary,
      alignItems: 'center',
    },
    modalBtnPrimaryTxt: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textOnPrimary,
      letterSpacing: 0.6,
    },
    modalBtnDanger: {
      paddingVertical: s.sm,
      paddingHorizontal: s.md,
      borderRadius: r.technical,
      borderWidth: 1,
      borderColor: c.danger,
      backgroundColor: c.surface,
      alignItems: 'center',
    },
    modalBtnDangerTxt: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.danger,
      letterSpacing: 0.6,
    },
    modalBtnGhost: {
      paddingVertical: s.sm,
      paddingHorizontal: s.md,
      borderRadius: r.technical,
      alignItems: 'center',
    },
    modalBtnGhostTxt: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textSecondary,
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
  resumenSemanal: _resumenSemanalIgnorado,
  contentHeight,
}: Props) {
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);
  const { user } = useAuth();
  const router = useRouter();
  const { reload: reloadParam } = useLocalSearchParams<{ reload?: string }>();
  const reload = Array.isArray(reloadParam) ? reloadParam[0] : reloadParam;
  const { entrenoActivo, recuperarEntreno } = useEntreno();

  const [sesionesSemana, setSesionesSemana] = useState<SesionResumen[]>([]);
  const [volumenKg, setVolumenKg] = useState(0);
  const [cargandoSemana, setCargandoSemana] = useState(false);
  const [semanaRecarga, setSemanaRecarga] = useState(0);
  const [modalRecuperacion, setModalRecuperacion] = useState<SesionResumen | null>(null);
  const [recuperando, setRecuperando] = useState(false);
  const reqIdRef = useRef(0);

  const lunesKey = dias[0]?.fecha?.getTime() ?? 0;
  const rangoSemana = useMemo(() => {
    if (!dias[0]?.fecha) return null;
    const lunes = dias[0].fecha;
    const ini = toYmd(lunes);
    const fin = toYmd(addDays(lunes, 6));
    return { ini, fin };
  }, [lunesKey, dias]);

  useEffect(() => {
    if (!user?.id || !rangoSemana) {
      setSesionesSemana([]);
      setVolumenKg(0);
      setCargandoSemana(false);
      return;
    }

    const myId = ++reqIdRef.current;
    setCargandoSemana(true);
    const { ini, fin } = rangoSemana;

    (async () => {
      const [sesiones, vol] = await Promise.all([
        entrenamientoService.obtenerSesionesSemana(user.id, ini, fin),
        entrenamientoService.obtenerVolumenSemanaKg(user.id, ini, fin),
      ]);
      if (myId !== reqIdRef.current) return;
      setSesionesSemana(sesiones);
      setVolumenKg(vol);
      setCargandoSemana(false);
    })();
  }, [user?.id, rangoSemana?.ini, rangoSemana?.fin, semanaRecarga]);

  useEffect(() => {
    if (reload) setSemanaRecarga((n) => n + 1);
  }, [reload]);

  const sesionesPorFecha = useMemo(() => {
    const m = new Map<string, SesionResumen[]>();
    for (const s of sesionesSemana) {
      const list = m.get(s.fecha) ?? [];
      list.push(s);
      m.set(s.fecha, list);
    }
    return m;
  }, [sesionesSemana]);

  const resumenReal = useMemo(() => {
    const sesiones = sesionesSemana.length;
    let minutos = 0;
    for (const s of sesionesSemana) {
      minutos += entrenamientoService.calcularDuracionMinutos(s.hora_inicio, s.hora_fin);
    }
    return {
      sesiones,
      minutosLabel: formatearTiempoSemanaTotal(minutos),
      volumen: formatearVolumenResumen(volumenKg),
    };
  }, [sesionesSemana, volumenKg]);

  const innerH = Math.max(0, contentHeight - WEEK_NAV_H - s.md);
  const rowH = Math.max(80, (innerH - GRID_PADDING * 2 - GRID_GAP * 3) / 4);

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
    for (let i = 0; i < 3; i++) {
      rows.push([ordered[i * 2], ordered[i * 2 + 1]]);
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
        <View style={styles.weekRowCenter}>
          <Text style={styles.weekLabel} numberOfLines={1}>
            {etiquetaSemana.toUpperCase()}
          </Text>
          {cargandoSemana ? <ActivityIndicator size="small" color={c.primary} /> : null}
        </View>
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
                      Sesiones: <Text style={styles.resumenMono}>{resumenReal.sesiones}</Text>
                    </Text>
                    <Text style={styles.resumenLine}>
                      Tiempo: <Text style={styles.resumenMono}>{resumenReal.minutosLabel}</Text>
                    </Text>
                    <Text style={styles.resumenLine} numberOfLines={1}>
                      Vol. <Text style={styles.resumenMono}>{resumenReal.volumen}</Text>
                    </Text>
                  </View>
                );
              }
              const d = item;
              if (d.diaNum <= 0) {
                return (
                  <View
                    key={`empty-${colIndex}`}
                    style={[styles.cell, { height: rowH, minHeight: 80 }]}
                  />
                );
              }

              const ymd = toYmd(d.fecha);
              const sesionesDia = sesionesPorFecha.get(ymd) ?? [];

              return (
                <View
                  key={`${d.corto}-${d.diaNum}-${colIndex}`}
                  style={[styles.cell, d.esHoy && styles.cellHoy, { height: rowH, minHeight: 80 }]}
                >
                  <View style={styles.cellLeft}>
                    <Text style={styles.diaCorto}>{d.corto}</Text>
                    <Text style={styles.diaNumDisplay}>{d.diaNum}</Text>
                    <Text style={styles.mesCorto}>{mesAbrevEs(d.fecha)}</Text>
                  </View>
                  <ScrollView
                    style={styles.cellRight}
                    contentContainerStyle={{ gap: 4, paddingVertical: s.xs, paddingRight: s.xs }}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {sesionesDia.map((sess) => (
                      <Pressable
                        key={sess.id}
                        style={styles.sessionCard}
                        onPress={() => {
                          if (sess.hora_fin != null) {
                            router.push({
                              pathname: '/(tabs)/(entrenamiento)/sesion/[id]',
                              params: { id: sess.id },
                            });
                            return;
                          }
                          if (entrenoActivo != null && entrenoActivo.sessionId === sess.id) {
                            router.push('/(tabs)/(entrenamiento)/entreno-activo');
                            return;
                          }
                          setModalRecuperacion(sess);
                        }}
                        accessibilityRole="button"
                      >
                        <View style={styles.sessionCardInner}>
                          <Text
                            style={styles.sessionCardNombre}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {(sess.nombre ?? 'Entreno').trim() || 'Entreno'}
                          </Text>
                          <Text style={styles.sessionCardDur} numberOfLines={1}>
                            {formatearDuracionTarjeta(sess.hora_inicio, sess.hora_fin)}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <Modal
        visible={modalRecuperacion != null}
        transparent
        animationType="fade"
        onRequestClose={() => !recuperando && setModalRecuperacion(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Entreno en curso</Text>
            <Text style={styles.modalBody}>
              Tienes un entreno &apos;{(modalRecuperacion?.nombre ?? 'Entreno').trim() || 'Entreno'}&apos; que no fue
              finalizado. ¿Qué quieres hacer?
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalBtnPrimary}
                disabled={recuperando}
                onPress={async () => {
                  if (!modalRecuperacion) return;
                  setRecuperando(true);
                  try {
                    await recuperarEntreno(modalRecuperacion.id);
                    setModalRecuperacion(null);
                  } finally {
                    setRecuperando(false);
                  }
                }}
              >
                <Text style={styles.modalBtnPrimaryTxt}>CONTINUAR ENTRENO</Text>
              </Pressable>
              <Pressable
                style={styles.modalBtnDanger}
                disabled={recuperando}
                onPress={async () => {
                  if (!modalRecuperacion) return;
                  setRecuperando(true);
                  try {
                    await entrenamientoService.descartarSesionHuerfana(modalRecuperacion.id);
                    setModalRecuperacion(null);
                    setSemanaRecarga((n) => n + 1);
                  } finally {
                    setRecuperando(false);
                  }
                }}
              >
                <Text style={styles.modalBtnDangerTxt}>DESCARTAR ENTRENO</Text>
              </Pressable>
              <Pressable
                style={styles.modalBtnGhost}
                disabled={recuperando}
                onPress={() => setModalRecuperacion(null)}
              >
                <Text style={styles.modalBtnGhostTxt}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
