/**
 * Bottom sheet a pantalla completa: buscar ejercicios en Supabase (tabla exercises).
 */

import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { useRouter } from 'expo-router';

import { normalizarTexto, palabrasBusqueda } from '@/lib/texto';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';
import type { Exercise } from '@/types/database.types';
import {
  ejerciciosService,
  type ModoListaEjercicios,
} from '@/services/ejercicios.service';
import { supabase } from '@/lib/supabase';

// ─── Caché de módulo ──────────────────────────────────────────────────────────
// El catálogo global (is_custom=false) es estático: se carga una sola vez por
// sesión de app y se reutiliza entre aperturas del sheet. ~260KB en memoria.
let catalogoCache: Exercise[] | null = null;
let catalogoCargando: Promise<Exercise[]> | null = null;
const CATALOGO_PAGE_SIZE = 1000;

async function obtenerCatalogo(): Promise<Exercise[]> {
  if (catalogoCache) return catalogoCache;
  if (catalogoCargando) return catalogoCargando;

  catalogoCargando = (async () => {
    const ejercicios: Exercise[] = [];

    for (let from = 0; ; from += CATALOGO_PAGE_SIZE) {
      const to = from + CATALOGO_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('exercises')
        .select('id, api_id, nombre, descripcion, musculo_primario, musculos_secundarios, equipamiento, categoria, tracking_mode, foto_url, dificultad, is_custom, created_by, api_source, created_at')
        .eq('is_custom', false)
        .order('nombre')
        .range(from, to);

      if (error) throw new Error(error.message);

      const page = (data ?? []) as Exercise[];
      ejercicios.push(...page);
      if (page.length < CATALOGO_PAGE_SIZE) break;
    }

    catalogoCache = ejercicios;
    return ejercicios;
  })();

  try {
    return await catalogoCargando;
  } finally {
    catalogoCargando = null;
  }
}

// ─── Filtrado en cliente ──────────────────────────────────────────────────────
function filtrarEnCliente(
  ejercicios: Exercise[],
  texto: string,
  musculo: string | null,
  equipamiento: string | null,
): Exercise[] {
  let result = ejercicios;

  if (musculo) {
    result = result.filter((e) => e.musculo_primario === musculo);
  }
  if (equipamiento) {
    result = result.filter((e) => (e.equipamiento ?? '').trim() === equipamiento);
  }
  if (texto.trim()) {
    const tokens = palabrasBusqueda(normalizarTexto(texto)).filter((t) => t.length > 0);
    if (tokens.length > 0) {
      result = result.filter((e) => {
        const norm = normalizarTexto(e.nombre);
        return tokens.every((t) => norm.includes(t));
      });
    }
  }

  return result.slice(0, 120);
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onSeleccionar: (ex: Exercise) => void;
  onCrearPersonalizado: () => void;
};

type FiltroModalTipo = 'general' | 'musculo' | 'equipamiento';
type IoniconName = ComponentProps<typeof Ionicons>['name'];
type ExerciseListRow = Exercise & {
  foto_url?: string | null;
  dificultad?: string | null;
  nivel?: string | null;
};

const OPCIONES_GENERAL: { key: ModoListaEjercicios; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'favoritos', label: 'Favoritos' },
  { key: 'creados', label: 'Creados' },
];

