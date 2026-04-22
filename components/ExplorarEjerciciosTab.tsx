/**
 * Lista del catálogo de ejercicios (buscador, filtros, favoritos) para la pantalla Explorar.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { normalizarTexto } from '@/lib/texto';
import {
  ejerciciosService,
  type ModoListaEjercicios,
} from '@/services/ejercicios.service';
import type { Exercise } from '@/types/database.types';

export type ExplorarEjerciciosTabProps = {
  userId?: string | null;
};

type FiltroModalTipo = 'general' | 'musculo' | 'equipamiento';

const OPCIONES_GENERAL: { key: ModoListaEjercicios; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'favoritos', label: 'Favoritos' },
  { key: 'creados', label: 'Creados' },
];

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
      backgroundColor: c.background,
    },
    searchWrap: {
      marginHorizontal: s.md,
      marginTop: s.md,
      borderBottomWidth: 1,
      borderBottomColor: c.borderVisible,
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
      paddingBottom: s.xs,
    },
    searchInput: {
      flex: 1,
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
      paddingVertical: s.xs,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      gap: s.xs,
      paddingHorizontal: s.md,
      marginTop: s.md,
    },
    chipShell: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    chipShellOn: {
      borderColor: c.primary,
      backgroundColor: c.primaryBg,
    },
    chipLabelPress: {
      flex: 1,
      minWidth: 0,
      paddingVertical: s.xs,
      paddingLeft: s.sm,
      paddingRight: s.xxs,
      justifyContent: 'center',
    },
    chipTxt: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
    },
    chipTxtOn: {
      color: c.primary,
    },
    chipClear: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    list: {
      flex: 1,
      marginTop: s.md,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    ejercicioImg: {
      width: 56,
      height: 56,
      borderRadius: 8,
    },
    ejercicioImgPlaceholder: {
      width: 56,
      height: 56,
      borderRadius: 8,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemMain: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: s.md,
      paddingVertical: s.md,
    },
    itemName: {
      ...ts.body,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    itemMuscle: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginTop: 2,
    },
    favBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      marginRight: s.md,
    },
    empty: {
      padding: s.xl,
      alignItems: 'center',
    },
    emptyTxt: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textMuted,
      textAlign: 'center',
    },
    loading: {
      padding: s.lg,
    },
    errMono: {
      ...ts.bodySm,
      fontFamily: f.mono,
      color: c.danger,
      textAlign: 'center',
      padding: s.md,
    },
    filtroModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    filtroSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: r.lg,
      borderTopRightRadius: r.lg,
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    filtroTitle: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      padding: s.md,
      letterSpacing: 0.7,
    },
    filtModalBusqueda: {
      borderBottomWidth: 1,
      borderBottomColor: c.borderVisible,
      fontFamily: f.sans,
      color: c.textDisplay,
      paddingHorizontal: s.md,
      paddingVertical: s.xs,
      marginBottom: s.sm,
    },
    filtroItem: {
      paddingVertical: s.md,
      paddingHorizontal: s.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    filtroItemTxt: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
    },
  });
}

function etiquetaModoGeneral(m: ModoListaEjercicios): string {
  if (m === 'favoritos') return 'Favoritos';
  if (m === 'creados') return 'Creados';
  return 'General';
}

export function ExplorarEjerciciosTab({ userId: userIdProp }: ExplorarEjerciciosTabProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { user } = useAuth();
  const userId = userIdProp ?? user?.id ?? null;
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [texto, setTexto] = useState('');
  const [debounced, setDebounced] = useState('');
  const [modoGeneral, setModoGeneral] = useState<ModoListaEjercicios>('general');
  const [musculo, setMusculo] = useState<string | null>(null);
  const [equipamiento, setEquipamiento] = useState<string | null>(null);
  const [lista, setLista] = useState<Exercise[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const [favIds, setFavIds] = useState<string[]>([]);
  const favIdsRef = useRef<string[]>([]);
  favIdsRef.current = favIds;
  const [opciones, setOpciones] = useState<{ musculos: string[]; equipamientos: string[] }>({
    musculos: [],
    equipamientos: [],
  });
  const [filtroModal, setFiltroModal] = useState<FiltroModalTipo | null>(null);
  const [textoBusquedaModal, setTextoBusquedaModal] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const favSet = useMemo(() => new Set(favIds), [favIds]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    setTextoBusquedaModal('');
  }, [filtroModal]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(texto), 280);
    return () => clearTimeout(t);
  }, [texto]);

  const cargarOpciones = useCallback(async () => {
    const [musculos, equipamientos] = await Promise.all([
      ejerciciosService.obtenerMusculosDisponibles(),
      ejerciciosService.obtenerEquipamientoDisponible(),
    ]);
    setOpciones({ musculos, equipamientos });
  }, []);

  const cargarFavoritos = useCallback(async () => {
    if (!userId) {
      setFavIds([]);
      return;
    }
    const ids = await ejerciciosService.obtenerEjerciciosFavoritos(userId);
    setFavIds(ids);
  }, [userId]);

  useEffect(() => {
    void cargarOpciones();
    void cargarFavoritos();
  }, [cargarOpciones, cargarFavoritos]);

  const buscar = useCallback(async () => {
    setCargando(true);
    setError(false);
    try {
      const rows = await ejerciciosService.buscarEjercicios({
        texto: debounced,
        musculoPrimario: musculo,
        equipamiento,
        limite: 120,
        modoLista: modoGeneral,
        userId,
        idsFavoritos: modoGeneral === 'favoritos' ? favIdsRef.current : undefined,
      });
      setLista(rows);
    } catch {
      setLista([]);
      setError(true);
    } finally {
      setCargando(false);
    }
  }, [debounced, musculo, equipamiento, modoGeneral, userId]);

  useEffect(() => {
    void buscar();
  }, [buscar]);

  const onToggleFavorito = useCallback((exerciseId: string) => {
    if (!userId) return;
    let snapshot: string[] = [];
    setFavIds((prev) => {
      snapshot = [...prev];
      return prev.includes(exerciseId) ? prev.filter((x) => x !== exerciseId) : [...prev, exerciseId];
    });
    void (async () => {
      try {
        await ejerciciosService.toggleFavoritoEjercicio(userId, exerciseId);
      } catch {
        setFavIds(snapshot);
      }
    })();
  }, [userId]);

  let tituloModal = '';
  if (filtroModal === 'musculo') {
    tituloModal = 'MÚSCULO';
  } else if (filtroModal === 'equipamiento') {
    tituloModal = 'EQUIPAMIENTO';
  } else if (filtroModal === 'general') {
    tituloModal = 'GENERAL';
  }

  const itemsFiltroModalFiltrados = useMemo(() => {
    if (filtroModal !== 'musculo' && filtroModal !== 'equipamiento') return [] as string[];
    const base = filtroModal === 'musculo' ? opciones.musculos : opciones.equipamientos;
    const q = normalizarTexto(textoBusquedaModal);
    if (!q) return base;
    return base.filter((item) => normalizarTexto(item).includes(q));
  }, [filtroModal, opciones.musculos, opciones.equipamientos, textoBusquedaModal]);

  const sheetMaxH = keyboardHeight > 0 ? screenHeight * 0.9 - keyboardHeight : screenHeight * 0.7;
  const sheetPadBottom = keyboardHeight > 0 ? keyboardHeight : insets.bottom + s.md;
  const filtroModalScrollMaxH = Math.max(
    120,
    sheetMaxH - (filtroModal === 'musculo' || filtroModal === 'equipamiento' ? 120 : 72),
  );

  const renderChip = (
    labelBase: string,
    valorMostrar: string | null,
    activo: boolean,
    showClear: boolean,
    onOpen: () => void,
    onClear: () => void,
  ) => (
    <View style={[styles.chipShell, activo && styles.chipShellOn]}>
      <Pressable style={styles.chipLabelPress} onPress={onOpen} accessibilityRole="button">
        <Text style={[styles.chipTxt, activo && styles.chipTxtOn]} numberOfLines={1} ellipsizeMode="tail">
          {valorMostrar ?? labelBase}
        </Text>
      </Pressable>
      {showClear ? (
        <Pressable
          style={styles.chipClear}
          onPress={onClear}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Quitar filtro ${labelBase}`}
        >
          <Text style={[styles.chipTxt, activo && styles.chipTxtOn, { fontSize: 18, lineHeight: 22 }]}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={20} color={c.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre"
          placeholderTextColor={c.textMuted}
          value={texto}
          onChangeText={setTexto}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.chipsRow}>
        {renderChip(
          'General',
          modoGeneral === 'general' ? null : etiquetaModoGeneral(modoGeneral),
          modoGeneral !== 'general',
          modoGeneral !== 'general',
          () => setFiltroModal('general'),
          () => setModoGeneral('general'),
        )}
        {renderChip(
          'Músculo',
          musculo,
          Boolean(musculo),
          Boolean(musculo),
          () => setFiltroModal('musculo'),
          () => setMusculo(null),
        )}
        {renderChip(
          'Equipamiento',
          equipamiento,
          Boolean(equipamiento),
          Boolean(equipamiento),
          () => setFiltroModal('equipamiento'),
          () => setEquipamiento(null),
        )}
      </View>

      {error ? (
        <Text style={styles.errMono}>[ERROR AL CARGAR]</Text>
      ) : cargando ? (
        <View style={styles.loading}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={lista}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTxt}>
                Sin resultados en el catálogo local. Prueba otro término o quita filtros.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const esFav = favSet.has(item.id);
            const fotoRaw = (item as Exercise & { foto_url?: string | null }).foto_url;
            const fotoUri = fotoRaw?.trim() ?? '';
            return (
              <View style={styles.itemRow}>
                {fotoUri ? (
                  <Image
                    source={{ uri: fotoUri }}
                    style={[styles.ejercicioImg, { marginLeft: s.md, marginRight: s.sm }]}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    autoplay={false}
                    recyclingKey={item.id}
                  />
                ) : (
                  <View style={[styles.ejercicioImgPlaceholder, { marginLeft: s.md, marginRight: s.sm }]}>
                    <Ionicons name="barbell-outline" size={24} color={c.textMuted} />
                  </View>
                )}
                <Pressable
                  style={styles.itemMain}
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/(entrenamiento)/consulta-ejercicio',
                      params: { id: item.id },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir ${item.nombre}`}
                >
                  <Text style={styles.itemName}>{item.nombre}</Text>
                  <Text style={styles.itemMuscle}>{item.musculo_primario}</Text>
                </Pressable>
                <Pressable
                  style={styles.favBtn}
                  onPress={() => void onToggleFavorito(item.id)}
                  disabled={!userId}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={esFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                >
                  <Ionicons
                    name={esFav ? 'star' : 'star-outline'}
                    size={22}
                    color={esFav ? c.warning : c.textMuted}
                  />
                </Pressable>
              </View>
            );
          }}
        />
      )}

      <Modal visible={filtroModal != null} transparent animationType="fade" onRequestClose={() => setFiltroModal(null)}>
        <Pressable style={styles.filtroModalOverlay} onPress={() => setFiltroModal(null)}>
          <Pressable
            style={[
              styles.filtroSheet,
              {
                maxHeight: sheetMaxH,
                paddingBottom: sheetPadBottom,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.filtroTitle}>{tituloModal}</Text>
            {filtroModal === 'musculo' || filtroModal === 'equipamiento' ? (
              <TextInput
                style={styles.filtModalBusqueda}
                placeholder="Buscar..."
                placeholderTextColor={c.textMuted}
                value={textoBusquedaModal}
                onChangeText={setTextoBusquedaModal}
                autoCorrect={false}
                autoCapitalize="none"
              />
            ) : null}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: filtroModalScrollMaxH }}
              showsVerticalScrollIndicator
            >
              {filtroModal === 'general'
                ? OPCIONES_GENERAL.map((opt) => (
                    <Pressable
                      key={opt.key}
                      style={styles.filtroItem}
                      onPress={() => {
                        setModoGeneral(opt.key);
                        setFiltroModal(null);
                      }}
                    >
                      <Text style={styles.filtroItemTxt}>{opt.label}</Text>
                    </Pressable>
                  ))
                : itemsFiltroModalFiltrados.length === 0
                  ? (
                      <View style={styles.empty}>
                        <Text style={styles.emptyTxt}>No hay valores en los datos cargados.</Text>
                      </View>
                    )
                  : itemsFiltroModalFiltrados.map((opt) => (
                      <Pressable
                        key={opt}
                        style={styles.filtroItem}
                        onPress={() => {
                          if (filtroModal === 'musculo') setMusculo(opt);
                          else setEquipamiento(opt);
                          setFiltroModal(null);
                        }}
                      >
                        <Text style={styles.filtroItemTxt}>{opt}</Text>
                      </Pressable>
                    ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
