/**
 * ModalRegistrarEntreno
 *
 * Bottom sheet que aparece al pulsar "+" en la quick action de "Registrar entreno"
 * desde Home. Replica la lógica del tab Rutinas:
 *   - Empezar entrenamiento vacío (pide nombre)
 *   - Mis rutinas: tabs Todas / Favoritas
 *   - Al pulsar una rutina → iniciarDesdeRutina → navega a entreno-activo
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useEntreno } from '@/context/EntrenoContext';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  entrenamientoService,
  type RutinaListaVista,
} from '@/services/entrenamiento.service';

type FiltroRutinas = 'todas' | 'favoritas';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ModalRegistrarEntreno({ visible, onClose }: Props) {
  const { c, f, s } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { user } = useAuth();
  const { iniciarEntrenoVacio, iniciarDesdeRutina, entrenoActivo } = useEntreno();

  /* ── Estado rutinas ── */
  const [filtro, setFiltro] = useState<FiltroRutinas>('todas');
  const [lista, setLista] = useState<RutinaListaVista[]>([]);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(false);
  const [rutinaIniciandoId, setRutinaIniciandoId] = useState<string | null>(null);
  const rutinaIniciandoRef = useRef<string | null>(null);

  /* ── Estado entreno vacío ── */
  const [modalVacio, setModalVacio] = useState(false);
  const [nombreVacio, setNombreVacio] = useState('');
  const [iniciandoVacio, setIniciandoVacio] = useState(false);
  const iniciandoVacioRef = useRef(false);

  /* ── Carga de rutinas cuando el modal abre ── */
  const cargar = useCallback(async () => {
    if (!user?.id) return;
    setCargando(true);
    try {
      if (filtro === 'todas') {
        const [mis, ids] = await Promise.all([
          entrenamientoService.obtenerMisRutinas(user.id),
          entrenamientoService.obtenerRoutineIdsFavoritas(user.id),
        ]);
        setLista(mis);
        setFavIds(new Set(ids));
      } else {
        const fav = await entrenamientoService.obtenerRutinasFavoritas(user.id);
        setLista(fav);
        setFavIds(new Set(fav.map((x) => x.id)));
      }
    } finally {
      setCargando(false);
    }
  }, [user?.id, filtro]);

  useEffect(() => {
    if (visible) void cargar();
  }, [visible, cargar]);

  /* ── Empezar entreno vacío ── */
  const cerrarModalVacio = useCallback(() => {
    setModalVacio(false);
    setNombreVacio('');
    iniciandoVacioRef.current = false;
    setIniciandoVacio(false);
  }, []);

  const onComenzarVacio = useCallback(async () => {
    const nombre = nombreVacio.trim();
    if (!nombre || iniciandoVacioRef.current) return;
    iniciandoVacioRef.current = true;
    setIniciandoVacio(true);
    try {
      await iniciarEntrenoVacio(nombre);
      cerrarModalVacio();
      onClose();
      router.push('/(tabs)/(entrenamiento)/entreno-activo');
    } finally {
      iniciandoVacioRef.current = false;
      setIniciandoVacio(false);
    }
  }, [nombreVacio, iniciarEntrenoVacio, cerrarModalVacio, onClose]);

  /* ── Empezar desde rutina ── */
  const onEmpezarRutina = useCallback(
    async (rut: RutinaListaVista) => {
      if (entrenoActivo != null || rutinaIniciandoRef.current != null) return;
      rutinaIniciandoRef.current = rut.id;
      setRutinaIniciandoId(rut.id);
      try {
        await iniciarDesdeRutina(rut.id, rut.nombre);
        onClose();
        router.push('/(tabs)/(entrenamiento)/entreno-activo');
      } finally {
        rutinaIniciandoRef.current = null;
        setRutinaIniciandoId(null);
      }
    },
    [entrenoActivo, iniciarDesdeRutina, onClose],
  );

  const hayEntrenoActivo = entrenoActivo != null;
  const sheetHeight = Math.round(height * 0.6);

  const st = StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: insets.bottom + 8,
      height: sheetHeight,
      // Necesario para que el FlatList con flexShrink funcione dentro
      overflow: 'hidden',
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: c.textDisplay,
    },
    /* Empezar vacío */
    vacioBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
      marginHorizontal: s.md,
      marginBottom: s.md,
      padding: s.md,
      borderRadius: 12,
      backgroundColor: c.primaryBg,
      borderWidth: 1,
      borderColor: c.primary,
    },
    vacioBtnTxt: {
      fontSize: 14,
      fontWeight: '600',
      color: c.primary,
    },
    vacioBtnSub: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 2,
    },
    /* Sección rutinas */
    seccionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textDisplay,
      paddingHorizontal: s.md,
      marginBottom: s.sm,
    },
    /* Tabs Todas / Favoritas */
    tabsRow: {
      flexDirection: 'row',
      marginHorizontal: s.md,
      marginBottom: s.sm,
      backgroundColor: c.surfaceElevated,
      borderRadius: 10,
      padding: 3,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 7,
      alignItems: 'center',
      borderRadius: 8,
    },
    tabBtnOn: {
      backgroundColor: c.surface,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 2,
    },
    tabTxt: {
      fontSize: 13,
      fontWeight: '500',
      color: c.textSecondary,
    },
    tabTxtOn: {
      color: c.textDisplay,
      fontWeight: '600',
    },
    /* Tarjeta rutina */
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s.md,
      paddingVertical: s.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: c.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: s.sm,
    },
    cardBody: { flex: 1, minWidth: 0 },
    cardNombre: {
      fontSize: 15,
      fontWeight: '500',
      color: c.textDisplay,
    },
    cardMeta: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 2,
    },
    cardChevron: {
      paddingLeft: s.sm,
    },
    emptyTxt: {
      flex: 1,
      fontSize: 13,
      color: c.textMuted,
      textAlign: 'center',
      paddingVertical: s.lg,
      textAlignVertical: 'center',
    },
    loadingWrap: {
      flex: 1,
      paddingVertical: s.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /* Modal entreno vacío */
    vModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      padding: s.lg,
    },
    vModalCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: s.md,
    },
    vModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: s.md,
    },
    vModalTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: c.textDisplay,
    },
    vModalLabel: {
      fontSize: 11,
      fontFamily: f.mono,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: s.xs,
    },
    vModalInput: {
      fontSize: 16,
      color: c.textDisplay,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      paddingVertical: s.xs,
      marginBottom: s.md,
    },
    vModalRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: s.sm,
    },
    vBtnGhost: {
      paddingVertical: s.sm,
      paddingHorizontal: s.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    vBtnGhostTxt: {
      fontSize: 14,
      color: c.textDisplay,
    },
    vBtnPrimary: {
      paddingVertical: s.sm,
      paddingHorizontal: s.md,
      borderRadius: 8,
      backgroundColor: c.primary,
    },
    vBtnPrimaryTxt: {
      fontSize: 14,
      fontWeight: '600',
      color: '#fff',
    },
  });

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <Pressable style={st.overlay} onPress={onClose}>
          {/* El sheet ES el Pressable que para la propagación para que maxHeight funcione */}
          <Pressable style={st.sheet} onPress={(e) => e.stopPropagation()}>
            {/* Handle */}
            <View style={st.handle} />

            {/* Header */}
            <View style={st.header}>
              <Text style={st.headerTitle}>Registrar entreno</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={c.textMuted} />
              </Pressable>
            </View>

            {/* ── Empezar vacío ── */}
            <Pressable
              style={st.vacioBtn}
              onPress={() => setModalVacio(true)}
              disabled={hayEntrenoActivo}
            >
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ionicons name="add" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.vacioBtnTxt}>
                  Empezar entrenamiento vacío
                </Text>
                <Text style={st.vacioBtnSub}>Crea tu entrenamiento desde cero</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.primary} style={{ flexShrink: 0 }} />
            </Pressable>

            {/* ── Mis rutinas ── */}
            <Text style={st.seccionLabel}>Mis rutinas</Text>

            {/* Tabs Todas / Favoritas */}
            <View style={st.tabsRow}>
              {(['todas', 'favoritas'] as FiltroRutinas[]).map((tab) => (
                <Pressable
                  key={tab}
                  style={[st.tabBtn, filtro === tab && st.tabBtnOn]}
                  onPress={() => setFiltro(tab)}
                >
                  <Text style={[st.tabTxt, filtro === tab && st.tabTxtOn]}>
                    {tab === 'todas' ? 'Todas' : 'Favoritas'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Lista rutinas — ocupa el espacio restante del sheet */}
            {cargando ? (
              <View style={st.loadingWrap}>
                <ActivityIndicator color={c.primary} />
              </View>
            ) : lista.length === 0 ? (
              <Text style={st.emptyTxt}>
                {filtro === 'todas'
                  ? 'No tienes rutinas creadas todavía.'
                  : 'Aún no has marcado favoritas.'}
              </Text>
            ) : (
              <FlatList
                data={lista}
                keyExtractor={(item) => item.id}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: s.sm }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item: rut }) => {
                  const esFav = favIds.has(rut.id);
                  const iniciando = rutinaIniciandoId === rut.id;
                  return (
                    <Pressable
                      style={st.card}
                      onPress={() => void onEmpezarRutina(rut)}
                      disabled={hayEntrenoActivo || rutinaIniciandoId != null}
                    >
                      <View style={st.cardIcon}>
                        <Ionicons name="barbell-outline" size={20} color={c.primary} />
                      </View>
                      <View style={st.cardBody}>
                        <Text style={st.cardNombre} numberOfLines={1}>
                          {rut.nombre}
                          {esFav ? '  ⭐' : ''}
                        </Text>
                        {rut.ejercicios.length > 0 && (
                          <Text style={st.cardMeta} numberOfLines={1}>
                            {rut.ejercicios.join(', ')}
                          </Text>
                        )}
                      </View>
                      <View style={st.cardChevron}>
                        {iniciando ? (
                          <ActivityIndicator size="small" color={c.primary} />
                        ) : (
                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={hayEntrenoActivo ? c.textMuted : c.textSecondary}
                          />
                        )}
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Modal nombre entreno vacío ── */}
      <Modal
        visible={modalVacio}
        transparent
        animationType="fade"
        onRequestClose={cerrarModalVacio}
        statusBarTranslucent
      >
        <Pressable style={st.vModalOverlay} onPress={cerrarModalVacio}>
          <Pressable style={st.vModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={st.vModalHeader}>
              <Text style={st.vModalTitle}>Nuevo entreno</Text>
              <Pressable onPress={cerrarModalVacio} hitSlop={8}>
                <Ionicons name="close" size={22} color={c.textMuted} />
              </Pressable>
            </View>
            <Text style={st.vModalLabel}>Nombre</Text>
            <TextInput
              style={st.vModalInput}
              value={nombreVacio}
              onChangeText={setNombreVacio}
              placeholder="Ej. Empuje, Pierna…"
              placeholderTextColor={c.textMuted}
              autoFocus
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => void onComenzarVacio()}
            />
            <View style={st.vModalRow}>
              <Pressable style={st.vBtnGhost} onPress={cerrarModalVacio}>
                <Text style={st.vBtnGhostTxt}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[
                  st.vBtnPrimary,
                  (!nombreVacio.trim() || iniciandoVacio) && { opacity: 0.4 },
                ]}
                onPress={() => void onComenzarVacio()}
                disabled={!nombreVacio.trim() || iniciandoVacio}
              >
                {iniciandoVacio ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={st.vBtnPrimaryTxt}>Comenzar</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
