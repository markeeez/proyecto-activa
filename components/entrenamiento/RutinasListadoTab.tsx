/**
 * Tab Rutinas - contenido visual de WorkoutsScreen.
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import VLogoLight from '@/assets/images/logo_light_sb.svg';
import VLogoDark from '@/assets/images/logo_sb.svg';
import { useEntreno } from '@/context/EntrenoContext';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { borrarRutina } from '@/services/entrenamiento.service';

type Routine = {
  id: string;
  user_id: string;
  nombre: string;
  descripcion: string;
  num_ejercicios: number;
  musculos: string[];
  imagen_url: string | null;
  is_community: boolean;
};

type FiltroRutinas = 'mis' | 'favoritas';

type RoutineExerciseJoinRow = {
  orden: number;
  exercises: RoutineExerciseJoin | RoutineExerciseJoin[] | null;
};

type RoutineExerciseJoin = {
  nombre: string | null;
  musculo_primario: string | null;
  musculos_secundarios: string[] | null;
};

type RoutineJoinRow = {
  id: string;
  nombre: string;
  created_by?: string | null;
  routine_exercises?: RoutineExerciseJoinRow[] | null;
};

type FavoriteRoutineJoinRow = {
  routines: RoutineJoinRow | RoutineJoinRow[] | null;
};

type LayoutBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type RoutinesTheme = {
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  border: string;
  shadow: string;
  shadowOpacity: number;
  mutedSurface: string;
  ctaStart: string;
  ctaEnd: string;
  ctaWave: string;
  ctaIconBg: string;
  white: string;
  whiteMuted: string;
  danger: string;
};

const ROUTINES_COLORS = {
  light: {
    background: '#F5F5F5',
    surface: '#FFFFFF',
    textPrimary: '#0D0D0D',
    textSecondary: '#888888',
    accent: '#00B4D8',
    border: '#E0E0E0',
    shadow: 'rgba(0,0,0,0.08)',
    shadowOpacity: 1,
    mutedSurface: '#F7F9FA',
    ctaStart: '#00B4D8',
    ctaEnd: '#0096C7',
    ctaWave: 'rgba(255,255,255,0.18)',
    ctaIconBg: 'rgba(255,255,255,0.24)',
    white: '#FFFFFF',
    whiteMuted: 'rgba(255,255,255,0.74)',
    danger: '#D71921',
  },
  dark: {
    background: '#0D0D0D',
    surface: '#1A1A1A',
    textPrimary: '#FFFFFF',
    textSecondary: '#888888',
    accent: '#00B4D8',
    border: '#2A2A2A',
    shadow: 'rgba(0,0,0,0)',
    shadowOpacity: 0,
    mutedSurface: '#151515',
    ctaStart: '#00B4D8',
    ctaEnd: '#0077B6',
    ctaWave: 'rgba(255,255,255,0.14)',
    ctaIconBg: 'rgba(255,255,255,0.22)',
    white: '#FFFFFF',
    whiteMuted: 'rgba(255,255,255,0.72)',
    danger: '#D71921',
  },
} as const;

function getRoutineTheme(scheme: 'light' | 'dark'): RoutinesTheme {
  return scheme === 'dark' ? ROUTINES_COLORS.dark : ROUTINES_COLORS.light;
}

function uniqueClean(values: (string | null | undefined)[]): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  );
}

// --- RUTINAS STYLES START ---
function makeStyles(
  theme: RoutinesTheme,
  f: ReturnType<typeof useTheme>['f'],
) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: theme.background,
    },
    root: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
      gap: 14,
    },
    ctaCard: {
      minHeight: 86,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: theme.ctaStart,
      shadowColor: theme.shadow,
      shadowOpacity: theme.shadowOpacity,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: theme.shadowOpacity > 0 ? 3 : 0,
    },
    ctaGradientLayer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.ctaEnd,
      opacity: 0.28,
      left: '46%',
    },
    waveOne: {
      position: 'absolute',
      width: 170,
      height: 170,
      borderRadius: 85,
      borderWidth: 1,
      borderColor: theme.ctaWave,
      right: -46,
      top: -76,
    },
    waveTwo: {
      position: 'absolute',
      width: 132,
      height: 132,
      borderRadius: 66,
      borderWidth: 1,
      borderColor: theme.ctaWave,
      right: -18,
      top: -42,
    },
    waveThree: {
      position: 'absolute',
      width: 92,
      height: 92,
      borderRadius: 46,
      borderWidth: 1,
      borderColor: theme.ctaWave,
      right: 16,
      top: -12,
    },
    ctaContent: {
      minHeight: 86,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      gap: 16,
    },
    ctaIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.ctaIconBg,
    },
    ctaTitle: {
      fontFamily: f.sansBold,
      fontSize: 16,
      lineHeight: 20,
      color: theme.white,
    },
    ctaSubtitle: {
      marginTop: 3,
      fontFamily: f.sans,
      fontSize: 12,
      lineHeight: 16,
      color: theme.whiteMuted,
    },
    quickActionsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    quickCard: {
      flex: 1,
      minHeight: 98,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      shadowColor: theme.shadow,
      shadowOpacity: theme.shadowOpacity,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: theme.shadowOpacity > 0 ? 2 : 0,
    },
    quickIconBox: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.mutedSurface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    quickPlusBadge: {
      position: 'absolute',
      right: 8,
      bottom: 8,
    },
    quickTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    quickTitle: {
      fontFamily: f.sansBold,
      fontSize: 13,
      lineHeight: 17,
      color: theme.textPrimary,
    },
    quickSubtitle: {
      marginTop: 4,
      fontFamily: f.sans,
      fontSize: 10,
      lineHeight: 13,
      color: theme.textSecondary,
    },
    sectionHeader: {
      minHeight: 46,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      shadowColor: theme.shadow,
      shadowOpacity: theme.shadowOpacity,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: theme.shadowOpacity > 0 ? 1 : 0,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      minWidth: 0,
      flex: 1,
    },
    sectionTitle: {
      fontFamily: f.sansBold,
      fontSize: 13,
      lineHeight: 17,
      color: theme.textPrimary,
    },
    sectionCount: {
      fontFamily: f.sansBold,
      fontSize: 12,
      lineHeight: 16,
      color: theme.accent,
      marginLeft: 12,
    },
    filterOptions: {
      marginTop: -8,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      shadowColor: theme.shadow,
      shadowOpacity: theme.shadowOpacity,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: theme.shadowOpacity > 0 ? 1 : 0,
    },
    filterOption: {
      minHeight: 44,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    filterOptionActive: {
      backgroundColor: theme.mutedSurface,
    },
    filterOptionText: {
      fontFamily: f.sansBold,
      fontSize: 13,
      lineHeight: 17,
      color: theme.textPrimary,
    },
    filterOptionDivider: {
      height: 1,
      backgroundColor: theme.border,
    },
    filterMenuLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 40,
    },
    filterMenuDismiss: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
    },
    filterMenuPopover: {
      position: 'absolute',
      width: 190,
      maxHeight: 180,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.surface,
      paddingVertical: 6,
      paddingHorizontal: 8,
      shadowColor: theme.shadow,
      shadowOpacity: theme.shadowOpacity,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: theme.shadowOpacity > 0 ? 4 : 0,
      zIndex: 30,
    },
    routineMenuPopover: {
      position: 'absolute',
      width: 190,
      maxHeight: 180,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.surface,
      paddingVertical: 6,
      paddingHorizontal: 8,
      shadowColor: theme.shadow,
      shadowOpacity: theme.shadowOpacity,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: theme.shadowOpacity > 0 ? 4 : 0,
      zIndex: 30,
    },
    filterMenuTitle: {
      fontSize: 12,
      lineHeight: 15,
      fontFamily: f.sansBold,
      color: theme.textPrimary,
      paddingHorizontal: 6,
      paddingVertical: 6,
    },
    filterMenuOption: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 8,
      paddingHorizontal: 6,
    },
    filterMenuLogo: {
      width: 17,
      height: 17,
    },
    filterMenuOptionActive: {
      backgroundColor: theme.mutedSurface,
    },
    filterMenuOptionText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 15,
      fontFamily: f.sansBold,
      color: theme.textPrimary,
    },
    filterMenuOptionDanger: {
      flex: 1,
      fontSize: 12,
      lineHeight: 15,
      fontFamily: f.sansBold,
      color: theme.danger,
    },
    filterMenuDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
      marginVertical: 2,
    },
    listArea: {
      gap: 12,
    },
    loadingBox: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    emptyText: {
      paddingVertical: 22,
      textAlign: 'center',
      fontFamily: f.sans,
      fontSize: 13,
      lineHeight: 18,
      color: theme.textSecondary,
    },
    routineCard: {
      borderRadius: 16,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 12,
      shadowColor: theme.shadow,
      shadowOpacity: theme.shadowOpacity,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: theme.shadowOpacity > 0 ? 2 : 0,
    },
    routineTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    routineContent: {
      flex: 1,
      minWidth: 0,
      paddingTop: 2,
      paddingRight: 28,
    },
    routineName: {
      fontFamily: f.sansBold,
      fontSize: 15,
      lineHeight: 19,
      color: theme.textPrimary,
    },
    metaRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: 12,
      rowGap: 4,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      fontFamily: f.sans,
      fontSize: 10,
      lineHeight: 13,
      color: theme.textSecondary,
    },
    menuButton: {
      position: 'absolute',
      top: 4,
      right: 0,
      width: 34,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    routineDivider: {
      height: 1,
      backgroundColor: theme.border,
      marginTop: 12,
      marginBottom: 8,
    },
    startRoutineButton: {
      minHeight: 32,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 12,
    },
    startRoutineText: {
      fontFamily: f.monoBold,
      fontSize: 10,
      lineHeight: 14,
      letterSpacing: 0.8,
      color: theme.accent,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      backgroundColor: 'rgba(0,0,0,0.58)',
    },
    confirmCard: {
      width: '100%',
      maxWidth: 360,
      alignSelf: 'center',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 16,
      paddingTop: 24,
      paddingBottom: 16,
      overflow: 'hidden',
      shadowColor: theme.shadow,
      shadowOpacity: theme.shadowOpacity,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: theme.shadowOpacity > 0 ? 4 : 0,
    },
    confirmAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: theme.accent,
    },
    confirmTitle: {
      fontFamily: f.sansBold,
      fontSize: 18,
      lineHeight: 23,
      color: theme.textPrimary,
    },
    confirmBody: {
      marginTop: 8,
      fontFamily: f.sans,
      fontSize: 14,
      lineHeight: 22,
      color: theme.textSecondary,
      marginBottom: 18,
    },
    confirmRoutineName: {
      fontFamily: f.sansBold,
      color: theme.textPrimary,
    },
    confirmActions: {
      flexDirection: 'column',
      gap: 8,
    },
    confirmButton: {
      minHeight: 48,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderWidth: 1,
    },
    confirmCancelButton: {
      borderColor: theme.accent,
      backgroundColor: theme.surface,
    },
    confirmDeleteButton: {
      borderColor: theme.danger,
      backgroundColor: theme.danger,
    },
    confirmCancelText: {
      fontFamily: f.sansMedium,
      fontSize: 16,
      lineHeight: 24,
      color: theme.accent,
      textAlign: 'center',
    },
    confirmDeleteText: {
      fontFamily: f.sansBold,
      fontSize: 16,
      lineHeight: 24,
      color: theme.white,
      textAlign: 'center',
    },
    disabled: {
      opacity: 0.5,
    },
  });
}
// --- RUTINAS STYLES END ---

export function RutinasListadoTab() {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { f, scheme } = useTheme();
  const { user } = useAuth();
  const { iniciarEntrenoVacio, iniciarDesdeRutina, entrenoActivo } = useEntreno();
  const theme = useMemo(() => getRoutineTheme(scheme), [scheme]);
  const styles = useMemo(() => makeStyles(theme, f), [theme, f]);
  const VLogo = scheme === 'dark' ? VLogoDark : VLogoLight;

  const [filtroRutinas, setFiltroRutinas] = useState<FiltroRutinas>('mis');
  const [filtroOpen, setFiltroOpen] = useState(false);
  const [filtroScrollY, setFiltroScrollY] = useState(0);
  const [filtroLayout, setFiltroLayout] = useState({ x: 20, y: 0, width: 0, height: 46 });
  const [routineMenu, setRoutineMenu] = useState<Routine | null>(null);
  const [routineMenuLayout, setRoutineMenuLayout] = useState<LayoutBox>({ x: 20, y: 0, width: 0, height: 74 });
  const [listAreaLayout, setListAreaLayout] = useState<LayoutBox>({ x: 20, y: 0, width: 0, height: 0 });
  const [confirmRoutine, setConfirmRoutine] = useState<Routine | null>(null);
  const [eliminandoRoutineId, setEliminandoRoutineId] = useState<string | null>(null);
  const [iniciandoVacio, setIniciandoVacio] = useState(false);
  const [rutinaIniciandoId, setRutinaIniciandoId] = useState<string | null>(null);
  const iniciandoVacioRef = useRef(false);
  const rutinaIniciandoRef = useRef<string | null>(null);
  const routineLayoutsRef = useRef<Record<string, LayoutBox>>({});

  const { misRutinas, favoritas, loading, reload, removeRoutine, removeFavorite } = useRoutines(user?.id);
  const rutinasFiltradas = filtroRutinas === 'mis' ? misRutinas : favoritas;
  const hayEntrenoActivo = entrenoActivo != null;

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const onEmpezarEntrenoVacio = useCallback(async () => {
    if (hayEntrenoActivo || iniciandoVacioRef.current) return;
    iniciandoVacioRef.current = true;
    setIniciandoVacio(true);
    try {
      await iniciarEntrenoVacio('Entreno vacío');
      router.push('/(tabs)/(entrenamiento)/entreno-activo');
    } finally {
      iniciandoVacioRef.current = false;
      setIniciandoVacio(false);
    }
  }, [hayEntrenoActivo, iniciarEntrenoVacio, router]);

  const onEmpezarRutina = useCallback(
    async (routine: Routine) => {
      if (hayEntrenoActivo || rutinaIniciandoRef.current != null) return;
      rutinaIniciandoRef.current = routine.id;
      setRutinaIniciandoId(routine.id);
      try {
        await iniciarDesdeRutina(routine.id, routine.nombre);
        router.push('/(tabs)/(entrenamiento)/entreno-activo');
      } finally {
        rutinaIniciandoRef.current = null;
        setRutinaIniciandoId(null);
      }
    },
    [hayEntrenoActivo, iniciarDesdeRutina, router],
  );

  const filtroLabel = filtroRutinas === 'mis' ? 'Mis rutinas' : 'Favoritas';
  const rutinaCountLabel = `${rutinasFiltradas.length} rutina${rutinasFiltradas.length === 1 ? '' : 's'}`;
  const seleccionarFiltro = useCallback((next: FiltroRutinas) => {
    setFiltroRutinas(next);
    setFiltroOpen(false);
  }, []);

  const onConsultarV = useCallback(() => {
    if (!routineMenu) return;
    Alert.alert('Consultar a V', `Consulta sobre ${routineMenu.nombre}`);
    setRoutineMenu(null);
  }, [routineMenu]);

  const onEliminarRutina = useCallback(() => {
    const routine = routineMenu;
    if (!routine) return;
    setRoutineMenu(null);
    setConfirmRoutine(routine);
  }, [routineMenu]);

  const onConfirmarEliminarRutina = useCallback(async () => {
    if (!confirmRoutine || eliminandoRoutineId) return;

    setEliminandoRoutineId(confirmRoutine.id);
    try {
      await borrarRutina(confirmRoutine.id);
      removeRoutine(confirmRoutine.id);
      setConfirmRoutine(null);
    } catch (error) {
      Alert.alert('No se pudo eliminar', error instanceof Error ? error.message : 'Inténtalo de nuevo.');
    } finally {
      setEliminandoRoutineId(null);
    }
  }, [confirmRoutine, eliminandoRoutineId, removeRoutine]);

  const onQuitarFavorito = useCallback(() => {
    const routine = routineMenu;
    if (!routine || !user?.id) return;
    setRoutineMenu(null);
    void (async () => {
      const { error } = await supabase
        .from('user_favorite_routines')
        .delete()
        .eq('user_id', user.id)
        .eq('routine_id', routine.id);

      if (error) {
        Alert.alert('No se pudo quitar', error.message || 'Inténtalo de nuevo.');
        return;
      }

      removeFavorite(routine.id);
    })();
  }, [removeFavorite, routineMenu, user?.id]);

  return (
    <View style={styles.root}>
      {/* --- RUTINAS TAB START --- */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={(event) => setFiltroScrollY(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
      <Pressable
        style={[styles.ctaCard, (hayEntrenoActivo || iniciandoVacio) && styles.disabled]}
        onPress={() => void onEmpezarEntrenoVacio()}
        disabled={hayEntrenoActivo || iniciandoVacio}
        accessibilityRole="button"
        accessibilityState={{ disabled: hayEntrenoActivo || iniciandoVacio }}
      >
        <View style={styles.ctaGradientLayer} />
        <View style={styles.waveOne} />
        <View style={styles.waveTwo} />
        <View style={styles.waveThree} />
        <View style={styles.ctaContent}>
          <View style={styles.ctaIconCircle}>
            {iniciandoVacio ? (
              <ActivityIndicator color={theme.white} size="small" />
            ) : (
              <Ionicons name="add" size={30} color={theme.white} />
            )}
          </View>
          <View>
            <Text style={styles.ctaTitle}>Empezar entrenamiento vacío</Text>
            <Text style={styles.ctaSubtitle}>Crea tu entrenamiento desde cero</Text>
          </View>
        </View>
      </Pressable>

      <View style={styles.quickActionsRow}>
        <Pressable
          style={styles.quickCard}
          onPress={() => router.push('/(tabs)/(entrenamiento)/crear-rutina')}
          accessibilityRole="button"
        >
          <View style={styles.quickIconBox}>
            <Ionicons name="document-text-outline" size={22} color={theme.textPrimary} />
            <Ionicons
              name="add"
              size={13}
              color={theme.textPrimary}
              style={styles.quickPlusBadge}
            />
          </View>
          <View style={styles.quickTextWrap}>
            <Text style={styles.quickTitle} numberOfLines={1}>Nueva rutina</Text>
            <Text style={styles.quickSubtitle} numberOfLines={2}>Crea una rutina desde cero</Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.quickCard}
          onPress={() => router.push('/(tabs)/(entrenamiento)/explorar-rutinas')}
          accessibilityRole="button"
        >
          <View style={styles.quickIconBox}>
            <Ionicons name="compass-outline" size={23} color={theme.textPrimary} />
          </View>
          <View style={styles.quickTextWrap}>
            <Text style={styles.quickTitle} numberOfLines={1}>Explorar</Text>
            <Text style={styles.quickSubtitle} numberOfLines={2}>Descubre rutinas de la comunidad</Text>
          </View>
        </Pressable>
      </View>

      <Pressable
        style={styles.sectionHeader}
        onLayout={(event) => {
          setFiltroLayout(event.nativeEvent.layout);
        }}
        onPress={() => {
          setRoutineMenu(null);
          setFiltroOpen((open) => !open);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: filtroOpen }}
      >
        <View style={styles.sectionTitleRow}>
          <Ionicons name={filtroRutinas === 'mis' ? 'bookmark' : 'star'} size={18} color={theme.accent} />
          <Text style={styles.sectionTitle}>{filtroLabel}</Text>
          <Ionicons
            name={filtroOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.textPrimary}
          />
        </View>
        <Text style={styles.sectionCount}>{rutinaCountLabel}</Text>
      </Pressable>

      {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : (
          <View
            style={styles.listArea}
            onLayout={(event) => {
              setListAreaLayout(event.nativeEvent.layout);
            }}
          >
            {!user?.id ? (
              <Text style={styles.emptyText}>Inicia sesión para ver tus rutinas.</Text>
            ) : rutinasFiltradas.length === 0 ? (
              <Text style={styles.emptyText}>
                {filtroRutinas === 'mis' ? 'No tienes rutinas creadas todavía.' : 'Aún no tienes rutinas favoritas.'}
              </Text>
            ) : (
              rutinasFiltradas.map((routine) => (
                <View
                  key={routine.id}
                  style={styles.routineCard}
                  onLayout={(event) => {
                    routineLayoutsRef.current[routine.id] = event.nativeEvent.layout;
                  }}
                >
                  <View style={styles.routineTop}>
                    <View style={styles.routineContent}>
                      <Pressable
                        onPress={() =>
                          router.push(`/(tabs)/(entrenamiento)/rutina/${routine.id}` as Parameters<typeof router.push>[0])
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir rutina ${routine.nombre}`}
                      >
                        <Text style={styles.routineName} numberOfLines={1}>{routine.nombre}</Text>
                      </Pressable>

                      <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                          <Ionicons name="barbell-outline" size={11} color={theme.textSecondary} />
                          <Text style={styles.metaText}>{routine.num_ejercicios} ejercicios</Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Ionicons name="body-outline" size={11} color={theme.textSecondary} />
                          <Text style={styles.metaText} numberOfLines={2}>
                            {routine.musculos.length > 0 ? routine.musculos.join(', ') : 'Sin músculos'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Pressable
                      style={styles.menuButton}
                      onPress={() => {
                        setFiltroOpen(false);
                        setRoutineMenuLayout(
                          routineLayoutsRef.current[routine.id] ?? { x: 20, y: 0, width: 0, height: 74 },
                        );
                        setRoutineMenu(routine);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Opciones de rutina"
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
                    </Pressable>
                  </View>

                  <View style={styles.routineDivider} />

                  <Pressable
                    style={[
                      styles.startRoutineButton,
                      (hayEntrenoActivo || rutinaIniciandoId != null) && styles.disabled,
                    ]}
                    onPress={() => void onEmpezarRutina(routine)}
                    disabled={hayEntrenoActivo || rutinaIniciandoId != null}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: hayEntrenoActivo || rutinaIniciandoId != null }}
                  >
                    {rutinaIniciandoId === routine.id ? (
                      <ActivityIndicator color={theme.accent} size="small" />
                    ) : (
                      <>
                        <Text style={styles.startRoutineText}>
                          {hayEntrenoActivo ? 'ENTRENO EN CURSO' : 'EMPEZAR RUTINA'}
                        </Text>
                        <Ionicons name="play-outline" size={13} color={theme.accent} />
                      </>
                    )}
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {filtroOpen ? (
        <View style={styles.filterMenuLayer} pointerEvents="box-none">
          <Pressable style={styles.filterMenuDismiss} onPress={() => setFiltroOpen(false)} />
          <View
            style={[
              styles.filterMenuPopover,
              {
                top: Math.min(filtroLayout.y - filtroScrollY + filtroLayout.height + 6, windowHeight - 188),
                left: Math.min(Math.max(filtroLayout.x, 20), windowWidth - 210),
              },
            ]}
          >
            <Text style={styles.filterMenuTitle} numberOfLines={1}>
              Rutinas
            </Text>
            <Pressable
              style={[styles.filterMenuOption, filtroRutinas === 'mis' && styles.filterMenuOptionActive]}
              onPress={() => seleccionarFiltro('mis')}
              accessibilityRole="button"
            >
              <Ionicons name="bookmark-outline" size={17} color={theme.textPrimary} />
              <Text style={styles.filterMenuOptionText}>Mis rutinas</Text>
              {filtroRutinas === 'mis' ? <Ionicons name="checkmark" size={17} color={theme.accent} /> : null}
            </Pressable>
            <View style={styles.filterMenuDivider} />
            <Pressable
              style={[styles.filterMenuOption, filtroRutinas === 'favoritas' && styles.filterMenuOptionActive]}
              onPress={() => seleccionarFiltro('favoritas')}
              accessibilityRole="button"
            >
              <Ionicons name="star-outline" size={17} color={theme.textPrimary} />
              <Text style={styles.filterMenuOptionText}>Favoritas</Text>
              {filtroRutinas === 'favoritas' ? <Ionicons name="checkmark" size={17} color={theme.accent} /> : null}
            </Pressable>
          </View>
        </View>
      ) : null}

      {routineMenu ? (
        <View style={styles.filterMenuLayer} pointerEvents="box-none">
          <Pressable style={styles.filterMenuDismiss} onPress={() => setRoutineMenu(null)} />
          <View
            style={[
              styles.routineMenuPopover,
              {
                top: Math.min(listAreaLayout.y + routineMenuLayout.y - filtroScrollY + 44, windowHeight - 188),
                left: Math.min(
                  Math.max(listAreaLayout.x + routineMenuLayout.x + routineMenuLayout.width - 190, 20),
                  windowWidth - 210,
                ),
              },
            ]}
          >
            <Text style={styles.filterMenuTitle} numberOfLines={1}>
              {routineMenu.nombre}
            </Text>
            <Pressable style={styles.filterMenuOption} onPress={onConsultarV} accessibilityRole="button">
              <VLogo width={17} height={17} style={styles.filterMenuLogo} />
              <Text style={styles.filterMenuOptionText}>Consultar a V</Text>
            </Pressable>
            <View style={styles.filterMenuDivider} />
            {routineMenu.is_community ? (
              <Pressable style={styles.filterMenuOption} onPress={onQuitarFavorito} accessibilityRole="button">
                <Ionicons name="star-outline" size={17} color={theme.textPrimary} />
                <Text style={styles.filterMenuOptionText}>Quitar favorito</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.filterMenuOption} onPress={onEliminarRutina} accessibilityRole="button">
                <Ionicons name="trash-outline" size={17} color={theme.danger} />
                <Text style={styles.filterMenuOptionDanger}>Eliminar</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}

      <Modal
        visible={confirmRoutine != null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!eliminandoRoutineId) setConfirmRoutine(null);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            if (!eliminandoRoutineId) setConfirmRoutine(null);
          }}
        >
          <Pressable style={styles.confirmCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.confirmAccent} />
            <Text style={styles.confirmTitle}>Eliminar rutina</Text>
            <Text style={styles.confirmBody}>
              ¿Seguro que quieres eliminar{' '}
              <Text style={styles.confirmRoutineName}>{confirmRoutine?.nombre ?? 'esta rutina'}</Text>
              ? Esta acción no se puede deshacer.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmButton, styles.confirmDeleteButton]}
                onPress={() => void onConfirmarEliminarRutina()}
                disabled={Boolean(eliminandoRoutineId)}
                accessibilityRole="button"
              >
                {eliminandoRoutineId ? (
                  <ActivityIndicator color={theme.danger} size="small" />
                ) : (
                  <Text style={styles.confirmDeleteText}>Eliminar</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.confirmButton, styles.confirmCancelButton]}
                onPress={() => setConfirmRoutine(null)}
                disabled={Boolean(eliminandoRoutineId)}
                accessibilityRole="button"
              >
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {/* --- RUTINAS TAB END --- */}
    </View>
  );
}

// --- useRoutines HOOK ---
function useRoutines(userId?: string) {
  const [misRutinas, setMisRutinas] = useState<Routine[]>([]);
  const [favoritas, setFavoritas] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (alive: () => boolean) => {
      if (!userId) {
        setMisRutinas([]);
        setFavoritas([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const routineSelect =
          'id, nombre, created_by, routine_exercises ( orden, exercises ( nombre, musculo_primario, musculos_secundarios ) )';

        const [misRes, favRes] = await Promise.all([
          supabase
            .from('routines')
            .select(routineSelect)
            .eq('created_by', userId)
            .order('updated_at', { ascending: false }),
          supabase
            .from('user_favorite_routines')
            .select(`routines ( ${routineSelect} )`)
            .eq('user_id', userId),
        ]);

        if (misRes.error || favRes.error) {
          if (misRes.error) console.error('[useRoutines] mis', misRes.error.message);
          if (favRes.error) console.error('[useRoutines] favoritas', favRes.error.message);
          if (alive()) {
            setMisRutinas([]);
            setFavoritas([]);
          }
          return;
        }

        if (!alive()) return;

        const nextMis = (misRes.data ?? []).map((row) => mapRoutine(row as RoutineJoinRow, userId, false));
        const nextFavoritas = (favRes.data ?? [])
          .map((row) => {
            const routine = (row as FavoriteRoutineJoinRow).routines;
            return Array.isArray(routine) ? routine[0] : routine;
          })
          .filter((routine): routine is RoutineJoinRow => routine != null)
          .map((routine) => mapRoutine(routine, userId, routine.created_by !== userId));

        setMisRutinas(nextMis);
        setFavoritas(nextFavoritas);
      } finally {
        if (alive()) setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    let alive = true;

    void load(() => alive);

    return () => {
      alive = false;
    };
  }, [load]);

  const reload = useCallback(async () => {
    await load(() => true);
  }, [load]);

  const removeRoutine = useCallback((routineId: string) => {
    setMisRutinas((rows) => rows.filter((routine) => routine.id !== routineId));
    setFavoritas((rows) => rows.filter((routine) => routine.id !== routineId));
  }, []);

  const removeFavorite = useCallback((routineId: string) => {
    setFavoritas((rows) => rows.filter((routine) => routine.id !== routineId));
  }, []);

  return { misRutinas, favoritas, loading, reload, removeRoutine, removeFavorite };
}

function mapRoutine(row: RoutineJoinRow, userId: string, isCommunity: boolean): Routine {
  const exercises = (row.routine_exercises ?? [])
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((re) => {
      const ex = re.exercises;
      return Array.isArray(ex) ? ex[0] : ex;
    })
    .filter((ex): ex is RoutineExerciseJoin => ex != null);

  const musculos = uniqueClean(
    exercises.flatMap((exercise) => [
      exercise.musculo_primario,
      ...(Array.isArray(exercise.musculos_secundarios) ? exercise.musculos_secundarios : []),
    ]),
  );

  return {
    id: row.id,
    user_id: row.created_by ?? userId,
    nombre: row.nombre,
    descripcion: exercises.map((exercise) => exercise.nombre?.trim()).filter(Boolean).slice(0, 3).join(', '),
    num_ejercicios: exercises.length,
    musculos,
    imagen_url: null,
    is_community: isCommunity,
  };
}
