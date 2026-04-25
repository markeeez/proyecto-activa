/**
 * Pantalla del entreno en curso: borrador en contexto, series completadas, terminar / minimizar.
 */

import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgregarEjercicioSheet } from '@/components/entrenamiento/AgregarEjercicioSheet';
import { CrearEjercicioModal } from '@/components/entrenamiento/CrearEjercicioModal';
import { EjercicioRutinaCard } from '@/components/entrenamiento/EjercicioRutinaCard';
import type { Theme } from '@/constants/theme';
import { useEntreno, useEntrenoDuracionTexto, type SnapshotRutina } from '@/context/EntrenoContext';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { tipoSerieUiADb } from '@/lib/entrenamientoSerie';
import { lid, seriePorDefecto } from '@/lib/entrenamientoUtils';
import { ejerciciosService } from '@/services/ejercicios.service';
import {
  entrenamientoService,
  type BorradorEjercicioRutina,
  type EntrenoEjercicioPersistido,
  type UltimaSesionRutina,
} from '@/services/entrenamiento.service';
import type { Exercise } from '@/types/database.types';
import type { BorradorEjercicioLinea, BorradorSerieLinea } from '@/types/entrenamientoBorrador.types';


function parseOptFloat(s: string): number | null {
  const t = s.trim().replace(/,/g, '.');
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

function lineasAPersistido(lineas: BorradorEjercicioLinea[]): EntrenoEjercicioPersistido[] {
  const out: EntrenoEjercicioPersistido[] = [];
  let ordenEj = 1;
  for (const line of lineas) {
    const setsComp = line.sets.filter((s) => s.completada);
    if (!setsComp.length) continue;
    out.push({
      exercise_id: line.exerciseId,
      orden: ordenEj++,
      notas: (line.nota ?? '').trim() || null,
      sets: setsComp.map((s, i) => ({
        numero_serie: i + 1,
        tipo_serie: tipoSerieUiADb(s.tipoUi),
        repeticiones: parseOptInt(s.reps),
        peso_kg: parseOptFloat(s.kg),
        tipo_peso: 'kg',
      })),
    });
  }
  return out;
}

function lineasARutinaSoloCompletadas(lineas: BorradorEjercicioLinea[]): BorradorEjercicioRutina[] {
  const out: BorradorEjercicioRutina[] = [];
  let orden = 1;
  for (const line of lineas) {
    const setsComp = line.sets.filter((s) => s.completada);
    if (!setsComp.length) continue;
    out.push({
      exercise_id: line.exerciseId,
      orden: orden++,
      sets: setsComp.map((s, i) => ({
        numero_serie: i + 1,
        tipo_serie: tipoSerieUiADb(s.tipoUi),
        repeticiones: parseOptInt(s.reps),
        peso_kg: parseOptFloat(s.kg),
        tipo_peso: 'kg',
      })),
    });
  }
  return out;
}

function lineasARutinaCompleta(lineas: BorradorEjercicioLinea[]): BorradorEjercicioRutina[] {
  return lineas.map((line, idx) => ({
    exercise_id: line.exerciseId,
    orden: idx + 1,
    sets: line.sets.map((s, i) => ({
      numero_serie: i + 1,
      tipo_serie: tipoSerieUiADb(s.tipoUi),
      repeticiones: parseOptInt(s.reps),
      peso_kg: parseOptFloat(s.kg),
      tipo_peso: 'kg',
    })),
  }));
}

/** Compara borrador vs plantilla original: ejercicios, series y tipo de serie (no kg/reps/completada). */
function haycambiosEstructurales(lineas: BorradorEjercicioLinea[], snapshot: SnapshotRutina): boolean {
  if (lineas.length !== snapshot.ejercicios.length) return true;
  for (let i = 0; i < lineas.length; i++) {
    const L = lineas[i]!;
    const S = snapshot.ejercicios[i]!;
    if (L.exerciseId !== S.exercise_id) return true;
    if (L.sets.length !== S.sets.length) return true;
    for (let j = 0; j < L.sets.length; j++) {
      if (tipoSerieUiADb(L.sets[j]!.tipoUi) !== S.sets[j]!.tipo_serie) return true;
    }
  }
  return false;
}

function textoAnteriorDesdeValores(
  peso_kg: number | null,
  repeticiones: number | null,
  tipo_peso: string,
): string {
  const r = repeticiones != null ? String(repeticiones) : '—';
  if (tipo_peso === 'bodyweight') return `BW × ${r}`;
  if (tipo_peso === 'assisted') return `Asist. × ${r}`;
  const p = peso_kg != null ? `${peso_kg}kg` : '—';
  return `${p} × ${r}`;
}

function textosAnteriorPorLinea(
  line: BorradorEjercicioLinea,
  ultima: UltimaSesionRutina | null,
  anteriorGlobalPorExercise: Record<string, string>,
): (string | null)[] {
  if (ultima) {
    return line.sets.map((_, j) => {
      const numeroSerie = j + 1;
      const block =
        line.orden != null
          ? ultima.ejercicios.find((e) => e.exercise_id === line.exerciseId && e.orden === line.orden)
          : ultima.ejercicios.find((e) => e.exercise_id === line.exerciseId);
      const st = block?.sets.find((s) => s.numero_serie === numeroSerie);
      if (!st) return null;
      return textoAnteriorDesdeValores(st.peso_kg, st.repeticiones, st.tipo_peso);
    });
  }
  const g = anteriorGlobalPorExercise[line.exerciseId];
  return line.sets.map(() => (g ? g : null));
}

function makeStyles(c: Theme, f: ReturnType<typeof useTheme>['f'], ts: ReturnType<typeof useTheme>['ts'], s: ReturnType<typeof useTheme>['s'], r: ReturnType<typeof useTheme>['r']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      gap: s.xs,
    },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, minWidth: 0, alignItems: 'center' },
    headerTitle: { ...ts.bodySm, fontFamily: f.sansMedium, color: c.textDisplay },
    cron: { ...ts.caption, fontFamily: f.mono, color: c.textSecondary },
    terminarBtn: {
      paddingHorizontal: s.sm,
      paddingVertical: s.xs,
      borderRadius: r.technical,
      backgroundColor: c.primary,
    },
    terminarTxt: { ...ts.caption, fontFamily: f.sansMedium, color: c.textOnPrimary },
    body: { flex: 1, paddingHorizontal: s.md },
    scrollContent: { paddingTop: s.md, paddingBottom: s.xl },
    footerBtn: {
      paddingVertical: s.md,
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: c.border,
      marginHorizontal: -s.md,
      paddingHorizontal: s.md,
    },
    footerBtnText: { ...ts.label, fontFamily: f.mono, color: c.primary, letterSpacing: 0.7 },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      padding: s.lg,
    },
    modalCard: {
      backgroundColor: c.surface,
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.borderVisible,
      padding: s.md,
    },
    modalTitle: { ...ts.subheading, fontFamily: f.sansMedium, color: c.textDisplay, marginBottom: s.sm },
    modalBody: { ...ts.bodySm, fontFamily: f.sans, color: c.textSecondary, marginBottom: s.md },
    modalRow: { flexDirection: 'row', gap: s.sm, justifyContent: 'flex-end', flexWrap: 'wrap' },
    modalBtn: {
      paddingVertical: s.sm,
      paddingHorizontal: s.md,
      borderRadius: r.technical,
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    modalBtnPrimary: { backgroundColor: c.primary, borderColor: c.primary },
    modalBtnTxt: { ...ts.bodySm, fontFamily: f.sans, color: c.textDisplay },
    modalBtnTxtOn: { color: c.textOnPrimary, fontFamily: f.sansMedium },
    modalInput: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
      borderBottomWidth: 1,
      borderBottomColor: c.borderVisible,
      paddingVertical: s.xs,
      marginBottom: s.md,
    },
    modalIncompletasColumn: {
      flexDirection: 'column',
      gap: s.sm,
    },
    modalBtnDestructive: {
      borderWidth: 1,
      borderColor: c.danger,
      backgroundColor: c.surface,
    },
    modalBtnTxtDestructive: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.danger,
      textAlign: 'center' as const,
    },
  });
}

