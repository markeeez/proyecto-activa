/**
 * PANTALLA: Entreno.
 * Rediseño visual de la pestaña Entrenos con semana vertical de 7 días.
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RutinasListadoTab } from '@/components/entrenamiento/RutinasListadoTab';
import { useEntreno } from '@/context/EntrenoContext';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  entrenamientoService,
  type DetalleSesion,
  type SesionResumen,
} from '@/services/entrenamiento.service';

type TabEntreno = 'entrenos' | 'rutinas';

type DiaSemana = {
  corto: string;
  fecha: Date;
  diaNum: number;
  esHoy: boolean;
};

type SesionVista = SesionResumen & {
  ejercicios: number;
  series: number;
  volumenKg: number;
  duracionMin: number;
  duracionSegundos: number;
};

const ACCENT = '#00B4D8';

type WorkoutPalette = {
  bg: string;
  surface: string;
  surfaceSoft: string;
  surfacePressed: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  dayCircle: string;
  dayDot: string;
  chevron: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  modalBackdrop: string;
  danger: string;
  dangerText: string;
  primaryText: string;
};

const DIAS_CORTO = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

function inicioSemanaLunes(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(base: Date, n: number): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + n);
  return x;
}

function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function etiquetaRangoSemana(lunes: Date): string {
  const domingo = addDays(lunes, 6);
  const fmt = (d: Date) =>
    d
      .toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
      .replace(/\./g, '')
      .toUpperCase();
  return `${fmt(lunes)} – ${fmt(domingo)}`;
}

function formatearTiempo(totalMin: number, mostrarMenorQueUno = false): string {
  if (totalMin <= 0) return mostrarMenorQueUno ? '< 1 min' : '0 min';
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function calcularDuracionSegundos(horaInicio: string | null, horaFin: string | null): number {
  if (!horaInicio || !horaFin) return 0;
  const inicioMs = new Date(horaInicio).getTime();
  const finMs = new Date(horaFin).getTime();
  if (Number.isNaN(inicioMs) || Number.isNaN(finMs) || finMs <= inicioMs) return 0;
  return Math.max(1, Math.round((finMs - inicioMs) / 1000));
}

function formatearTiempoSegundos(totalSegundos: number, mostrarMenorQueUno = false): string {
  if (totalSegundos <= 0) return mostrarMenorQueUno ? '< 1 min' : '0 min';
  if (totalSegundos < 60) return `${totalSegundos} s`;

  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;
  if (minutos < 60) return segundos === 0 ? `${minutos} min` : `${minutos} min ${segundos} s`;

  const horas = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;
  return minutosRestantes === 0 ? `${horas} h` : `${horas} h ${minutosRestantes} min`;
}

function formatearDuracionSesion(sesion: SesionVista): string {
  if (sesion.duracionSegundos > 0) return formatearTiempoSegundos(sesion.duracionSegundos, true);
  if (!sesion.hora_inicio || !sesion.hora_fin) return formatearTiempo(sesion.duracionMin, true);
  const inicioMs = new Date(sesion.hora_inicio).getTime();
  const finMs = new Date(sesion.hora_fin).getTime();
  if (Number.isNaN(inicioMs) || Number.isNaN(finMs) || finMs <= inicioMs) {
    return formatearTiempo(sesion.duracionMin, true);
  }

  return formatearTiempoSegundos(Math.max(1, Math.round((finMs - inicioMs) / 1000)), true);
}

function formatearVolumen(kg: number): string {
  const rounded = Math.round(kg);
  return `${rounded.toLocaleString('es-ES')} kg`;
}

function contarDetalle(detalle: DetalleSesion | null, sesion: SesionResumen): SesionVista {
  const duracionMin = entrenamientoService.calcularDuracionMinutos(sesion.hora_inicio, sesion.hora_fin);
  const duracionSegundos = calcularDuracionSegundos(sesion.hora_inicio, sesion.hora_fin);
  let series = 0;
  let volumenKg = 0;

  for (const ejercicio of detalle?.ejercicios ?? []) {
    for (const set of ejercicio.sets) {
      if (!set.completada) continue;
      series += 1;
      const peso = set.peso_kg != null ? Number(set.peso_kg) : 0;
      const reps = set.repeticiones != null ? Number(set.repeticiones) : 0;
      volumenKg += peso * reps;
    }
  }

  return {
    ...sesion,
    ejercicios: detalle?.ejercicios.length ?? 0,
    series,
    volumenKg,
    duracionMin,
    duracionSegundos,
  };
}

function ordenarSesionesDia(a: SesionVista, b: SesionVista): number {
  const ta = a.hora_inicio ? new Date(a.hora_inicio).getTime() : 0;
  const tb = b.hora_inicio ? new Date(b.hora_inicio).getTime() : 0;
  return ta - tb;
}

function crearPaletaEntrenos(c: ReturnType<typeof useTheme>['c']): WorkoutPalette {
  const isDark = c.background === '#000000' || c.textDisplay === '#FFFFFF';
  const accent = c.primary || ACCENT;

  if (isDark) {
    return {
      bg: '#0D0D0D',
      surface: '#1A1A1A',
      surfaceSoft: '#141414',
      surfacePressed: '#101010',
      text: '#FFFFFF',
      textSecondary: '#888888',
      textMuted: '#5F5F5F',
      border: '#2A2A2A',
      dayCircle: '#171717',
      dayDot: '#3D3D3D',
      chevron: '#C8C8C8',
      accent,
      accentSoft: 'rgba(0, 180, 216, 0.16)',
      accentBorder: 'rgba(0, 180, 216, 0.45)',
      modalBackdrop: 'rgba(0,0,0,0.68)',
      danger: '#D71921',
      dangerText: '#F08080',
      primaryText: '#001015',
    };
  }

  return {
    bg: '#F5F5F5',
    surface: '#FFFFFF',
    surfaceSoft: '#FFFFFF',
    surfacePressed: '#F0F0F0',
    text: '#0F0F0F',
    textSecondary: '#666666',
    textMuted: '#999999',
    border: '#D8D8D8',
    dayCircle: '#F7F7F7',
    dayDot: '#C8C8C8',
    chevron: '#555555',
    accent,
    accentSoft: 'rgba(0, 180, 216, 0.12)',
    accentBorder: 'rgba(0, 180, 216, 0.42)',
    modalBackdrop: 'rgba(0,0,0,0.32)',
    danger: '#D71921',
    dangerText: '#B00020',
    primaryText: '#001015',
  };
}

export default function EntrenamientoIndex() {
  const { c, f } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { reload: reloadParam } = useLocalSearchParams<{ reload?: string }>();
  const reload = Array.isArray(reloadParam) ? reloadParam[0] : reloadParam;
  const { entrenoActivo, recuperarEntreno } = useEntreno();

  const [tab, setTab] = useState<TabEntreno>('entrenos');
  const [lunesSemana, setLunesSemana] = useState(() => inicioSemanaLunes(new Date()));
  const [sesionesSemana, setSesionesSemana] = useState<SesionVista[]>([]);
  const [cargandoSemana, setCargandoSemana] = useState(false);
  const [semanaRecarga, setSemanaRecarga] = useState(0);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [diasHeight, setDiasHeight] = useState(0);
  const [modalRecuperacion, setModalRecuperacion] = useState<SesionResumen | null>(null);
  const [recuperando, setRecuperando] = useState(false);
  const reqIdRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (entrenoActivo != null && tab === 'rutinas') {
        router.replace('/(tabs)/(entrenamiento)/entreno-activo');
      }
    }, [entrenoActivo, tab, router]),
  );

  const hoy = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const diasSemana: DiaSemana[] = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const fecha = addDays(lunesSemana, i);
        return {
          corto: DIAS_CORTO[i],
          fecha,
          diaNum: fecha.getDate(),
          esHoy: mismoDia(fecha, hoy),
        };
      }),
    [lunesSemana, hoy],
  );

  const rangoSemana = useMemo(() => {
    const ini = toYmd(lunesSemana);
    const fin = toYmd(addDays(lunesSemana, 6));
    return { ini, fin };
  }, [lunesSemana]);

  useEffect(() => {
    if (!user?.id) {
      setSesionesSemana([]);
      setCargandoSemana(false);
      return;
    }

    const myId = ++reqIdRef.current;
    setCargandoSemana(true);

    (async () => {
      const sesiones = await entrenamientoService.obtenerSesionesSemana(user.id, rangoSemana.ini, rangoSemana.fin);
      const sesionesConDetalle = await Promise.all(
        sesiones.map(async (sesion) => {
          const detalle = await entrenamientoService.obtenerDetalleSesion(sesion.id);
          return contarDetalle(detalle, sesion);
        }),
      );

      if (myId !== reqIdRef.current) return;
      setSesionesSemana(sesionesConDetalle);
      setCargandoSemana(false);
    })();
  }, [user?.id, rangoSemana.ini, rangoSemana.fin, semanaRecarga]);

  useEffect(() => {
    if (reload) setSemanaRecarga((n) => n + 1);
  }, [reload]);

  const sesionesPorFecha = useMemo(() => {
    const map = new Map<string, SesionVista[]>();
    for (const sesion of sesionesSemana) {
      const list = map.get(sesion.fecha) ?? [];
      list.push(sesion);
      map.set(sesion.fecha, list.sort(ordenarSesionesDia));
    }
    return map;
  }, [sesionesSemana]);

  const resumenSemanal = useMemo(() => {
    let segundos = 0;
    let volumenKg = 0;
    for (const sesion of sesionesSemana) {
      segundos += sesion.duracionSegundos;
      volumenKg += sesion.volumenKg;
    }
    return {
      sesiones: sesionesSemana.length,
      segundos,
      volumenKg,
    };
  }, [sesionesSemana]);

  const onDiasLayout = useCallback((e: LayoutChangeEvent) => {
    setDiasHeight(e.nativeEvent.layout.height);
  }, []);

  const toggleExpanded = useCallback((dateKey: string, sesionesDia: SesionVista[]) => {
    if (sesionesDia.length <= 1) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDate((prev) => (prev === dateKey ? null : dateKey));
  }, []);

  const navegarSesion = useCallback(
    (sesion: SesionResumen) => {
      if (sesion.hora_fin != null) {
        router.push({
          pathname: '/(tabs)/(entrenamiento)/sesion/[id]',
          params: { id: sesion.id },
        });
        return;
      }
      if (entrenoActivo != null && entrenoActivo.sessionId === sesion.id) {
        router.push('/(tabs)/(entrenamiento)/entreno-activo');
        return;
      }
      setModalRecuperacion(sesion);
    },
    [entrenoActivo, router],
  );

  const semanaAnterior = useCallback(() => {
    setExpandedDate(null);
    setLunesSemana((prev) => addDays(prev, -7));
  }, []);

  const semanaSiguiente = useCallback(() => {
    setExpandedDate(null);
    setLunesSemana((prev) => addDays(prev, 7));
  }, []);

  const rowHeight = diasHeight > 0 ? Math.max(56, (diasHeight - 30) / 7) : undefined;
  const palette = useMemo(() => crearPaletaEntrenos(c), [c]);
  const styles = useMemo(() => makeStyles(f, insets.top, palette), [f, insets.top, palette]);

  return (
    <View style={styles.safe}>
      {/* --- HEADER START --- */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Entreno</Text>
            <View style={styles.headerTitleBadge}>
              <MaterialCommunityIcons name="arm-flex-outline" size={15} color={palette.accent} />
            </View>
          </View>
          <Pressable style={styles.headerStatsButton} accessibilityRole="button">
            <Ionicons name="settings-outline" size={20} color={palette.accent} />
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabBtn, tab === 'entrenos' ? styles.tabBtnActive : styles.tabBtnInactive]}
            onPress={() => setTab('entrenos')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'entrenos' }}
          >
            <Ionicons
              name="barbell-outline"
              size={16}
              color={tab === 'entrenos' ? '#FFFFFF' : palette.textSecondary}
            />
            <Text style={[styles.tabText, tab === 'entrenos' ? styles.tabTextActive : styles.tabTextInactive]}>
              ENTRENOS
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, tab === 'rutinas' ? styles.tabBtnActive : styles.tabBtnInactive]}
            onPress={() => {
              if (entrenoActivo != null) {
                router.replace('/(tabs)/(entrenamiento)/entreno-activo');
              } else {
                setTab('rutinas');
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'rutinas' }}
          >
            <Ionicons
              name="document-text-outline"
              size={16}
              color={tab === 'rutinas' ? '#FFFFFF' : palette.textSecondary}
            />
            <Text style={[styles.tabText, tab === 'rutinas' ? styles.tabTextActive : styles.tabTextInactive]}>
              RUTINAS
            </Text>
          </Pressable>
        </View>
      </View>
      {/* --- HEADER END --- */}

      {tab === 'entrenos' ? (
        <View style={styles.screen}>
          <View style={styles.weekNav}>
            <Pressable style={styles.weekButton} onPress={semanaAnterior} accessibilityRole="button">
              <Ionicons name="chevron-back" size={18} color={palette.chevron} />
            </Pressable>
            <View style={styles.weekLabelWrap}>
              <Text style={styles.weekLabel}>{etiquetaRangoSemana(lunesSemana)}</Text>
              {cargandoSemana ? <ActivityIndicator size="small" color={palette.accent} /> : null}
            </View>
            <Pressable style={styles.weekButton} onPress={semanaSiguiente} accessibilityRole="button">
              <Ionicons name="chevron-forward" size={18} color={palette.chevron} />
            </Pressable>
          </View>

          <View style={styles.daysArea} onLayout={onDiasLayout}>
            {expandedDate == null ? (
              <View style={styles.daysBase}>
                {diasSemana.map((dia) => {
                  const dateKey = toYmd(dia.fecha);
                  const sesionesDia = sesionesPorFecha.get(dateKey) ?? [];
                  return (
                    <DayRow
                      key={dateKey}
                      dia={dia}
                      sesiones={sesionesDia}
                      expanded={false}
                      rowHeight={rowHeight}
                      onPress={() => {
                        if (sesionesDia.length > 1) toggleExpanded(dateKey, sesionesDia);
                        else if (sesionesDia[0]) navegarSesion(sesionesDia[0]);
                      }}
                      onSesionPress={navegarSesion}
                      palette={palette}
                      styles={styles}
                    />
                  );
                })}
              </View>
            ) : (
              <ScrollView
                style={styles.daysScroll}
                contentContainerStyle={styles.daysScrollContent}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {diasSemana.map((dia) => {
                  const dateKey = toYmd(dia.fecha);
                  const sesionesDia = sesionesPorFecha.get(dateKey) ?? [];
                  const expanded = expandedDate === dateKey;
                  return (
                    <DayRow
                      key={dateKey}
                      dia={dia}
                      sesiones={sesionesDia}
                      expanded={expanded}
                      rowHeight={rowHeight}
                      onPress={() => {
                        if (sesionesDia.length > 1) toggleExpanded(dateKey, sesionesDia);
                        else if (sesionesDia[0]) navegarSesion(sesionesDia[0]);
                      }}
                      onSesionPress={navegarSesion}
                      palette={palette}
                      styles={styles}
                    />
                  );
                })}
              </ScrollView>
            )}
          </View>

          <WeeklySummary resumen={resumenSemanal} palette={palette} styles={styles} />
        </View>
      ) : (
        <View style={styles.rutinasWrap}>
          <RutinasListadoTab />
        </View>
      )}

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
              Tienes un entreno sin finalizar: {(modalRecuperacion?.nombre ?? 'Entreno').trim() || 'Entreno'}.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalPrimary}
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
                <Text style={styles.modalPrimaryText}>CONTINUAR ENTRENO</Text>
              </Pressable>
              <Pressable
                style={styles.modalDanger}
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
                <Text style={styles.modalDangerText}>DESCARTAR ENTRENO</Text>
              </Pressable>
              <Pressable style={styles.modalGhost} disabled={recuperando} onPress={() => setModalRecuperacion(null)}>
                <Text style={styles.modalGhostText}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --- Subcomponentes UI: fila de día -------------------------------------------------

