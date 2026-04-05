/**
 * Bottom sheet a pantalla completa: buscar ejercicios en Supabase (tabla exercises).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';
import type { Exercise } from '@/types/database.types';
import {
  ejerciciosService,
  type ModoListaEjercicios,
} from '@/services/ejercicios.service';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSeleccionar: (ex: Exercise) => void;
  onCrearPersonalizado: () => void;
};

type FiltroModalTipo = 'general' | 'musculo' | 'equipamiento';

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
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
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
      maxHeight: '70%',
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

export function AgregarEjercicioSheet({ visible, onClose, onSeleccionar, onCrearPersonalizado }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [texto, setTexto] = useState('');
  const [debounced, setDebounced] = useState('');
  const [modoGeneral, setModoGeneral] = useState<ModoListaEjercicios>('general');
  const [musculo, setMusculo] = useState<string | null>(null);
  const [equipamiento, setEquipamiento] = useState<string | null>(null);
  const [lista, setLista] = useState<Exercise[]>([]);
  const [cargando, setCargando] = useState(false);
  const [favIds, setFavIds] = useState<string[]>([]);
  const [opciones, setOpciones] = useState<{ musculos: string[]; equipamientos: string[] }>({
    musculos: [],
    equipamientos: [],
  });
  const [filtroModal, setFiltroModal] = useState<FiltroModalTipo | null>(null);

  const favSet = useMemo(() => new Set(favIds), [favIds]);

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
    if (!user?.id) {
      setFavIds([]);
      return;
    }
    const ids = await ejerciciosService.obtenerEjerciciosFavoritos(user.id);
    setFavIds(ids);
  }, [user?.id]);

  useEffect(() => {
    if (visible) {
      void cargarOpciones();
      void cargarFavoritos();
    }
  }, [visible, cargarOpciones, cargarFavoritos]);

  const buscar = useCallback(async () => {
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
      setLista(rows);
    } finally {
      setCargando(false);
    }
  }, [debounced, musculo, equipamiento, modoGeneral, user?.id, favIds]);

  useEffect(() => {
    if (!visible) return;
    void buscar();
  }, [visible, buscar]);

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
    setLista([]);
    setFiltroModal(null);
  };

  const cerrar = () => {
    resetAlCerrar();
    onClose();
  };

  let itemsFiltroModal: string[] = [];
  let tituloModal = '';
  if (filtroModal === 'musculo') {
    itemsFiltroModal = opciones.musculos;
    tituloModal = 'MÚSCULO';
  } else if (filtroModal === 'equipamiento') {
    itemsFiltroModal = opciones.equipamientos;
    tituloModal = 'EQUIPAMIENTO';
  } else if (filtroModal === 'general') {
    tituloModal = 'GENERAL';
  }

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

          {cargando ? (
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
                return (
                  <View style={styles.itemRow}>
                    <Pressable
                      style={styles.itemMain}
                      onPress={() => {
                        onSeleccionar(item);
                        cerrar();
                      }}
                    >
                      <Text style={styles.itemName}>{item.nombre}</Text>
                      <Text style={styles.itemMuscle}>{item.musculo_primario}</Text>
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
                );
              }}
            />
          )}
        </View>
      </Modal>

      <Modal visible={filtroModal != null} transparent animationType="fade" onRequestClose={() => setFiltroModal(null)}>
        <Pressable style={styles.filtroModalOverlay} onPress={() => setFiltroModal(null)}>
          <Pressable style={[styles.filtroSheet, { paddingBottom: insets.bottom + s.md }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.filtroTitle}>{tituloModal}</Text>
            {filtroModal === 'general' ? (
              <FlatList
                data={OPCIONES_GENERAL}
                keyExtractor={(x) => x.key}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.filtroItem}
                    onPress={() => {
                      setModoGeneral(item.key);
                      setFiltroModal(null);
                    }}
                  >
                    <Text style={styles.filtroItemTxt}>{item.label}</Text>
                  </Pressable>
                )}
              />
            ) : (
              <FlatList
                data={itemsFiltroModal}
                keyExtractor={(x) => x}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyTxt}>No hay valores en los datos cargados.</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.filtroItem}
                    onPress={() => {
                      if (filtroModal === 'musculo') setMusculo(item);
                      else setEquipamiento(item);
                      setFiltroModal(null);
                    }}
                  >
                    <Text style={styles.filtroItemTxt}>{item}</Text>
                  </Pressable>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