type PostSnap = {
  lineas: BorradorEjercicioLinea[];
  routineId: string | null;
  nombre: string;
};

export default function EntrenoActivoScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    entrenoActivo,
    setLineas,
    actualizarLinea,
    terminarEntreno,
    descartarEntreno,
    minimizar,
  } = useEntreno();
  const duracionTxt = useEntrenoDuracionTexto();
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [crearEjercicioAbierto, setCrearEjercicioAbierto] = useState(false);
  const [replaceLineId, setReplaceLineId] = useState<string | null>(null);
  const [anteriorPorEjercicio, setAnteriorPorEjercicio] = useState<Record<string, string>>({});
  const [modalIncompletas, setModalIncompletas] = useState(false);
  const [modalConfirmarTerminar, setModalConfirmarTerminar] = useState(false);
  const [modalDescartar, setModalDescartar] = useState(false);
  const [modalGuardarRutina, setModalGuardarRutina] = useState(false);
  const [modalActualizarRutina, setModalActualizarRutina] = useState(false);
  const [nombreNuevaRutina, setNombreNuevaRutina] = useState('');
  const [postSnap, setPostSnap] = useState<PostSnap | null>(null);
  const [guardandoRutina, setGuardandoRutina] = useState(false);
  const allowNavAway = useRef(false);
  const postSnapRef = useRef<PostSnap | null>(null);

  useEffect(() => {
    if (entrenoActivo || postSnapRef.current) return;
    allowNavAway.current = true;
    router.replace('/(tabs)/(entrenamiento)');
    const t = setTimeout(() => {
      allowNavAway.current = false;
    }, 500);
    return () => clearTimeout(t);
  }, [entrenoActivo, postSnap, router]);

  const lineas = useMemo(() => entrenoActivo?.lineas ?? [], [entrenoActivo?.lineas]);

  /** Rutas/recuperación no rellenan `foto_url`; se hidrata desde catálogo sin bloquear la UI. */
  const claveFotosPendientes = useMemo(
    () =>
      lineas
        .filter((l) => l.foto_url === undefined && l.exerciseId)
        .map((l) => l.exerciseId)
        .sort()
        .join(','),
    [lineas],
  );

  useEffect(() => {
    if (!claveFotosPendientes) return;
    const ids = [...new Set(claveFotosPendientes.split(',').filter(Boolean))];
    if (!ids.length) return;
    let cancelled = false;
    void (async () => {
      const pairs = await Promise.all(
        ids.map(async (id) => {
          const ex = await ejerciciosService.obtenerEjercicio(id);
          const u = ex?.foto_url != null && String(ex.foto_url).trim() !== '' ? String(ex.foto_url).trim() : null;
          return [id, u] as const;
        }),
      );
      if (cancelled) return;
      setLineas((prev) =>
        prev.map((l) => {
          if (l.foto_url !== undefined) return l;
          const hit = pairs.find(([id]) => id === l.exerciseId);
          if (!hit) return { ...l, foto_url: null };
          const [, url] = hit;
          return { ...l, foto_url: url };
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [claveFotosPendientes, setLineas]);

  useEffect(() => {
    if (!user?.id || !lineas.length) {
      setAnteriorPorEjercicio({});
      return;
    }
    if (entrenoActivo?.ultimaSesionRutina) {
      setAnteriorPorEjercicio({});
      return;
    }
    let cancel = false;
    void (async () => {
      const entries = await Promise.all(
        lineas.map(async (l) => {
          const t = await entrenamientoService.obtenerAnteriorPorEjercicio(user.id, l.exerciseId);
          return [l.exerciseId, t ?? ''] as const;
        }),
      );
      if (cancel) return;
      const next: Record<string, string> = {};
      for (const [id, t] of entries) {
        if (t) next[id] = t;
      }
      setAnteriorPorEjercicio(next);
    })();
    return () => {
      cancel = true;
    };
  }, [user?.id, lineas, entrenoActivo?.ultimaSesionRutina]);

  const textosAnteriorPorLineId = useMemo(() => {
    const ultima = entrenoActivo?.ultimaSesionRutina ?? null;
    const m = new Map<string, (string | null)[]>();
    for (const line of lineas) {
      m.set(line.lineId, textosAnteriorPorLinea(line, ultima, anteriorPorEjercicio));
    }
    return m;
  }, [lineas, entrenoActivo?.ultimaSesionRutina, anteriorPorEjercicio]);

  const hayIncompletas = useMemo(
    () => lineas.some((l) => l.sets.some((s) => !s.completada)),
    [lineas],
  );

  const incorporarEjercicio = useCallback(
    (ex: Exercise) => {
      const fotoRaw = ex.foto_url;
      const foto_url =
        fotoRaw != null && String(fotoRaw).trim() !== '' ? String(fotoRaw).trim() : null;
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
                  foto_url,
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
            foto_url,
            sets: [seriePorDefecto()],
          },
        ];
      });
      setReplaceLineId(null);
    },
    [replaceLineId, setLineas],
  );

  const moverLinea = useCallback(
    (index: number, delta: number) => {
      setLineas((prev) => {
        const j = index + delta;
        if (j < 0 || j >= prev.length) return prev;
        const copia = [...prev];
        const [x] = copia.splice(index, 1);
        copia.splice(j, 0, x);
        return copia;
      });
    },
    [setLineas],
  );

  const eliminarLinea = useCallback(
    (lineId: string) => {
      setLineas((prev) => prev.filter((l) => l.lineId !== lineId));
    },
    [setLineas],
  );

  const abrirSheetReemplazar = useCallback((lineId: string) => {
    setReplaceLineId(lineId);
    setSheetAbierto(true);
  }, []);

  const actualizarNotaLinea = useCallback(
    (lineId: string, nota: string) => {
      setLineas((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, nota } : l)));
    },
    [setLineas],
  );

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

  const ejecutarTerminar = useCallback(async () => {
    if (!entrenoActivo || !user?.id) return;
    const snapshot = entrenoActivo.snapshotRutina;
    const snap: PostSnap = {
      lineas: entrenoActivo.lineas.map((l) => ({
        ...l,
        sets: l.sets.map((s) => ({ ...s })),
      })),
      routineId: entrenoActivo.routineId,
      nombre: entrenoActivo.nombre,
    };
    const hayModificaciones = snapshot != null && haycambiosEstructurales(snap.lineas, snapshot);
    const payload = lineasAPersistido(entrenoActivo.lineas);
    try {
      await entrenamientoService.guardarSetsCompletados(entrenoActivo.sessionId, payload);
      await terminarEntreno();
      setNombreNuevaRutina(snap.nombre || 'Mi rutina');
      if (snap.routineId == null) {
        postSnapRef.current = snap;
        setPostSnap(snap);
        setModalGuardarRutina(true);
      } else if (hayModificaciones) {
        postSnapRef.current = snap;
        setPostSnap(snap);
        setModalActualizarRutina(true);
      } else {
        postSnapRef.current = null;
        setPostSnap(null);
      }
    } catch {
      postSnapRef.current = null;
      Alert.alert('Error', 'No se pudo guardar el entreno.');
    }
  }, [entrenoActivo, user?.id, terminarEntreno]);

  const onTerminar = useCallback(() => {
    if (hayIncompletas) {
      setModalIncompletas(true);
      return;
    }
    setModalConfirmarTerminar(true);
  }, [hayIncompletas]);

  const onMinimizar = useCallback(() => {
    minimizar();
    allowNavAway.current = true;
    router.replace('/(tabs)/(entrenamiento)');
    setTimeout(() => {
      allowNavAway.current = false;
    }, 400);
  }, [minimizar, router]);

  const cerrarPostModalsYSalir = useCallback(() => {
    setModalGuardarRutina(false);
    setModalActualizarRutina(false);
    postSnapRef.current = null;
    setPostSnap(null);
  }, []);

  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      if (allowNavAway.current) return;
      if (postSnapRef.current) {
        e.preventDefault();
        cerrarPostModalsYSalir();
        return;
      }
      e.preventDefault();
      setModalDescartar(true);
    });
    return sub;
  }, [navigation, cerrarPostModalsYSalir]);

  const onConfirmarGuardarRutina = useCallback(async () => {
    if (!user?.id || !postSnap) return;
    const borrador = lineasARutinaSoloCompletadas(postSnap.lineas);
    if (!borrador.length) {
      Alert.alert('Sin datos', 'No hay series completadas para guardar como rutina.');
      cerrarPostModalsYSalir();
      return;
    }
    const titulo = nombreNuevaRutina.trim();
    if (!titulo) {
      Alert.alert('Nombre', 'Indica un nombre para la rutina.');
      return;
    }
    setGuardandoRutina(true);
    try {
      const res = await entrenamientoService.guardarRutinaDesdeBorrador(user.id, titulo, borrador);
      if (res.ok) cerrarPostModalsYSalir();
      else Alert.alert('Error', res.error);
    } finally {
      setGuardandoRutina(false);
    }
  }, [user?.id, postSnap, nombreNuevaRutina, cerrarPostModalsYSalir]);

  const onConfirmarActualizarRutina = useCallback(async () => {
    if (!postSnap?.routineId) return;
    const borrador = lineasARutinaCompleta(postSnap.lineas);
    setGuardandoRutina(true);
    try {
      await entrenamientoService.actualizarRutinaDesdeEntreno(postSnap.routineId, borrador);
      cerrarPostModalsYSalir();
    } finally {
      setGuardandoRutina(false);
    }
  }, [postSnap, cerrarPostModalsYSalir]);

  const onDescartarEntreno = useCallback(async () => {
    setModalDescartar(false);
    await descartarEntreno();
  }, [descartarEntreno]);

  const onDescartarEntrenoDesdeIncompletas = useCallback(async () => {
    setModalIncompletas(false);
    await descartarEntreno();
    allowNavAway.current = true;
    router.replace('/(tabs)/(entrenamiento)');
    setTimeout(() => {
      allowNavAway.current = false;
    }, 500);
  }, [descartarEntreno, router]);

  if (!entrenoActivo && !postSnap) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, justifyContent: 'center' }]}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  const cuerpoEntreno = entrenoActivo != null;

  return (
    <>
      {cuerpoEntreno ? (
        <KeyboardAvoidingView
          style={[styles.root, { paddingTop: insets.top }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={onMinimizar} accessibilityLabel="Minimizar entreno">
          <Ionicons name="chevron-down" size={26} color={c.textDisplay} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {entrenoActivo.nombre}
          </Text>
          <Text style={styles.cron}>{duracionTxt}</Text>
        </View>
        <Pressable style={styles.terminarBtn} onPress={onTerminar} accessibilityLabel="Terminar entreno">
          <Text style={styles.terminarTxt}>Terminar</Text>
        </Pressable>
      </View>

      <View style={[styles.body, { paddingBottom: insets.bottom }]}>
        {lineas.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: s.md }}>
            <Text style={{ ...ts.body, fontFamily: f.sans, color: c.textSecondary, textAlign: 'center' }}>
              Añade ejercicios para empezar
            </Text>
            <Pressable
              style={[styles.terminarBtn, { paddingHorizontal: s.lg, paddingVertical: s.md }]}
              onPress={() => setSheetAbierto(true)}
            >
              <Text style={styles.terminarTxt}>+ Agregar ejercicio</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {lineas.map((line, index) => (
                <EjercicioRutinaCard
                  key={line.lineId}
                  modo="entreno"
                  nota={line.nota ?? ''}
                  onNotaChange={(texto: string) => actualizarNotaLinea(line.lineId, texto)}
                  textoAnteriorSeries={textosAnteriorPorLineId.get(line.lineId)}
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
            <Pressable style={styles.footerBtn} onPress={() => setSheetAbierto(true)}>
              <Text style={styles.footerBtnText}>+ AGREGAR EJERCICIO</Text>
            </Pressable>
          </>
        )}
      </View>

      <AgregarEjercicioSheet
        visible={sheetAbierto}
        onClose={() => {
          setSheetAbierto(false);
          setReplaceLineId(null);
        }}
        onSeleccionar={incorporarEjercicio}
        onCrearPersonalizado={() => setCrearEjercicioAbierto(true)}
      />

      <CrearEjercicioModal
        visible={crearEjercicioAbierto}
        onClose={() => setCrearEjercicioAbierto(false)}
        onSubmit={onCrearEjercicioListo}
      />
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.root, { paddingTop: insets.top, backgroundColor: c.background }]} />
      )}

      <Modal visible={modalIncompletas} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Series sin completar</Text>
            <Text style={styles.modalBody}>
              Hay series que no marcaste como hechas. Puedes revisarlas o terminar y descartar las incompletas del
              registro.
            </Text>
            <View style={styles.modalIncompletasColumn}>
              <Pressable
                style={[styles.modalBtn, { alignSelf: 'stretch', alignItems: 'center' }]}
                onPress={() => setModalIncompletas(false)}
              >
                <Text style={styles.modalBtnTxt}>Revisar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnPrimary, { alignSelf: 'stretch', alignItems: 'center' }]}
                onPress={() => {
                  setModalIncompletas(false);
                  void ejecutarTerminar();
                }}
              >
                <Text style={[styles.modalBtnTxt, styles.modalBtnTxtOn]}>Descartar incompletas</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnDestructive, { alignSelf: 'stretch', alignItems: 'center' }]}
                onPress={() => void onDescartarEntrenoDesdeIncompletas()}
              >
                <Text style={styles.modalBtnTxtDestructive}>Descartar entreno</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalConfirmarTerminar} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>¿Terminar entreno?</Text>
            <Text style={styles.modalBody}>
              Se guardarán las series completadas y podrás guardar o actualizar la rutina si aplica.
            </Text>
            <View style={styles.modalIncompletasColumn}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnPrimary, { alignSelf: 'stretch', alignItems: 'center' }]}
                onPress={() => {
                  setModalConfirmarTerminar(false);
                  void ejecutarTerminar();
                }}
              >
                <Text style={[styles.modalBtnTxt, styles.modalBtnTxtOn]}>Terminar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnDestructive, { alignSelf: 'stretch', alignItems: 'center' }]}
                onPress={() => {
                  setModalConfirmarTerminar(false);
                  void onDescartarEntrenoDesdeIncompletas();
                }}
              >
                <Text style={styles.modalBtnTxtDestructive}>Descartar entreno</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalDescartar} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>¿Descartar entreno?</Text>
            <Text style={styles.modalBody}>Se eliminará la sesión sin guardar el progreso en el historial.</Text>
            <View style={styles.modalRow}>
              <Pressable style={styles.modalBtn} onPress={() => setModalDescartar(false)}>
                <Text style={styles.modalBtnTxt}>Continuar</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { borderColor: c.danger }]} onPress={onDescartarEntreno}>
                <Text style={[styles.modalBtnTxt, { color: c.danger }]}>Descartar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalGuardarRutina} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>¿Guardar como rutina?</Text>
            <Text style={styles.modalBody}>Se creará una plantilla con las series que completaste.</Text>
            <TextInput
              style={styles.modalInput}
              value={nombreNuevaRutina}
              onChangeText={setNombreNuevaRutina}
              placeholder="Nombre de la rutina"
              placeholderTextColor={c.textMuted}
            />
            <View style={styles.modalRow}>
              <Pressable style={styles.modalBtn} onPress={cerrarPostModalsYSalir} disabled={guardandoRutina}>
                <Text style={styles.modalBtnTxt}>Ahora no</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={() => void onConfirmarGuardarRutina()}
                disabled={guardandoRutina}
              >
                {guardandoRutina ? (
                  <ActivityIndicator color={c.textOnPrimary} />
                ) : (
                  <Text style={[styles.modalBtnTxt, styles.modalBtnTxtOn]}>Guardar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalActualizarRutina} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>¿Actualizar rutina?</Text>
            <Text style={styles.modalBody}>
              La plantilla de la rutina se reemplazará por los ejercicios y series que tienes ahora en pantalla.
            </Text>
            <View style={styles.modalRow}>
              <Pressable
                style={styles.modalBtn}
                onPress={() => void onConfirmarActualizarRutina()}
                disabled={guardandoRutina}
              >
                {guardandoRutina ? (
                  <ActivityIndicator color={c.textOnPrimary} />
                ) : (
                  <Text style={styles.modalBtnTxt}>Actualizar</Text>
                )}
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={cerrarPostModalsYSalir} disabled={guardandoRutina}>
                <Text style={[styles.modalBtnTxt, styles.modalBtnTxtOn]}>Continuar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
