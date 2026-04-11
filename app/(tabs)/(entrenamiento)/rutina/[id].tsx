/**
 * Detalle de rutina — lectura y edición (plantilla routines / routine_exercises / routine_sets).
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgregarEjercicioSheet } from '@/components/entrenamiento/AgregarEjercicioSheet';
import { CrearEjercicioModal } from '@/components/entrenamiento/CrearEjercicioModal';
import { EjercicioRutinaCard } from '@/components/entrenamiento/EjercicioRutinaCard';
import type { Theme } from '@/constants/theme';
import { useEntreno } from '@/context/EntrenoContext';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { tipoSerieDbAUi, tipoSerieUiADb } from '@/lib/entrenamientoSerie';
import { supabase } from '@/lib/supabase';
import { ejerciciosService } from '@/services/ejercicios.service';
import {
  entrenamientoService,
  type DetalleRutina,
  type DetalleRutinaEjercicio,
  type DetalleRutinaSet,
} from '@/services/entrenamiento.service';
import type { Exercise, TipoSerie } from '@/types/database.types';
import type { BorradorEjercicioLinea, BorradorSerieLinea } from '@/types/entrenamientoBorrador.types';

const GRUPOS_MUSCULARES_ORDEN = ['PECHO', 'ESPALDA', 'PIERNAS', 'BRAZOS', 'HOMBRO', 'CORE'] as const;

const KEYWORDS_GRUPO_MUSCULAR: Record<(typeof GRUPOS_MUSCULARES_ORDEN)[number], string[]> = {
  PECHO: ['pectoral mayor', 'pectoral menor', 'pectorales', 'pectoral', 'pecho'],
  ESPALDA: [
    'dorsal ancho',
    'infraespinoso',
    'redondo mayor',
    'erectores',
    'romboides',
    'trapecio',
    'dorsal',
    'espalda',
  ],
  PIERNAS: [
    'isquiotibiales',
    'cuádriceps',
    'cuadriceps',
    'aductores',
    'abductores',
    'femoral',
    'glúteos',
    'gluteos',
    'glúteo',
    'gluteo',
    'gemelos',
    'sóleo',
    'soleo',
    'piernas',
    'pierna',
  ],
  BRAZOS: ['antebrazos', 'antebrazo', 'tríceps', 'triceps', 'bíceps', 'biceps', 'braquial'],
  HOMBRO: [
    'deltoides anterior',
    'deltoides posterior',
    'deltoides lateral',
    'manguito rotador',
    'deltoides',
    'hombros',
    'hombro',
  ],
  CORE: ['abdominales inferiores', 'abdominales superiores', 'abdominales', 'transverso', 'oblicuos', 'core'],
};

function mapearGrupoMuscular(musculoPrimario: string): string | null {
  const s = musculoPrimario.trim().toLowerCase();
  if (!s) return null;
  for (const grupo of GRUPOS_MUSCULARES_ORDEN) {
    const keys = KEYWORDS_GRUPO_MUSCULAR[grupo];
    for (const k of keys) {
      const kk = k.toLowerCase();
      if (s.includes(kk) || s.startsWith(kk)) return grupo;
    }
  }
  return null;
}

const TIPOS_SERIE_LEYENDA = [
  { siglas: 'LIN', nombre: 'Lineal', desc: 'Serie estándar progresiva' },
  { siglas: 'WU', nombre: 'Warm Up', desc: 'Serie de calentamiento, no cuenta para el volumen' },
  { siglas: 'TS', nombre: 'Top Set', desc: 'Serie de mayor intensidad del ejercicio' },
  { siglas: 'BO', nombre: 'Back Off', desc: 'Serie a menor intensidad tras el top set' },
  { siglas: 'SS', nombre: 'Superset', desc: 'Combinada con el ejercicio siguiente' },
] as const;

function lid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function seriePorDefecto(): BorradorSerieLinea {
  return { setId: lid(), tipoUi: 'lineal', kg: '', reps: '' };
}

function parseOptFloat(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t || t === '—') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseOptInt(s: string): number | null {
  const t = s.trim();
  if (!t || t === '—') return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

function badgeTipoSerie(t: TipoSerie): string {
  switch (t) {
    case 'warm_up':
      return 'WU';
    case 'top_set':
      return 'TS';
    case 'back_off':
      return 'BO';
    case 'superset':
      return 'SS';
    case 'lineal':
    default:
      return 'LIN';
  }
}

function celdaKg(set: DetalleRutinaSet): string {
  if (set.tipo_peso === 'bodyweight' && set.peso_kg == null) return 'BW';
  if (set.peso_kg == null) return '—';
  return String(set.peso_kg);
}

function detalleALineas(detalle: DetalleRutina): BorradorEjercicioLinea[] {
  return detalle.routine_exercises
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((re) => ({
      lineId: lid(),
      exerciseId: re.exercise_id,
      nombre: re.exercises.nombre,
      musculo_primario: re.exercises.musculo_primario,
      sets:
        re.routine_sets.length > 0
          ? re.routine_sets
              .slice()
              .sort((a, b) => a.numero_serie - b.numero_serie)
              .map((s) => ({
              setId: lid(),
              tipoUi: tipoSerieDbAUi(s.tipo_serie),
              kg: s.peso_kg != null ? String(s.peso_kg) : '',
              reps: s.reps != null ? String(s.reps) : '',
            }))
          : [seriePorDefecto()],
    }));
}

function serializarBorrador(titulo: string, lineas: BorradorEjercicioLinea[]): string {
  return JSON.stringify({
    titulo: titulo.trim(),
    lineas: lineas.map((l) => ({
      exerciseId: l.exerciseId,
      sets: l.sets.map((s) => ({ tipoUi: s.tipoUi, kg: s.kg, reps: s.reps })),
    })),
  });
}

function makeStyles(c: Theme, f: ReturnType<typeof useTheme>['f'], ts: ReturnType<typeof useTheme>['ts'], s: ReturnType<typeof useTheme>['s'], r: ReturnType<typeof useTheme>['r']) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s.sm,
      paddingBottom: s.sm,
      minHeight: 48,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.surface,
    },
    headerSide: {
      width: 88,
      minHeight: 44,
      justifyContent: 'center',
    },
    headerSideRight: {
      width: 88,
      minHeight: 44,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      textAlign: 'center',
    },
    headerTitleInput: {
      flex: 1,
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      textAlign: 'center',
      paddingVertical: 4,
      marginHorizontal: s.xs,
    },
    headerBtnText: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    saveBtn: {
      paddingHorizontal: s.sm,
      paddingVertical: s.xs + 2,
      borderRadius: r.technical,
      backgroundColor: c.primary,
      borderWidth: 1,
      borderColor: c.primary,
    },
    saveBtnDisabled: {
      opacity: 0.35,
    },
    saveBtnText: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textOnPrimary,
    },
    distribWrap: {
      marginHorizontal: s.md,
      marginTop: s.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.lg,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    distribHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
    },
    distribHeaderText: {
      fontSize: 10,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    distribChart: {
      paddingHorizontal: s.md,
      paddingBottom: s.sm,
      gap: s.sm,
    },
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.xs,
    },
    barLabel: {
      width: 68,
      fontSize: 10,
      fontFamily: f.mono,
      color: c.textSecondary,
    },
    barTrack: {
      flex: 1,
      height: 12,
      borderRadius: 4,
      backgroundColor: c.border,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: c.primary,
    },
    barPct: {
      width: 36,
      fontSize: 10,
      fontFamily: f.mono,
      color: c.textSecondary,
      textAlign: 'right',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: s.md,
      paddingTop: s.md,
      paddingBottom: s.xl,
    },
    cardEj: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      backgroundColor: c.surface,
      padding: s.md,
      marginBottom: s.md,
    },
    ejTitulo: {
      ...ts.body,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      marginBottom: 2,
    },
    ejMusculo: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginBottom: s.sm,
    },
    tablaHead: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      paddingBottom: s.xs,
      marginBottom: s.xs,
    },
    colSerie: {
      flex: 0.5,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colKg: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colReps: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colTipo: {
      flex: 0.8,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thTipoHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    thTextTipo: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.5,
      textAlign: 'center',
    },
    thText: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.5,
      textAlign: 'center',
      width: '100%',
    },
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
    },
    tdText: {
      ...ts.body,
      fontFamily: f.mono,
      color: c.textDisplay,
      textAlign: 'center',
      width: '100%',
    },
    badge: {
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: r.technical,
      backgroundColor: c.primaryBg,
      borderWidth: 1,
      borderColor: c.primary,
    },
    badgeTxt: {
      ...ts.caption,
      fontFamily: f.monoBold,
      fontSize: 9,
      color: c.primary,
      letterSpacing: 0.3,
    },
    sep: {
      height: 1,
      backgroundColor: c.border,
      marginVertical: s.md,
      marginHorizontal: s.md,
    },
    footerEmpezar: {
      paddingHorizontal: s.md,
      paddingTop: s.sm,
      paddingBottom: s.sm,
      marginBottom: s.md,
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.background,
    },
    footerEmpezarBtn: {
      width: '100%',
      alignSelf: 'center',
      paddingVertical: s.md,
      borderRadius: r.sm,
      backgroundColor: c.primary,
      borderWidth: 1,
      borderColor: c.primary,
      alignItems: 'center',
    },
    footerEmpezarBtnDis: {
      opacity: 0.65,
      backgroundColor: c.surfaceElevated,
      borderColor: c.borderVisible,
    },
    footerEmpezarTxt: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textOnPrimary,
      letterSpacing: 0.3,
    },
    footerEmpezarTxtDis: {
      color: c.textMuted,
    },
    centerState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: s.lg,
      gap: s.md,
    },
    errTxt: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.danger,
      textAlign: 'center',
    },
    bodyEdit: {
      flex: 1,
      paddingHorizontal: s.md,
    },
    emptyCenter: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: s.lg,
      gap: s.md,
      minHeight: 220,
    },
    emptyText: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textSecondary,
      textAlign: 'center',
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.sm,
      paddingVertical: s.md,
      paddingHorizontal: s.lg,
      borderRadius: r.sm,
      backgroundColor: c.primary,
      borderWidth: 1,
      borderColor: c.primary,
    },
    addBtnText: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textOnPrimary,
    },
    scrollEditContent: {
      paddingTop: s.md,
      paddingBottom: s.xl,
    },
    footerAgregar: {
      paddingVertical: s.md,
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: c.border,
      marginHorizontal: -s.md,
      paddingHorizontal: s.md,
      backgroundColor: c.background,
    },
    footerAgregarText: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.primary,
      letterSpacing: 0.7,
    },
    tiposModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      paddingHorizontal: s.lg,
    },
    tiposModalCard: {
      backgroundColor: c.surface,
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.borderVisible,
      padding: s.lg,
      maxHeight: '88%',
    },
    tiposModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: s.md,
      gap: s.sm,
    },
    tiposModalTitle: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      flex: 1,
    },
    tiposModalScroll: {
      maxHeight: 360,
    },
    tipoLeyendaFila: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: s.sm,
      marginBottom: s.md,
    },
    tipoLeyendaTxtCol: {
      flex: 1,
      minWidth: 0,
    },
    tipoLeyendaNombre: {
      ...ts.body,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      marginBottom: 2,
    },
    tipoLeyendaDesc: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.4,
    },
    tiposModalCerrar: {
      marginTop: s.md,
      paddingVertical: s.sm,
      paddingHorizontal: s.md,
      borderRadius: r.technical,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
    },
    tiposModalCerrarTxt: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.5,
    },
  });
}

function distribucionDesdeDetalle(detalle: DetalleRutina): { grupo: string; pct: number }[] {
  const ejercicios = detalle.routine_exercises.slice().sort((a, b) => a.orden - b.orden);
  let total = 0;
  for (const re of ejercicios) {
    total += re.routine_sets.length;
  }
  if (total <= 0) return [];

  const counts = new Map<string, number>();
  for (const re of ejercicios) {
    const g = mapearGrupoMuscular(re.exercises.musculo_primario);
    const n = re.routine_sets.length;
    if (g && n > 0) {
      counts.set(g, (counts.get(g) ?? 0) + n);
    }
  }

  const out: { grupo: string; pct: number }[] = [];
  for (const grupo of GRUPOS_MUSCULARES_ORDEN) {
    const cnt = counts.get(grupo) ?? 0;
    if (cnt < 1) continue;
    out.push({ grupo, pct: (cnt / total) * 100 });
  }
  return out;
}

export default function RutinaDetallePantalla() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const routineId = Array.isArray(idParam) ? idParam[0] : idParam;

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);
  const { user } = useAuth();
  const { iniciarDesdeRutina, entrenoActivo } = useEntreno();

  const [detalle, setDetalle] = useState<DetalleRutina | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [distribAbierta, setDistribAbierta] = useState(false);
  const [modalTipos, setModalTipos] = useState(false);

  const [tituloEdicion, setTituloEdicion] = useState('');
  const [lineas, setLineas] = useState<BorradorEjercicioLinea[]>([]);
  const baselineEdicionRef = useRef('');
  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [crearEjercicioAbierto, setCrearEjercicioAbierto] = useState(false);
  const [replaceLineId, setReplaceLineId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [iniciandoEntreno, setIniciandoEntreno] = useState(false);

  const hayEntrenoActivo = entrenoActivo != null;

  const cargar = useCallback(async () => {
    if (!routineId) {
      setError('Rutina no válida.');
      setCargando(false);
      setDetalle(null);
      return;
    }
    setCargando(true);
    setError(null);
    const data = await entrenamientoService.obtenerDetalleRutina(routineId);
    if (!data) {
      setError('No se pudo cargar la rutina.');
      setDetalle(null);
    } else {
      setDetalle(data);
    }
    setCargando(false);
  }, [routineId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const distribucion = useMemo(() => (detalle ? distribucionDesdeDetalle(detalle) : []), [detalle]);

  const alturaDistrib = useMemo(() => {
    const numGrupos = distribucion.length;
    const raw = numGrupos * 28 + 16;
    return Math.min(winH * 0.3, Math.max(60, raw));
  }, [distribucion.length, winH]);

  const ejerciciosLectura = useMemo(() => {
    if (!detalle) return [];
    return detalle.routine_exercises.slice().sort((a, b) => a.orden - b.orden);
  }, [detalle]);

  const entrarEdicion = useCallback(() => {
    if (!detalle) return;
    setTituloEdicion(detalle.nombre);
    const next = detalleALineas(detalle);
    setLineas(next);
    baselineEdicionRef.current = serializarBorrador(detalle.nombre, next);
    setModoEdicion(true);
  }, [detalle]);

  const hayCambiosSinGuardar = useCallback(() => {
    return serializarBorrador(tituloEdicion, lineas) !== baselineEdicionRef.current;
  }, [tituloEdicion, lineas]);

  const iniciarSalirEdicion = useCallback(() => {
    if (!hayCambiosSinGuardar()) {
      setModoEdicion(false);
      return;
    }
    Alert.alert('¿Descartar cambios?', 'Perderás los cambios que no hayas guardado.', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => setModoEdicion(false) },
    ]);
  }, [hayCambiosSinGuardar]);

  const abrirSheetNuevo = useCallback(() => {
    setReplaceLineId(null);
    setSheetAbierto(true);
  }, []);

  const abrirSheetReemplazar = useCallback((lineId: string) => {
    setReplaceLineId(lineId);
    setSheetAbierto(true);
  }, []);

  const incorporarEjercicio = useCallback(
    (ex: Exercise) => {
      setLineas((prev) => {
        const repId = replaceLineId;
        if (repId) {
          return prev.map((l) =>
            l.lineId === repId
              ? {
                  ...l,
                  exerciseId: ex.id,
                  nombre: ex.nombre,
                  musculo_primario: ex.musculo_primario,
                }
              : l,
          );
        }
        return [
          ...prev,
          {
            lineId: lid(),
            exerciseId: ex.id,
            nombre: ex.nombre,
            musculo_primario: ex.musculo_primario,
            sets: [seriePorDefecto()],
          },
        ];
      });
      setReplaceLineId(null);
    },
    [replaceLineId],
  );

  const onSeleccionarEjercicio = useCallback(
    (ex: Exercise) => {
      incorporarEjercicio(ex);
    },
    [incorporarEjercicio],
  );

  const actualizarLinea = useCallback((lineId: string, next: BorradorEjercicioLinea) => {
    setLineas((prev) => prev.map((l) => (l.lineId === lineId ? next : l)));
  }, []);

  const moverLinea = useCallback((index: number, delta: number) => {
    setLineas((prev) => {
      const j = index + delta;
      if (j < 0 || j >= prev.length) return prev;
      const copia = [...prev];
      const [x] = copia.splice(index, 1);
      copia.splice(j, 0, x);
      return copia;
    });
  }, []);

  const eliminarLinea = useCallback((lineId: string) => {
    setLineas((prev) => prev.filter((l) => l.lineId !== lineId));
  }, []);

  const crearPersonalizado = useCallback(
    async (nombre: string, musculo: string) => {
      if (!user?.id) {
        Alert.alert('Sesión', 'Inicia sesión para crear ejercicios.');
        return null;
      }
      return ejerciciosService.crearEjercicioPersonalizado(user.id, {
        nombre,
        musculo_primario: musculo,
      });
    },
    [user?.id],
  );

  const onCrearEjercicioListo = useCallback(
    async (nombre: string, musculo: string) => {
      const ex = await crearPersonalizado(nombre, musculo);
      if (ex) {
        incorporarEjercicio(ex);
        setCrearEjercicioAbierto(false);
        setSheetAbierto(false);
      }
      return ex;
    },
    [crearPersonalizado, incorporarEjercicio],
  );

  const guardarEdicion = useCallback(async () => {
    if (!routineId || !user?.id) {
      if (!user?.id) Alert.alert('Sesión', 'Inicia sesión para guardar.');
      return;
    }
    const tituloLimpio = tituloEdicion.trim();
    if (!tituloLimpio) {
      Alert.alert('Título', 'Indica un nombre para la rutina.');
      return;
    }
    if (lineas.length < 1) {
      Alert.alert('Ejercicios', 'Añade al menos un ejercicio.');
      return;
    }

    const ejerciciosPayload = lineas.map((line, idx) => ({
      exercise_id: line.exerciseId,
      orden: idx + 1,
      sets: line.sets.map((set, i) => ({
        numero_serie: i + 1,
        tipo_serie: tipoSerieUiADb(set.tipoUi),
        repeticiones: parseOptInt(set.reps),
        peso_kg: parseOptFloat(set.kg),
        tipo_peso: 'kg' as const,
      })),
    }));

    setGuardando(true);
    try {
      const { error: errNombre } = await supabase
        .from('routines')
        .update({ nombre: tituloLimpio })
        .eq('id', routineId);
      if (errNombre) {
        Alert.alert('Error', errNombre.message ?? 'No se pudo actualizar el nombre.');
        return;
      }
      await entrenamientoService.actualizarRutinaDesdeEntreno(routineId, ejerciciosPayload);
      await cargar();
      setModoEdicion(false);
    } finally {
      setGuardando(false);
    }
  }, [routineId, user?.id, tituloEdicion, lineas, cargar]);

  const onEmpezarRutina = useCallback(async () => {
    if (!routineId || !detalle || hayEntrenoActivo || iniciandoEntreno) return;
    setIniciandoEntreno(true);
    try {
      await iniciarDesdeRutina(routineId, detalle.nombre);
      router.replace('/(tabs)/(entrenamiento)/entreno-activo');
    } finally {
      setIniciandoEntreno(false);
    }
  }, [routineId, detalle, hayEntrenoActivo, iniciandoEntreno, iniciarDesdeRutina, router]);

  const formValidEdicion = tituloEdicion.trim().length > 0 && lineas.length >= 1;

  const tituloLectura = (detalle?.nombre ?? '').trim() || 'Rutina';

  if (cargando && !detalle && !error) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.root, styles.centerState, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      </>
    );
  }

  if (error && !detalle) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.root, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <View style={styles.headerSide}>
              <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver">
                <Ionicons name="chevron-back" size={26} color={c.textDisplay} />
              </Pressable>
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Rutina
            </Text>
            <View style={styles.headerSideRight} />
          </View>
          <View style={styles.centerState}>
            <Text style={styles.errTxt}>{error}</Text>
            <Pressable
              onPress={() => void cargar()}
              style={{ padding: s.md, borderWidth: 1, borderColor: c.primary, borderRadius: r.technical }}
            >
              <Text style={{ ...ts.label, fontFamily: f.mono, color: c.primary }}>REINTENTAR</Text>
            </Pressable>
          </View>
        </View>
      </>
    );
  }

  if (!detalle) return null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={modoEdicion && Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.root, { paddingTop: insets.top }]}>
          {modoEdicion ? (
            <>
              <View style={styles.header}>
                <View style={styles.headerSide}>
                  <Pressable onPress={iniciarSalirEdicion} accessibilityRole="button">
                    <Text style={styles.headerBtnText}>Cancelar</Text>
                  </Pressable>
                </View>
                <TextInput
                  style={styles.headerTitleInput}
                  value={tituloEdicion}
                  onChangeText={setTituloEdicion}
                  placeholder="Nombre de la rutina"
                  placeholderTextColor={c.textMuted}
                  autoCorrect={false}
                />
                <View style={styles.headerSideRight}>
                  <Pressable
                    onPress={() => void guardarEdicion()}
                    disabled={!formValidEdicion || guardando}
                    style={[styles.saveBtn, !formValidEdicion && styles.saveBtnDisabled]}
                    accessibilityRole="button"
                  >
                    {guardando ? (
                      <ActivityIndicator color={c.textOnPrimary} size="small" />
                    ) : (
                      <Text style={styles.saveBtnText}>Guardar</Text>
                    )}
                  </Pressable>
                </View>
              </View>

              <View style={[styles.bodyEdit, { paddingBottom: insets.bottom }]}>
                {lineas.length === 0 ? (
                  <View style={styles.emptyCenter}>
                    <Ionicons name="barbell-outline" size={56} color={c.textMuted} />
                    <Text style={styles.emptyText}>Añade ejercicios a tu rutina</Text>
                    <Pressable style={styles.addBtn} onPress={abrirSheetNuevo} accessibilityRole="button">
                      <Ionicons name="add" size={22} color={c.textOnPrimary} />
                      <Text style={styles.addBtnText}>+ Agregar ejercicio</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <ScrollView
                      style={styles.scroll}
                      contentContainerStyle={styles.scrollEditContent}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      {lineas.map((line, index) => (
                        <EjercicioRutinaCard
                          key={line.lineId}
                          modo="rutina"
                          data={line}
                          onChange={(next) => actualizarLinea(line.lineId, next)}
                          onMoveUp={() => moverLinea(index, -1)}
                          onMoveDown={() => moverLinea(index, 1)}
                          onReplace={() => abrirSheetReemplazar(line.lineId)}
                          onDelete={() => eliminarLinea(line.lineId)}
                          canMoveUp={index > 0}
                          canMoveDown={index < lineas.length - 1}
                        />
                      ))}
                    </ScrollView>
                    <Pressable style={styles.footerAgregar} onPress={abrirSheetNuevo} accessibilityRole="button">
                      <Text style={styles.footerAgregarText}>+ AGREGAR EJERCICIO</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </>
          ) : (
            <>
              <View style={styles.header}>
                <View style={styles.headerSide}>
                  <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver">
                    <Ionicons name="chevron-back" size={26} color={c.textDisplay} />
                  </Pressable>
                </View>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {tituloLectura}
                </Text>
                <View style={styles.headerSideRight}>
                  <Pressable onPress={entrarEdicion} hitSlop={10} accessibilityRole="button" accessibilityLabel="Editar">
                    <Ionicons name="create-outline" size={22} color={c.textDisplay} />
                  </Pressable>
                </View>
              </View>

              <View style={{ flex: 1, flexDirection: 'column' }}>
                <View style={styles.distribWrap}>
                  <Pressable
                    style={styles.distribHeader}
                    onPress={() => setDistribAbierta((o) => !o)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.distribHeaderText}>DISTRIBUCIÓN MUSCULAR</Text>
                    <Ionicons name={distribAbierta ? 'chevron-up' : 'chevron-down'} size={18} color={c.textSecondary} />
                  </Pressable>
                  {distribAbierta ? (
                    <View style={[styles.distribChart, { height: alturaDistrib }]}>
                      {distribucion.length === 0 ? (
                        <Text style={[styles.barLabel, { width: '100%' }]}>
                          Sin datos (añade ejercicios con músculo reconocido)
                        </Text>
                      ) : (
                        distribucion.map((row) => (
                          <View key={row.grupo} style={styles.barRow}>
                            <Text style={styles.barLabel} numberOfLines={1}>
                              {row.grupo}
                            </Text>
                            <View style={styles.barTrack}>
                              <View style={[styles.barFill, { width: `${Math.min(100, row.pct)}%` }]} />
                            </View>
                            <Text style={styles.barPct}>{Math.round(row.pct)}%</Text>
                          </View>
                        ))
                      )}
                    </View>
                  ) : null}
                </View>

                <ScrollView
                  style={styles.scroll}
                  contentContainerStyle={[styles.scrollContent, { paddingBottom: s.md }]}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {ejerciciosLectura.map((ej: DetalleRutinaEjercicio, i: number) => (
                    <View key={ej.id}>
                      {i > 0 ? <View style={styles.sep} /> : null}
                      <View style={styles.cardEj}>
                        <Text style={styles.ejTitulo}>{ej.exercises.nombre}</Text>
                        {ej.exercises.musculo_primario ? (
                          <Text style={styles.ejMusculo}>{ej.exercises.musculo_primario}</Text>
                        ) : null}
                        {ej.routine_sets.length === 0 ? (
                          <Text style={[styles.emptyText, { textAlign: 'left', marginTop: s.xs }]}>Sin series</Text>
                        ) : (
                          <>
                            <View style={styles.tablaHead}>
                              <View style={styles.colSerie}>
                                <Text style={styles.thText}>SERIE</Text>
                              </View>
                              <View style={styles.colKg}>
                                <Text style={styles.thText}>KG</Text>
                              </View>
                              <View style={styles.colReps}>
                                <Text style={styles.thText}>REPS</Text>
                              </View>
                              <View style={styles.colTipo}>
                                <View style={styles.thTipoHeadRow}>
                                  <Text style={styles.thTextTipo}>TIPO</Text>
                                  <Pressable
                                    onPress={() => setModalTipos(true)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    accessibilityRole="button"
                                  >
                                    <Ionicons name="information-circle-outline" size={14} color={c.textSecondary} />
                                  </Pressable>
                                </View>
                              </View>
                            </View>
                            {ej.routine_sets.map((st: DetalleRutinaSet) => (
                              <View key={st.numero_serie} style={styles.fila}>
                                <View style={styles.colSerie}>
                                  <Text style={styles.tdText}>{st.numero_serie}</Text>
                                </View>
                                <View style={styles.colKg}>
                                  <Text style={styles.tdText}>{celdaKg(st)}</Text>
                                </View>
                                <View style={styles.colReps}>
                                  <Text style={styles.tdText}>{st.reps != null ? String(st.reps) : '—'}</Text>
                                </View>
                                <View style={styles.colTipo}>
                                  <View style={styles.badge}>
                                    <Text style={styles.badgeTxt}>{badgeTipoSerie(st.tipo_serie as TipoSerie)}</Text>
                                  </View>
                                </View>
                              </View>
                            ))}
                          </>
                        )}
                      </View>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.footerEmpezar}>
                  <Pressable
                    style={[styles.footerEmpezarBtn, hayEntrenoActivo && styles.footerEmpezarBtnDis]}
                    onPress={() => void onEmpezarRutina()}
                    disabled={hayEntrenoActivo || iniciandoEntreno}
                    accessibilityRole="button"
                  >
                    {iniciandoEntreno ? (
                      <ActivityIndicator color={c.textOnPrimary} />
                    ) : (
                      <Text style={[styles.footerEmpezarTxt, hayEntrenoActivo && styles.footerEmpezarTxtDis]}>
                        {hayEntrenoActivo ? 'ENTRENO EN CURSO' : 'EMPEZAR RUTINA'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </View>

        <AgregarEjercicioSheet
          visible={sheetAbierto}
          onClose={() => {
            setSheetAbierto(false);
            setReplaceLineId(null);
          }}
          onSeleccionar={onSeleccionarEjercicio}
          onCrearPersonalizado={() => setCrearEjercicioAbierto(true)}
        />

        <CrearEjercicioModal
          visible={crearEjercicioAbierto}
          onClose={() => setCrearEjercicioAbierto(false)}
          onSubmit={onCrearEjercicioListo}
        />

        <Modal visible={modalTipos} transparent animationType="fade" onRequestClose={() => setModalTipos(false)}>
          <View style={styles.tiposModalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalTipos(false)} accessibilityRole="button" />
            <View style={styles.tiposModalCard}>
              <View style={styles.tiposModalHeader}>
                <Text style={styles.tiposModalTitle}>Tipos de serie</Text>
                <Pressable onPress={() => setModalTipos(false)} hitSlop={8} accessibilityRole="button">
                  <Ionicons name="close" size={22} color={c.textDisplay} />
                </Pressable>
              </View>
              <ScrollView style={styles.tiposModalScroll} showsVerticalScrollIndicator={false}>
                {TIPOS_SERIE_LEYENDA.map((row) => (
                  <View key={row.siglas} style={styles.tipoLeyendaFila}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeTxt}>{row.siglas}</Text>
                    </View>
                    <View style={styles.tipoLeyendaTxtCol}>
                      <Text style={styles.tipoLeyendaNombre}>{row.nombre}</Text>
                      <Text style={styles.tipoLeyendaDesc}>{row.desc}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <Pressable style={styles.tiposModalCerrar} onPress={() => setModalTipos(false)}>
                <Text style={styles.tiposModalCerrarTxt}>CERRAR</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </>
  );
}
