/**
 * Crear rutina — borrador con ejercicios/series, búsqueda Supabase y guardado en sesión + series.
 */

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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';

import { AgregarEjercicioSheet } from '@/components/entrenamiento/AgregarEjercicioSheet';
import { CrearEjercicioModal } from '@/components/entrenamiento/CrearEjercicioModal';
import { EjercicioRutinaCard } from '@/components/entrenamiento/EjercicioRutinaCard';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { tipoSerieUiADb } from '@/lib/entrenamientoSerie';
import { entrenamientoService } from '@/services/entrenamiento.service';
import { ejerciciosService } from '@/services/ejercicios.service';
import type { Theme } from '@/constants/theme';
import type { Exercise } from '@/types/database.types';
import type { BorradorEjercicioLinea, BorradorSerieLinea } from '@/types/entrenamientoBorrador.types';

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

function makeStyles(c: Theme, f: ReturnType<typeof useTheme>['f'], ts: ReturnType<typeof useTheme>['ts'], s: ReturnType<typeof useTheme>['s'], r: ReturnType<typeof useTheme>['r']) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    headerWrap: {
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
      minHeight: 48,
      justifyContent: 'center',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitle: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      textAlign: 'center',
    },
    headerTitleAbs: {
      position: 'absolute',
      left: s.md,
      right: s.md,
      textAlign: 'center',
      pointerEvents: 'none',
    },
    headerBtnText: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    saveBtn: {
      paddingHorizontal: s.md,
      paddingVertical: s.xs + 2,
      borderRadius: r.technical,
      backgroundColor: c.primary,
      borderWidth: 1,
      borderColor: c.primary,
    },
    saveBtnDisabled: {
      opacity: 0.35,
      backgroundColor: c.surfaceElevated,
      borderColor: c.borderVisible,
    },
    saveBtnText: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textOnPrimary,
    },
    saveBtnTextDisabled: {
      color: c.textMuted,
    },
    body: {
      flex: 1,
      paddingHorizontal: s.md,
    },
    inputWrap: {
      marginTop: s.md,
      borderBottomWidth: 1,
      borderBottomColor: c.borderVisible,
      paddingBottom: s.xs,
    },
    input: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
      paddingVertical: s.xs,
      paddingHorizontal: 0,
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
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: s.md,
      paddingBottom: s.xl,
    },
    footerBtn: {
      paddingVertical: s.md,
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: c.border,
      marginHorizontal: -s.md,
      paddingHorizontal: s.md,
      backgroundColor: c.background,
    },
    footerBtnText: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.primary,
      letterSpacing: 0.7,
    },
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
    modalBtnTxt: { ...ts.bodySm, fontFamily: f.sans, color: c.textDisplay },
  });
}

export default function CrearRutinaScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [modalSalir, setModalSalir] = useState(false);
  const allowExitRef = useRef(false);

  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      if (allowExitRef.current) return;
      e.preventDefault();
      setModalSalir(true);
    });
    return sub;
  }, [navigation]);

  const [titulo, setTitulo] = useState('');
  const [lineas, setLineas] = useState<BorradorEjercicioLinea[]>([]);
  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [crearEjercicioAbierto, setCrearEjercicioAbierto] = useState(false);
  const [replaceLineId, setReplaceLineId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const formValid = titulo.trim().length > 0 && lineas.length >= 1;

  const abrirSheetNuevo = useCallback(() => {
    setReplaceLineId(null);
    setSheetAbierto(true);
  }, []);

  const abrirSheetReemplazar = useCallback((lineId: string) => {
    setReplaceLineId(lineId);
    setSheetAbierto(true);
  }, []);

  const incorporarEjercicio = useCallback((ex: Exercise) => {
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
                foto_url: ex.foto_url ?? null,
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
          foto_url: ex.foto_url ?? null,
          sets: [seriePorDefecto()],
        },
      ];
    });
    setReplaceLineId(null);
  }, [replaceLineId]);

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

  const guardar = useCallback(async () => {
    if (!formValid || !user?.id) {
      if (!user?.id) Alert.alert('Sesión', 'Inicia sesión para guardar.');
      return;
    }

    const ejercicios = lineas.map((line, idx) => ({
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
      const res = await entrenamientoService.guardarRutinaDesdeBorrador(user.id, titulo.trim(), ejercicios);
      if (res.ok) {
        allowExitRef.current = true;
        router.back();
      } else {
        Alert.alert('No se pudo guardar', res.error);
      }
    } finally {
      setGuardando(false);
    }
  }, [formValid, user?.id, lineas, titulo, router]);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.headerWrap}>
        <Text style={[styles.headerTitle, styles.headerTitleAbs]} numberOfLines={1}>
          Crear Rutina
        </Text>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <Pressable onPress={() => setModalSalir(true)} hitSlop={10} accessibilityRole="button">
              <Text style={styles.headerBtnText}>Cancelar</Text>
            </Pressable>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Pressable
              onPress={guardar}
              disabled={!formValid || guardando}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityState={{ disabled: !formValid || guardando }}
              style={[styles.saveBtn, !formValid && styles.saveBtnDisabled]}
            >
              {guardando ? (
                <ActivityIndicator color={c.textOnPrimary} size="small" />
              ) : (
                <Text style={[styles.saveBtnText, !formValid && styles.saveBtnTextDisabled]}>Guardar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      <View style={[styles.body, { paddingBottom: insets.bottom }]}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Título de la rutina"
            placeholderTextColor={c.textMuted}
            value={titulo}
            onChangeText={setTitulo}
            autoCorrect={false}
            accessibilityLabel="Título de la rutina"
          />
        </View>

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
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {lineas.map((line, index) => (
                <EjercicioRutinaCard
                  key={line.lineId}
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
            <Pressable style={styles.footerBtn} onPress={abrirSheetNuevo} accessibilityRole="button">
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
        onSeleccionar={onSeleccionarEjercicio}
        onCrearPersonalizado={() => setCrearEjercicioAbierto(true)}
      />

      <CrearEjercicioModal
        visible={crearEjercicioAbierto}
        onClose={() => setCrearEjercicioAbierto(false)}
        onSubmit={onCrearEjercicioListo}
      />

      <Modal visible={modalSalir} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>¿Descartar borrador?</Text>
            <Text style={styles.modalBody}>Perderás los cambios de esta rutina sin guardar.</Text>
            <View style={styles.modalRow}>
              <Pressable style={styles.modalBtn} onPress={() => setModalSalir(false)}>
                <Text style={styles.modalBtnTxt}>Continuar</Text>
              </Pressable>
              <Pressable
                style={styles.modalBtn}
                onPress={() => {
                  allowExitRef.current = true;
                  setModalSalir(false);
                  router.back();
                }}
              >
                <Text style={[styles.modalBtnTxt, { color: c.danger }]}>Descartar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