function DayRow({
  dia,
  sesiones,
  expanded,
  rowHeight,
  onPress,
  onSesionPress,
  palette,
  styles,
}: {
  dia: DiaSemana;
  sesiones: SesionVista[];
  expanded: boolean;
  rowHeight?: number;
  onPress: () => void;
  onSesionPress: (sesion: SesionResumen) => void;
  palette: WorkoutPalette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const ultimoEntreno = sesiones[sesiones.length - 1] ?? null;
  const tieneMultiple = sesiones.length > 1;
  const rowSize = rowHeight ? (expanded ? { minHeight: rowHeight } : { height: rowHeight }) : null;

  return (
    <Pressable
      style={[styles.dayRow, rowSize, expanded && styles.dayRowExpanded]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.dayLeft}>
        <Text style={[styles.dayName, dia.esHoy && styles.dayNameToday]}>{dia.corto}</Text>
        <View style={[styles.dayCircle, dia.esHoy && styles.dayCircleToday]}>
          <Text style={styles.dayNumber}>{dia.diaNum}</Text>
        </View>
        <View style={[styles.dayDot, sesiones.length > 0 && styles.dayDotActive]} />
      </View>

      <View style={styles.dayMain}>
        {ultimoEntreno ? (
          <>
            <View style={styles.titleLine}>
              <Text style={styles.workoutName} numberOfLines={1}>
                {(ultimoEntreno.nombre ?? 'Entreno').trim() || 'Entreno'}
              </Text>
              {tieneMultiple ? (
                <View style={styles.moreBadge}>
                  <Text style={styles.moreBadgeText}>+{sesiones.length - 1}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.workoutMeta} numberOfLines={1}>
              {ultimoEntreno.ejercicios} ejercicios • {formatearDuracionSesion(ultimoEntreno)} • {ultimoEntreno.series}{' '}
              series
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.restTitle}>Descanso</Text>
            <Text style={styles.restMeta}>Sin entrenamiento</Text>
          </>
        )}

        {expanded ? (
          <ScrollView
            style={styles.accordionScroll}
            contentContainerStyle={styles.accordionContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {sesiones.map((sesion) => (
              <Pressable
                key={sesion.id}
                style={styles.accordionItem}
                onPress={() => onSesionPress(sesion)}
                accessibilityRole="button"
              >
                <Text style={styles.accordionTitle} numberOfLines={1}>
                  {(sesion.nombre ?? 'Entreno').trim() || 'Entreno'}
                </Text>
                <Text style={styles.accordionMeta}>{formatearDuracionSesion(sesion)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={17} color={palette.chevron} />
    </Pressable>
  );
}

// --- Subcomponentes UI: resumen semanal -------------------------------------------

function WeeklySummary({
  resumen,
  palette,
  styles,
}: {
  resumen: { sesiones: number; segundos: number; volumenKg: number };
  palette: WorkoutPalette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.summary}>
      <View style={styles.summaryTitleRow}>
        <View style={styles.summaryLine} />
        <Text style={styles.summaryTitle}>RESUMEN SEMANAL</Text>
        <View style={styles.summaryLine} />
      </View>
      <View style={styles.metricsRow}>
        <Metric
          icon="barbell-outline"
          value={String(resumen.sesiones)}
          label="Sesiones"
          palette={palette}
          styles={styles}
        />
        <Metric
          icon="time-outline"
          value={formatearTiempoSegundos(resumen.segundos, resumen.sesiones > 0)}
          label="Tiempo"
          palette={palette}
          styles={styles}
        />
        <Metric
          icon="bar-chart"
          value={formatearVolumen(resumen.volumenKg)}
          label="Volumen"
          palette={palette}
          styles={styles}
        />
      </View>
    </View>
  );
}

function Metric({
  icon,
  value,
  label,
  palette,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  palette: WorkoutPalette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricTop}>
        <Ionicons name={icon} size={14} color={palette.accent} />
        <Text style={styles.metricValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(f: ReturnType<typeof useTheme>['f'], topInset: number, p: WorkoutPalette) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: p.bg,
    },
    header: {
      flexShrink: 0,
      paddingTop: topInset + 7,
      paddingHorizontal: 16,
      paddingBottom: 8,
      backgroundColor: p.bg,
    },
    headerTop: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerTitle: {
      fontFamily: f.sansMedium,
      color: p.text,
      fontSize: 24,
      lineHeight: 27,
      letterSpacing: -0.6,
    },
    headerTitleBadge: {
      width: 24,
      height: 24,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: p.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerStatsButton: {
      width: 42,
      height: 42,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabRow: {
      height: 34,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: 0,
    },
    tabBtn: {
      height: 34,
      width: 140,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 18,
      borderRadius: 10,
      borderWidth: 1,
    },
    tabBtnActive: {
      backgroundColor: p.accent,
      borderColor: p.accent,
    },
    tabBtnInactive: {
      backgroundColor: p.surface,
      borderColor: p.border,
    },
    tabText: {
      fontFamily: f.mono,
      fontSize: 11,
      lineHeight: 13,
      letterSpacing: 0,
    },
    tabTextActive: {
      color: '#FFFFFF',
    },
    tabTextInactive: {
      color: p.textSecondary,
    },
    screen: {
      flex: 1,
      minHeight: 0,
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: 10,
      backgroundColor: p.bg,
    },
    weekNav: {
      height: 38,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    weekButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: p.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.surfacePressed,
    },
    weekLabelWrap: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    weekLabel: {
      fontFamily: f.monoBold,
      color: p.text,
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 0,
    },
    daysArea: {
      flex: 1,
      minHeight: 0,
    },
    daysBase: {
      flex: 1,
      minHeight: 0,
      gap: 5,
    },
    daysScroll: {
      flex: 1,
      minHeight: 0,
    },
    daysScrollContent: {
      paddingBottom: 4,
      gap: 5,
    },
    dayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: 8,
      backgroundColor: p.surfaceSoft,
      paddingLeft: 6,
      paddingRight: 9,
      overflow: 'hidden',
    },
    dayRowExpanded: {
      borderColor: p.accent,
      paddingVertical: 7,
    },
    dayLeft: {
      width: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayName: {
      fontFamily: f.mono,
      color: p.textSecondary,
      fontSize: 10,
      lineHeight: 12,
      letterSpacing: 0,
      marginBottom: -1,
    },
    dayNameToday: {
      color: p.accent,
    },
    dayCircle: {
      width: 35,
      height: 35,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: p.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.dayCircle,
    },
    dayCircleToday: {
      borderColor: p.accent,
    },
    dayNumber: {
      fontFamily: f.sansBold,
      color: p.text,
      fontSize: 15,
      lineHeight: 18,
    },
    dayDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      marginTop: 3,
      backgroundColor: p.dayDot,
    },
    dayDotActive: {
      backgroundColor: p.accent,
    },
    dayMain: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
    },
    titleLine: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    workoutName: {
      flex: 1,
      minWidth: 0,
      fontFamily: f.sansBold,
      color: p.text,
      fontSize: 13,
      lineHeight: 17,
      letterSpacing: 0,
    },
    workoutMeta: {
      fontFamily: f.sans,
      color: p.textSecondary,
      fontSize: 11,
      lineHeight: 15,
      letterSpacing: 0,
      marginTop: 1,
    },
    moreBadge: {
      minWidth: 22,
      height: 16,
      paddingHorizontal: 5,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.accentSoft,
      borderWidth: 1,
      borderColor: p.accentBorder,
    },
    moreBadgeText: {
      fontFamily: f.monoBold,
      color: p.accent,
      fontSize: 9,
      lineHeight: 11,
      letterSpacing: 0,
    },
    restTitle: {
      fontFamily: f.sansMedium,
      color: p.textSecondary,
      fontSize: 13,
      lineHeight: 17,
      letterSpacing: 0,
    },
    restMeta: {
      fontFamily: f.sans,
      color: p.textMuted,
      fontSize: 11,
      lineHeight: 15,
      letterSpacing: 0,
      marginTop: 1,
    },
    accordionScroll: {
      maxHeight: 112,
      marginTop: 8,
    },
    accordionContent: {
      gap: 6,
      paddingBottom: 2,
    },
    accordionItem: {
      minHeight: 34,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.surface,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    accordionTitle: {
      fontFamily: f.sansMedium,
      color: p.text,
      fontSize: 12,
      lineHeight: 15,
      letterSpacing: 0,
    },
    accordionMeta: {
      fontFamily: f.sans,
      color: p.textSecondary,
      fontSize: 10,
      lineHeight: 13,
      letterSpacing: 0,
      marginTop: 1,
    },
    summary: {
      flexShrink: 0,
      marginTop: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.surface,
      paddingHorizontal: 12,
      paddingTop: 7,
      paddingBottom: 8,
      marginBottom: 10
    },
    summaryTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 5,
    },
    summaryLine: {
      flex: 1,
      height: 1,
      backgroundColor: p.border,
    },
    summaryTitle: {
      fontFamily: f.mono,
      color: p.accent,
      fontSize: 9,
      lineHeight: 12,
      letterSpacing: 0,
    },
    metricsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    metric: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      gap: 2,
    },
    metricTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      minWidth: 0,
    },
    metricValue: {
      flexShrink: 1,
      fontFamily: f.sansBold,
      color: p.text,
      fontSize: 12,
      lineHeight: 15,
      letterSpacing: 0,
    },
    metricLabel: {
      fontFamily: f.sans,
      color: p.textSecondary,
      fontSize: 9,
      lineHeight: 11,
      letterSpacing: 0,
    },
    rutinasWrap: {
      flex: 1,
      minHeight: 0,
      backgroundColor: p.bg,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: p.modalBackdrop,
      justifyContent: 'center',
      padding: 16,
    },
    modalCard: {
      width: '100%',
      maxWidth: 400,
      alignSelf: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.surface,
      padding: 16,
    },
    modalTitle: {
      fontFamily: f.sansBold,
      color: p.text,
      fontSize: 18,
      lineHeight: 23,
      marginBottom: 8,
    },
    modalBody: {
      fontFamily: f.sans,
      color: p.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
    },
    modalActions: {
      gap: 8,
    },
    modalPrimary: {
      minHeight: 42,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.accent,
    },
    modalPrimaryText: {
      fontFamily: f.monoBold,
      color: p.primaryText,
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 0,
    },
    modalDanger: {
      minHeight: 42,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: p.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalDangerText: {
      fontFamily: f.monoBold,
      color: p.dangerText,
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 0,
    },
    modalGhost: {
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalGhostText: {
      fontFamily: f.sans,
      color: p.textSecondary,
      fontSize: 14,
      lineHeight: 18,
    },
  });
}
