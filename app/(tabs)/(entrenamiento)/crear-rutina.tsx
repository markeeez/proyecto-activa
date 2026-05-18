/**
 * Crear rutina
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

import LogoDark from '@/assets/images/logos/logo_sb.svg';
import LogoLight from '@/assets/images/logos/logo_light_sb.svg';

import { AgregarEjercicioSheet } from '@/components/entrenamiento/AgregarEjercicioSheet';
import { CrearEjercicioModal } from '@/components/entrenamiento/CrearEjercicioModal';
import { EjercicioRutinaCard } from '@/components/entrenamiento/EjercicioRutinaCard';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { tipoSerieUiADb } from '@/lib/entrenamientoSerie';
import { entrenamientoService } from '@/services/entrenamiento.service';
import { ejerciciosService } from '@/services/ejercicios.service';
import type { Exercise, TrackingMode } from '@/types/database.types';
import type { BorradorEjercicioLinea, BorradorSerieLinea } from '@/types/entrenamientoBorrador.types';

const MAX_ROUTINE_EXERCISES = 30;

function lid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function seriePorDefecto(): BorradorSerieLinea {
  return { setId: lid(), tipoUi: 'lineal', kg: '', reps: '' };
}

function registroCardioPorDefecto(): BorradorSerieLinea {
  return { setId: lid(), tipoUi: 'lineal', kg: '', reps: '', duracionSeg: '', distanciaKm: '' };
}

function esCardio(trackingMode: TrackingMode | null | undefined): boolean {
  return trackingMode === 'cardio_time' || trackingMode === 'cardio_time_distance';
}

function setsRutinaDesdeLinea(line: BorradorEjercicioLinea) {
  if (esCardio(line.tracking_mode)) {
    const registro = line.sets[0];
    return [
      {
        numero_serie: 1,
        tipo_serie: 'lineal' as const,
        repeticiones: null,
        peso_kg: null,
        tipo_peso: 'bodyweight' as const,
        duracion_seg: parseDuracionMinASeg(registro?.duracionSeg),
        distancia_km: line.tracking_mode === 'cardio_time_distance' ? parseOptFloat(registro?.distanciaKm ?? '') : null,
      },
    ];
  }

  return line.sets.map((set, i) => ({
    numero_serie: i + 1,
    tipo_serie: tipoSerieUiADb(set.tipoUi),
    repeticiones: parseOptInt(set.reps),
    peso_kg: parseOptFloat(set.kg),
    tipo_peso: 'kg' as const,
  }));
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

function parseDuracionMinASeg(s: string | undefined): number | null {
  const t = (s ?? '').trim();
  if (!t || t === '—') return null;
  if (!/^\d+$/.test(t)) return null;
  const min = parseInt(t, 10);
  return Number.isFinite(min) && min > 0 ? min * 60 : null;
}

const routineTheme = {
  dark: {
    background: '#0D0D0D',
    surface: '#1A1A1A',
    surfaceSoft: '#141414',
    textPrimary: '#FFFFFF',
    textSecondary: '#888888',
    textMuted: '#5F5F5F',
    accent: '#00D4FF',
    accentSoft: 'rgba(0, 212, 255, 0.12)',
    accentBorder: 'rgba(0, 212, 255, 0.35)',
    border: '#2A2A2A',
    transparent: 'transparent' as const,
    overlay: 'rgba(0,0,0,0.68)',
    danger: '#FF5A66',
    dangerText: '#F08080',
    chevron: '#C8C8C8',
  },
  light: {
    background: '#F5F5F5',
    surface: '#FFFFFF',
    surfaceSoft: '#FFFFFF',
    textPrimary: '#0F0F0F',
    textSecondary: '#666666',
    textMuted: '#999999',
    accent: '#00B4D8',
    accentSoft: 'rgba(0, 180, 216, 0.10)',
    accentBorder: 'rgba(0, 180, 216, 0.38)',
    border: '#D8D8D8',
    transparent: 'transparent' as const,
    overlay: 'rgba(0,0,0,0.32)',
    danger: '#D92D3A',
    dangerText: '#B00020',
    chevron: '#555555',
  },
};

type RoutineTheme = (typeof routineTheme)['dark'];

function makeStyles(t: RoutineTheme, f: ReturnType<typeof useTheme>['f']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.background },

    // Header: una sola fila con titulo centrado en absoluto
    headerWrap: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: t.background,
    },
    headerTop: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitle: {
      position: 'absolute',
      left: 0,
      right: 0,
      textAlign: 'center',
      fontFamily: f.sansMedium,
      color: t.textPrimary,
      fontSize: 17,
      lineHeight: 22,
      letterSpacing: -0.3,
      pointerEvents: 'none',
    },
    headerBtnText: {
      fontFamily: f.sans,
      color: t.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    saveBtn: {
      minHeight: 34,
      paddingHorizontal: 14,
      borderRadius: 8,
      backgroundColor: t.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnDisabled: {
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
    },
    saveBtnText: {
      fontFamily: f.monoBold,
      color: '#001015',
      fontSize: 11,
      lineHeight: 14,
    },
    saveBtnTextDisabled: { color: t.textSecondary },

    body: { flex: 1, paddingHorizontal: 16 },
    formBlock: { paddingTop: 4 },
    fieldLabel: {
      fontFamily: f.mono,
      fontSize: 11,
      lineHeight: 13,
      letterSpacing: 0.88,
      color: t.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    inputWrap: {
      flex: 1,
      minHeight: 46,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 8,
      backgroundColor: t.surface,
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    input: {
      fontFamily: f.sans,
      color: t.textPrimary,
      fontSize: 15,
      lineHeight: 20,
      paddingVertical: 0,
      paddingHorizontal: 0,
    },
    aiBtn: {
      width: 54,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.accent,
      backgroundColor: t.accentSoft,
      overflow: 'hidden',
    },

    section: { flex: 1, marginTop: 20 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    sectionTitle: {
      fontFamily: f.mono,
      fontSize: 11,
      lineHeight: 13,
      letterSpacing: 0.88,
      color: t.textSecondary,
      textTransform: 'uppercase',
    },
    sectionCount: {
      fontFamily: f.mono,
      fontSize: 11,
      lineHeight: 13,
      color: t.accent,
    },

    emptyCard: {
      flex: 1,
      minHeight: 240,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 32,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 8,
      backgroundColor: t.surface,
    },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceSoft,
      marginBottom: 14,
    },
    emptyTitle: {
      fontFamily: f.sansMedium,
      color: t.textPrimary,
      fontSize: 14,
      lineHeight: 18,
      textAlign: 'center',
      marginBottom: 6,
    },
    emptyText: {
      fontFamily: f.sans,
      color: t.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
      marginBottom: 24,
    },

    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 40,
      paddingVertical: 8,
      paddingHorizontal: 20,
      borderRadius: 8,
      backgroundColor: t.transparent,
      borderWidth: 1,
      borderColor: t.accent,
    },
    addBtnText: {
      fontFamily: f.sansMedium,
      color: t.accent,
      fontSize: 14,
      lineHeight: 18,
    },
    addBtnDisabled: { opacity: 0.4 },
    addBtnTextDisabled: { color: t.textSecondary },

    scroll: { flex: 1 },
    scrollContent: { paddingTop: 0, paddingBottom: 32 },
    footerBtn: { alignItems: 'center', marginTop: 12 },

    modalOverlay: {
      flex: 1,
      backgroundColor: t.overlay,
      justifyContent: 'center',
      padding: 16,
    },
    modalCard: {
      backgroundColor: t.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 16,
      paddingTop: 24,
      paddingBottom: 16,
      overflow: 'hidden',
    },
    modalAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: t.accent,
    },
    modalTitle: {
      fontFamily: f.sansBold,
      color: t.textPrimary,
      fontSize: 18,
      lineHeight: 23,
      marginBottom: 8,
    },
    modalBody: {
      fontFamily: f.sans,
      color: t.textSecondary,
      fontSize: 14,
      lineHeight: 22,
      marginBottom: 18,
    },
    modalRow: { gap: 8 },
    modalBtn: {
      minHeight: 48,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
    },
    modalBtnTxt: {
      fontFamily: f.monoBold,
      fontSize: 11,
      lineHeight: 14,
      color: t.textPrimary,
    },
    modalBtnDanger: { borderColor: t.danger },
    modalDangerText: { color: t.dangerText },
    modalPrimary: {
      minHeight: 48,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.accent,
      borderWidth: 1,
      borderColor: t.accent,
    },
    modalGhostText: {
      fontFamily: f.sansBold,
      color: '#001015',
      fontSize: 16,
      lineHeight: 24,
    },
  });
}

export default function CrearRutinaScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { f, isDark } = useTheme();
  const t = routineTheme[isDark ? 'dark' : 'light'];
  const styles = useMemo(() => makeStyles(t, f), [t, f]);

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

  const maxEjerciciosAlcanzado = lineas.length >= MAX_ROUTINE_EXERCISES;
  const formValid =
    titulo.trim().length > 0 &&
    lineas.length >= 1 &&
    lineas.length <= MAX_ROUTINE_EXERCISES;

  const abrirSheetNuevo = useCallback(() => {
    if (maxEjerciciosAlcanzado) {
      Alert.alert('Limite alcanzado', `Puedes anadir hasta ${MAX_ROUTINE_EXERCISES} ejercicios.`);
      return;
    }
    setReplaceLineId(null);
    setSheetAbierto(true);
  }, [maxEjerciciosAlcanzado]);

  const abrirSheetReemplazar = useCallback((lineId: string) => {
    setReplaceLineId(lineId);
    setSheetAbierto(true);
  }, []);

  const incorporarEjercicio = useCallback(
    (ex: Exercise) => {
      const tracking_mode = ex.tracking_mode ?? (ex.categoria === 'cardio' ? 'cardio_time' : 'strength');
      const sets = esCardio(tracking_mode) ? [registroCardioPorDefecto()] : [seriePorDefecto()];
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
                  foto_url: (ex as any).foto_url ?? null,
                  tracking_mode,
                  sets,
                }
              : l,
          );
        }
        if (prev.length >= MAX_ROUTINE_EXERCISES) {
          Alert.alert('Limite alcanzado', `Puedes anadir hasta ${MAX_ROUTINE_EXERCISES} ejercicios.`);
          return prev;
        }
        return [
          ...prev,
          {
            lineId: lid(),
            exerciseId: ex.id,
            nombre: ex.nombre,
            musculo_primario: ex.musculo_primario,
            foto_url: (ex as any).foto_url ?? null,
            tracking_mode,
            sets,
          },
        ];
      });
      setReplaceLineId(null);
    },
    [replaceLineId],
  );

  const onSeleccionarEjercicio = useCallback(
    (ex: Exercise) => incorporarEjercicio(ex),
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
        Alert.alert('Sesion', 'Inicia sesion para crear ejercicios.');
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
      if (!user?.id) Alert.alert('Sesion', 'Inicia sesion para guardar.');
      if (lineas.length > MAX_ROUTINE_EXERCISES) {
        Alert.alert('Limite', `La rutina no puede superar ${MAX_ROUTINE_EXERCISES} ejercicios.`);
      }
      return;
    }

    const ejercicios = lineas.map((line, idx) => ({
      exercise_id: line.exerciseId,
      orden: idx + 1,
      sets: setsRutinaDesdeLinea(line),
    }));

    setGuardando(true);
    try {
      const res = await entrenamientoService.guardarRutinaDesdeBorrador(
        user.id,
        titulo.trim(),
        ejercicios,
      );
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
      {/* ── Header: Cancelar | Crear rutina | GUARDAR en una sola fila ── */}
      <View style={styles.headerWrap}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle} numberOfLines={1}>Crear rutina</Text>
          <Pressable onPress={() => setModalSalir(true)} hitSlop={12} accessibilityRole="button">
            <Text style={styles.headerBtnText}>Cancelar</Text>
          </Pressable>
          <Pressable
            onPress={guardar}
            disabled={!formValid || guardando}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityState={{ disabled: !formValid || guardando }}
            style={[styles.saveBtn, (!formValid || guardando) && styles.saveBtnDisabled]}
          >
            {guardando ? (
              <ActivityIndicator color="#001015" size="small" />
            ) : (
              <Text style={[styles.saveBtnText, !formValid && styles.saveBtnTextDisabled]}>
                GUARDAR
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* ── Body ── */}
      <View style={[styles.body, { paddingBottom: insets.bottom }]}>
        <View style={styles.formBlock}>
          <Text style={styles.fieldLabel}>Titulo de la rutina</Text>
          <View style={styles.titleRow}>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Ej. Piernas"
                placeholderTextColor={t.textSecondary}
                value={titulo}
                onChangeText={setTitulo}
                autoCorrect={false}
                accessibilityLabel="Titulo de la rutina"
              />
            </View>
            <Pressable
              style={styles.aiBtn}
              onPress={() => {}}
              accessibilityRole="button"
              accessibilityLabel="Generar con IA"
            >
              {isDark
                ? <LogoDark width={32} height={32} />
                : <LogoLight width={32} height={32} />
              }
            </Pressable>
          </View>
        </View>

        {/* ── Ejercicios ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ejercicios</Text>
            <Text style={styles.sectionCount}>{lineas.length}/{MAX_ROUTINE_EXERCISES}</Text>
          </View>

          {lineas.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="barbell-outline" size={24} color={t.textSecondary} />
              </View>
              <Text style={styles.emptyTitle}>Aun no hay ejercicios</Text>
              <Text style={styles.emptyText}>
                Agrega ejercicios manualmente{String.fromCharCode(10)}o usa la IA para generarlos.
              </Text>
              <Pressable
                style={[styles.addBtn, maxEjerciciosAlcanzado && styles.addBtnDisabled]}
                onPress={abrirSheetNuevo}
                disabled={maxEjerciciosAlcanzado}
                accessibilityRole="button"
                accessibilityState={{ disabled: maxEjerciciosAlcanzado }}
              >
                <Ionicons name="add" size={18} color={maxEjerciciosAlcanzado ? t.textSecondary : t.accent} />
                <Text style={[styles.addBtnText, maxEjerciciosAlcanzado && styles.addBtnTextDisabled]}>
                  Agregar ejercicio
                </Text>
              </Pressable>
            </View>
          ) : (
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
              <View style={styles.footerBtn}>
                <Pressable
                  style={[styles.addBtn, maxEjerciciosAlcanzado && styles.addBtnDisabled]}
                  onPress={abrirSheetNuevo}
                  disabled={maxEjerciciosAlcanzado}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: maxEjerciciosAlcanzado }}
                >
                  <Ionicons name="add" size={18} color={maxEjerciciosAlcanzado ? t.textSecondary : t.accent} />
                  <Text style={[styles.addBtnText, maxEjerciciosAlcanzado && styles.addBtnTextDisabled]}>
                    Agregar ejercicio
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      {/* ── Sheets ── */}
      <AgregarEjercicioSheet
        visible={sheetAbierto}
        onClose={() => { setSheetAbierto(false); setReplaceLineId(null); }}
        onSeleccionar={onSeleccionarEjercicio}
        onCrearPersonalizado={() => setCrearEjercicioAbierto(true)}
      />
      <CrearEjercicioModal
        visible={crearEjercicioAbierto}
        onClose={() => setCrearEjercicioAbierto(false)}
        onSubmit={onCrearEjercicioListo}
      />

      {/* ── Modal salir ── */}
      <Modal visible={modalSalir} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalAccent} />
            <Text style={styles.modalTitle}>Descartar borrador?</Text>
            <Text style={styles.modalBody}>Perderas los cambios sin guardar.</Text>
            <View style={styles.modalRow}>
              <Pressable style={styles.modalPrimary} onPress={() => setModalSalir(false)}>
                <Text style={styles.modalGhostText}>Continuar editando</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnDanger]}
                onPress={() => {
                  allowExitRef.current = true;
                  setModalSalir(false);
                  router.back();
                }}
              >
                <Text style={[styles.modalBtnTxt, styles.modalDangerText]}>DESCARTAR</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