function makeStyles(c: Theme, f: ReturnType<typeof useTheme>['f'], ts: ReturnType<typeof useTheme>['ts'], s: ReturnType<typeof useTheme>['s'], r: ReturnType<typeof useTheme>['r']) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerTitle: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    headerBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchWrap: {
      marginHorizontal: s.md,
      marginTop: s.md,
      minHeight: 42,
      borderWidth: 1,
      borderBottomColor: c.borderVisible,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      backgroundColor: c.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      lineHeight: 18,
      fontFamily: f.sans,
      color: c.textDisplay,
      paddingVertical: s.sm,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      gap: 8,
      paddingHorizontal: s.md,
      marginTop: 14,
    },
    chipShell: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.background,
      overflow: 'hidden',
    },
    chipShellOn: {
      borderColor: c.primary,
      backgroundColor: c.background,
    },
    chipLabelPress: {
      flex: 1,
      minWidth: 0,
      minHeight: 34,
      paddingVertical: 7,
      paddingHorizontal: 10,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: 7,
    },
    chipTxt: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
    },
    chipTxtOn: {
      color: c.primary,
    },
    chipClear: {
      width: 30,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    list: {
      flex: 1,
      marginTop: 14,
    },
    listContent: {
      paddingHorizontal: s.md,
      paddingBottom: s.xxl,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 74,
      marginBottom: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: r.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    ejercicioImg: {
      width: 56,
      height: 56,
      borderRadius: r.sm,
      backgroundColor: c.surfaceElevated,
    },
    ejercicioImgPlaceholder: {
      width: 56,
      height: 56,
      borderRadius: r.sm,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemMain: {
      flex: 1,
      minWidth: 0,
      paddingLeft: 14,
      paddingRight: s.sm,
      paddingVertical: 2,
    },
    itemName: {
      fontSize: 15,
      lineHeight: 18,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 6,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.primary,
    },
    itemMetaText: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    levelText: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: f.sansMedium,
    },
    favBtn: {
      width: 34,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      borderRadius: 17,
    },
    actionCol: {
      alignItems: 'center',
      justifyContent: 'space-between',
      alignSelf: 'stretch',
      paddingVertical: 2,
      paddingLeft: 2,
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
      fontSize: 14,
      lineHeight: 18,
      fontFamily: f.sans,
      color: c.textDisplay,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
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

function dificultadEjercicio(e: ExerciseListRow): string {
  return (e.dificultad ?? e.nivel ?? '').trim();
}

function estiloNivelEjercicio(
  nivelRaw: string,
  c: Theme,
): { label: string; color: string; dot: string } | null {
  const label = nivelRaw.trim();
  if (!label) return null;
  const n = normalizarTexto(label);
  if (n.includes('basico') || n.includes('principiante') || n.includes('facil')) {
    return { label: 'Básico', color: c.successText, dot: c.success };
  }
  if (n.includes('intermedio') || n.includes('medio')) {
    return { label, color: c.warningText, dot: c.warning };
  }
  if (n.includes('avanzado') || n.includes('dificil')) {
    return { label, color: c.dangerText, dot: c.danger };
  }
  return { label, color: c.textSecondary, dot: c.textMuted };
}

export function AgregarEjercicioSheet({ visible, onClose, onSeleccionar, onCrearPersonalizado }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { user } = useAuth();
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [texto, setTexto] = useState('');
  const [debounced, setDebounced] = useState('');
  const [modoGeneral, setModoGeneral] = useState<ModoListaEjercicios>('general');
  const [musculo, setMusculo] = useState<string | null>(null);
  const [equipamiento, setEquipamiento] = useState<string | null>(null);
  const [listaAsync, setListaAsync] = useState<Exercise[]>([]); // favoritos / creados
  const [catalogo, setCatalogo] = useState<Exercise[]>(catalogoCache ?? []); // catálogo global en memoria
  const [cargando, setCargando] = useState(false);
  const [favIds, setFavIds] = useState<string[]>([]);
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
    // En modo general el filtrado es en cliente (<5ms), delay mínimo.
    // En favoritos/creados sí hay query a BD, se mantiene debounce razonable.
    const delay = modoGeneral === 'general' ? 50 : 280;
    const t = setTimeout(() => setDebounced(texto), delay);
    return () => clearTimeout(t);
  }, [texto, modoGeneral]);

  const cargarFavoritos = useCallback(async () => {
    if (!user?.id) { setFavIds([]); return; }
    const ids = await ejerciciosService.obtenerEjerciciosFavoritos(user.id);
    setFavIds(ids);
  }, [user?.id]);

  // Carga inicial del catálogo global (solo si no está ya en caché)
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    void cargarFavoritos();

    if (catalogoCache) {
      // Ya en memoria — actualizar opciones de filtro y listo
      const cat = catalogoCache;
      const muscSet = new Set<string>();
      const equipSet = new Set<string>();
      for (const ex of cat) {
        if (ex.musculo_primario) muscSet.add(ex.musculo_primario);
        if (ex.equipamiento?.trim()) equipSet.add(ex.equipamiento.trim());
      }
      setOpciones({
        musculos: [...muscSet].sort((a, b) => a.localeCompare(b, 'es')),
        equipamientos: [...equipSet].sort((a, b) => a.localeCompare(b, 'es')),
      });
      setCatalogo(cat);
      return;
    }

    // Primera vez: cargar desde BD
    setCargando(true);
    obtenerCatalogo().then((cat) => {
      if (cancelled) return;
      const muscSet = new Set<string>();
      const equipSet = new Set<string>();
      for (const ex of cat) {
        if (ex.musculo_primario) muscSet.add(ex.musculo_primario);
        if (ex.equipamiento?.trim()) equipSet.add(ex.equipamiento.trim());
      }
      setOpciones({
        musculos: [...muscSet].sort((a, b) => a.localeCompare(b, 'es')),
        equipamientos: [...equipSet].sort((a, b) => a.localeCompare(b, 'es')),
      });
      setCatalogo(cat);
      setCargando(false);
    }).catch(() => { if (!cancelled) setCargando(false); });

    return () => { cancelled = true; };
  }, [visible, cargarFavoritos]);

  // Lista para modo general: filtrado síncrono en memoria (instantáneo)
  const listaGeneral = useMemo(
    () => filtrarEnCliente(catalogo, debounced, musculo, equipamiento),
    [catalogo, debounced, musculo, equipamiento],
  );

  // Lista final según modo
  const lista = modoGeneral === 'general' ? listaGeneral : listaAsync;

  // Favoritos / Creados: sí requieren query a BD
  const buscarAsync = useCallback(async () => {
    if (modoGeneral === 'general') return;
    setCargando(true);
    try {
      const rows = await ejerciciosService.buscarEjercicios({
        texto: debounced,
        musculoPrimario: musculo,
        equipamiento,
        limite: 120,
        modoLista: modoGeneral,
        userId: user?.id ?? null,
        idsFavoritos: modoGeneral === 'favoritos' ? favIds : undefined,
      });
      setListaAsync(rows);
    } finally {
      setCargando(false);
    }
  }, [debounced, musculo, equipamiento, modoGeneral, user?.id, favIds]);

  useEffect(() => {
    if (!visible || modoGeneral === 'general') return;
    void buscarAsync();
  }, [visible, buscarAsync, modoGeneral]);

  const onToggleFavorito = useCallback(
    async (exerciseId: string) => {
      if (!user?.id) return;
      await ejerciciosService.toggleFavoritoEjercicio(user.id, exerciseId);
      setFavIds((prev) => (prev.includes(exerciseId) ? prev.filter((x) => x !== exerciseId) : [...prev, exerciseId]));
    },
    [user?.id],
  );

  const resetAlCerrar = () => {
    setTexto('');
    setDebounced('');
    setModoGeneral('general');
    setMusculo(null);
    setEquipamiento(null);
    setListaAsync([]);
    setFiltroModal(null);
  };

  const cerrar = () => {
    resetAlCerrar();
    onClose();
  };

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
    icon: IoniconName,
    showClear: boolean,
    onOpen: () => void,
    onClear: () => void,
  ) => (
    <View style={[styles.chipShell, activo && styles.chipShellOn]}>
      <Pressable style={styles.chipLabelPress} onPress={onOpen} accessibilityRole="button">
        <Ionicons name={icon} size={17} color={activo ? c.primary : c.textSecondary} />
        <Text
          style={[styles.chipTxt, activo && styles.chipTxtOn]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
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
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={cerrar}>
        <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <Pressable style={styles.headerBtn} onPress={cerrar} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Ionicons name="close" size={26} color={c.textDisplay} />
            </Pressable>
            <Text style={styles.headerTitle}>Ejercicios</Text>
            <Pressable
              style={styles.headerBtn}
              onPress={onCrearPersonalizado}
              accessibilityRole="button"
              accessibilityLabel="Crear ejercicio personalizado"
            >
              <Ionicons name="create-outline" size={24} color={c.primary} />
            </Pressable>
          </View>

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
              true,
              'grid-outline',
              modoGeneral !== 'general',
              () => setFiltroModal('general'),
              () => setModoGeneral('general'),
            )}
            {renderChip(
              'Músculo',
              musculo,
              Boolean(musculo),
              'body-outline',
              Boolean(musculo),
              () => setFiltroModal('musculo'),
              () => setMusculo(null),
            )}
            {renderChip(
              'Equipamiento',
              equipamiento,
              Boolean(equipamiento),
              'barbell-outline',
              Boolean(equipamiento),
              () => setFiltroModal('equipamiento'),
              () => setEquipamiento(null),
            )}
          </View>

          {cargando ? (
            <View style={styles.loading}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : (
            <FlatList
              style={styles.list}
              contentContainerStyle={styles.listContent}
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
                const row = item as ExerciseListRow;
                const nivel = estiloNivelEjercicio(dificultadEjercicio(row), c);
                const fotoRaw = row.foto_url;
                const fotoUri = fotoRaw?.trim() ?? '';
                return (
                  <View style={styles.itemRow}>
                    {fotoUri ? (
                      <Image
                        source={{ uri: fotoUri }}
                        style={styles.ejercicioImg}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                        autoplay={false}
                        recyclingKey={item.id}
                      />
                    ) : (
                      <View style={styles.ejercicioImgPlaceholder}>
                        <Ionicons name="barbell-outline" size={24} color={c.textMuted} />
                      </View>
                    )}
                    <Pressable
                      style={styles.itemMain}
                      onPress={() => {
                        onSeleccionar(item);
                        cerrar();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Agregar ${item.nombre}`}
                    >
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.nombre}
                      </Text>
                      <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                          <View style={styles.metaDot} />
                          <Text style={styles.itemMetaText} numberOfLines={1}>
                            {item.musculo_primario}
                          </Text>
                        </View>
                        {nivel ? (
                          <View style={styles.metaItem}>
                            <Ionicons name="stats-chart" size={12} color={c.textSecondary} />
                            <View
                              style={[
                                styles.metaDot,
                                { backgroundColor: nivel.dot, width: 5, height: 5, borderRadius: 2.5 },
                              ]}
                            />
                            <Text style={[styles.levelText, { color: nivel.color }]} numberOfLines={1}>
                              {nivel.label}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                    <View style={styles.actionCol}>
                      <Pressable
                        style={styles.favBtn}
                        onPress={() =>
                          router.push({
                            pathname: '/(tabs)/(entrenamiento)/consulta-ejercicio',
                            params: { id: item.id },
                          })
                        }
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Ver información del ejercicio"
                      >
                        <Ionicons name="information-circle-outline" size={20} color={c.textMuted} />
                      </Pressable>
                      <Pressable
                        style={styles.favBtn}
                        onPress={() => onToggleFavorito(item.id)}
                        disabled={!user?.id}
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
                  </View>
                );
              }}
            />
          )}
        </View>
      </Modal>

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
                ? OPCIONES_GENERAL.map((item) => (
                    <Pressable
                      key={item.key}
                      style={styles.filtroItem}
                      onPress={() => {
                        setModoGeneral(item.key);
                        setFiltroModal(null);
                      }}
                    >
                      <Text style={styles.filtroItemTxt}>{item.label}</Text>
                    </Pressable>
                  ))
                : itemsFiltroModalFiltrados.length === 0
                  ? (
                      <View style={styles.empty}>
                        <Text style={styles.emptyTxt}>No hay valores en los datos cargados.</Text>
                      </View>
                    )
                  : itemsFiltroModalFiltrados.map((item) => (
                      <Pressable
                        key={item}
                        style={styles.filtroItem}
                        onPress={() => {
                          if (filtroModal === 'musculo') setMusculo(item);
                          else setEquipamiento(item);
                          setFiltroModal(null);
                        }}
                      >
                        <Text style={styles.filtroItemTxt}>{item}</Text>
                      </Pressable>
                    ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
