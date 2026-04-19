/**
 * Tab Rutinas — datos desde Supabase, selector desplegable Mis Rutinas / Favoritos.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useEntreno } from '@/context/EntrenoContext';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  borrarRutina,
  cambiarNombreRutina,
  entrenamientoService,
  type RutinaListaVista,
} from '@/services/entrenamiento.service';
import type { Theme } from '@/constants/theme';

type FiltroRutinas = 'mis' | 'favoritos';

function makeStyles(c: Theme, f: ReturnType<typeof useTheme>['f'], ts: ReturnType<typeof useTheme>['ts'], s: ReturnType<typeof useTheme>['s'], r: ReturnType<typeof useTheme>['r']) {
  return StyleSheet.create({
    root: {
      flex: 1,
      minHeight: 0,
      paddingHorizontal: s.md,
      paddingBottom: s.sm,
      gap: s.md,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.sm,
      paddingVertical: s.md,
      borderRadius: r.sm,
      backgroundColor: c.primary,
      borderWidth: 1,
      borderColor: c.primary,
    },
    primaryBtnText: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textOnPrimary,
      letterSpacing: 0.3,
    },
    secondaryRow: {
      flexDirection: 'row',
      gap: s.sm,
    },
    secondaryBtn: {
      flex: 1,
      paddingVertical: s.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.technical,
      backgroundColor: c.surface,
    },
    secondaryBtnText: {
      ...ts.bodySm,
      fontFamily: f.mono,
      color: c.textDisplay,
      letterSpacing: 0.4,
    },
    accordionWrap: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.lg,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    accordionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
    },
    accordionTitulo: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    accordionOptions: {
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    accordionOption: {
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
    },
    accordionOptionActive: {
      backgroundColor: c.primaryBg,
    },
    accordionOptionText: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.text,
    },
    listArea: {
      flex: 1,
      minHeight: 0,
      gap: 12,
    },
    sectionMeta: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textMuted,
      letterSpacing: 0.5,
    },
    card: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.lg,
      backgroundColor: c.surfaceElevated,
      paddingHorizontal: s.sm,
      paddingTop: s.sm,
      paddingBottom: s.xs,
      position: 'relative',
    },
    actionHit: {
      position: 'absolute',
      top: s.xs,
      right: s.xs,
      zIndex: 2,
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: {
      ...ts.body,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      marginBottom: s.xs,
      paddingRight: 40,
    },
    startBtn: {
      marginTop: s.xs,
      paddingVertical: s.sm,
      alignItems: 'center',
      borderRadius: r.technical,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    startBtnText: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.primary,
      letterSpacing: 0.8,
    },
    loadingBox: {
      padding: s.lg,
      alignItems: 'center',
    },
    emptyTxt: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textMuted,
      textAlign: 'center',
      paddingVertical: s.lg,
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
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: s.sm,
    },
    modalTitle: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      flex: 1,
      paddingRight: s.sm,
    },
    modalClose: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalLabel: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
      marginBottom: s.xs,
      letterSpacing: 0.5,
    },
    modalInput: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
      borderBottomWidth: 1,
      borderBottomColor: c.borderVisible,
      paddingVertical: s.xs,
      marginBottom: s.md,
    },
    modalRow: {
      flexDirection: 'row',
      gap: s.sm,
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
    },
    modalBtn: {
      paddingVertical: s.sm,
      paddingHorizontal: s.md,
      borderRadius: r.technical,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surfaceElevated,
    },
    modalBtnPrimary: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    modalBtnTxt: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textDisplay,
    },
    modalBtnTxtPrimary: {
      color: c.textOnPrimary,
      fontFamily: f.sansMedium,
    },
    startBtnDisabled: {
      opacity: 0.65,
    },
    startBtnTextMuted: {
      color: c.textMuted,
    },
    renameModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      paddingHorizontal: s.lg,
    },
    renameModalCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: s.md,
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    renameModalTitle: {
      fontSize: 11,
      fontFamily: f.mono,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: s.sm,
    },
    renameModalInput: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
      borderBottomWidth: 1,
      borderBottomColor: c.borderVisible,
      paddingVertical: s.xs,
      marginBottom: s.md,
    },
    renameModalRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: s.sm,
    },
    renameBtnGhost: {
      paddingVertical: s.sm,
      paddingHorizontal: s.md,
      borderRadius: r.technical,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: 'transparent',
    },
    renameBtnGhostTxt: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textDisplay,
    },
    renameBtnPrimary: {
      paddingVertical: s.sm,
      paddingHorizontal: s.md,
      borderRadius: r.technical,
      backgroundColor: c.primary,
      borderWidth: 1,
      borderColor: c.primary,
    },
    renameBtnPrimaryTxt: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textOnPrimary,
    },
    dsModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      paddingHorizontal: s.lg,
    },
    dsModalCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: s.md,
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    menuModalTitle: {
      ...ts.body,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      marginBottom: s.md,
    },
    menuOption: {
      paddingVertical: s.md,
      alignSelf: 'stretch',
    },
    menuOptionTxt: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.textDisplay,
      textAlign: 'left',
    },
    menuOptionDestructiveTxt: {
      ...ts.body,
      fontFamily: f.sans,
      color: c.danger,
      textAlign: 'left',
    },
    menuSep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      alignSelf: 'stretch',
    },
    menuCancel: {
      marginTop: s.sm,
      paddingVertical: s.sm,
      alignSelf: 'stretch',
      alignItems: 'center',
    },
    menuCancelTxt: {
      fontSize: 11,
      fontFamily: f.mono,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    borrarModalTitle: {
      fontSize: 11,
      fontFamily: f.mono,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: s.xs,
    },
    borrarModalBody: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.text,
      marginBottom: s.lg,
    },
    borrarModalRow: {
      flexDirection: 'row',
      gap: s.sm,
      alignItems: 'stretch',
    },
    borrarBtnSecondary: {
      flex: 1,
      paddingVertical: s.sm,
      paddingHorizontal: s.md,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      alignItems: 'center',
      justifyContent: 'center',
    },
    borrarBtnSecondaryTxt: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.text,
    },
    borrarBtnDestructive: {
      flex: 1,
      paddingVertical: s.sm,
      paddingHorizontal: s.md,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    borrarBtnDestructiveTxt: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.danger,
    },
    errorModalBody: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.text,
      marginBottom: s.md,
    },
    errorModalOk: {
      alignSelf: 'flex-end',
      paddingVertical: s.sm,
      paddingHorizontal: s.md,
    },
    errorModalOkTxt: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.primary,
    },
  });
}

export function RutinasListadoTab() {
  const router = useRouter();
  const { user } = useAuth();
  const { iniciarEntrenoVacio, iniciarDesdeRutina, entrenoActivo } = useEntreno();
  const { c, f, ts, s, r } = useTheme();
  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [modalEntrenoVacio, setModalEntrenoVacio] = useState(false);
  const [nombreEntrenoVacio, setNombreEntrenoVacio] = useState('');
  const [iniciandoEntrenoVacio, setIniciandoEntrenoVacio] = useState(false);
  const iniciandoEntrenoVacioRef = useRef(false);
  const [rutinaIniciandoId, setRutinaIniciandoId] = useState<string | null>(null);
  const rutinaIniciandoRef = useRef<string | null>(null);

  const [filtro, setFiltro] = useState<FiltroRutinas>('mis');
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [lista, setLista] = useState<RutinaListaVista[]>([]);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(false);

  const [modalMenuVisible, setModalMenuVisible] = useState(false);
  const [modalBorrarVisible, setModalBorrarVisible] = useState(false);
  const [modalNombreVisible, setModalNombreVisible] = useState(false);
  const [modalErrorVisible, setModalErrorVisible] = useState(false);
  const [errorModalMensaje, setErrorModalMensaje] = useState('');
  const [rutinaSeleccionada, setRutinaSeleccionada] = useState<RutinaListaVista | null>(null);
  const [textoRenombrarDraft, setTextoRenombrarDraft] = useState('');
  const [guardandoNombre, setGuardandoNombre] = useState(false);
  const [borrandoRutina, setBorrandoRutina] = useState(false);

  const listaRef = useRef<RutinaListaVista[]>([]);
  const favIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    listaRef.current = lista;
  }, [lista]);
  useEffect(() => {
    favIdsRef.current = favIds;
  }, [favIds]);

  const cargar = useCallback(async () => {
    if (!user?.id) {
      setLista([]);
      setFavIds(new Set());
      return;
    }
    setCargando(true);
    try {
      if (filtro === 'mis') {
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
    void cargar();
  }, [cargar]);

  const onToggleFavorito = useCallback(
    async (routineId: string) => {
      if (!user?.id) return;
      await entrenamientoService.toggleFavoritoRutina(user.id, routineId);
      setFavIds((prev) => {
        const next = new Set(prev);
        if (next.has(routineId)) next.delete(routineId);
        else next.add(routineId);
        return next;
      });
      if (filtro === 'favoritos') {
        void cargar();
      }
    },
    [user?.id, filtro, cargar],
  );

  const toggleAccordion = () => {
    setAccordionOpen((o) => !o);
  };

  const seleccionarFiltro = (next: FiltroRutinas) => {
    setFiltro(next);
    setAccordionOpen(false);
  };

  const cerrarModalEntrenoVacio = useCallback(() => {
    setModalEntrenoVacio(false);
    setNombreEntrenoVacio('');
    iniciandoEntrenoVacioRef.current = false;
    setIniciandoEntrenoVacio(false);
  }, []);

  const puedeComenzarEntrenoVacio = nombreEntrenoVacio.trim() !== '';

  const onComenzarEntrenoVacio = useCallback(async () => {
    if (!puedeComenzarEntrenoVacio || iniciandoEntrenoVacioRef.current) return;
    iniciandoEntrenoVacioRef.current = true;
    setIniciandoEntrenoVacio(true);
    try {
      await iniciarEntrenoVacio(nombreEntrenoVacio.trim());
      cerrarModalEntrenoVacio();
      router.push('/(tabs)/(entrenamiento)/entreno-activo');
    } finally {
      iniciandoEntrenoVacioRef.current = false;
      setIniciandoEntrenoVacio(false);
    }
  }, [puedeComenzarEntrenoVacio, nombreEntrenoVacio, iniciarEntrenoVacio, cerrarModalEntrenoVacio, router]);

  const hayEntrenoActivo = entrenoActivo != null;

  const onEmpezarRutina = useCallback(
    async (rut: RutinaListaVista) => {
      if (hayEntrenoActivo || rutinaIniciandoRef.current != null) return;
      rutinaIniciandoRef.current = rut.id;
      setRutinaIniciandoId(rut.id);
      try {
        await iniciarDesdeRutina(rut.id, rut.nombre);
        router.push('/(tabs)/(entrenamiento)/entreno-activo');
      } finally {
        rutinaIniciandoRef.current = null;
        setRutinaIniciandoId(null);
      }
    },
    [hayEntrenoActivo, iniciarDesdeRutina, router],
  );

  const mostrarErrorModal = useCallback((mensaje: string) => {
    setErrorModalMensaje(mensaje);
    setModalErrorVisible(true);
  }, []);

  const cerrarErrorModal = useCallback(() => {
    setModalErrorVisible(false);
    setErrorModalMensaje('');
  }, []);

  const ejecutarCambiarNombre = useCallback(
    async (rut: RutinaListaVista, nuevoNombre: string): Promise<boolean> => {
      const snapshot = listaRef.current.map((r) => ({ ...r, ejercicios: [...r.ejercicios] }));
      setLista((prev) => prev.map((r) => (r.id === rut.id ? { ...r, nombre: nuevoNombre } : r)));
      try {
        await cambiarNombreRutina(rut.id, nuevoNombre);
        return true;
      } catch (e) {
        setLista(snapshot);
        mostrarErrorModal(e instanceof Error ? e.message : 'No se pudo cambiar el nombre.');
        return false;
      }
    },
    [mostrarErrorModal],
  );

  const cerrarModalNombre = useCallback(() => {
    setModalNombreVisible(false);
    setTextoRenombrarDraft('');
    setGuardandoNombre(false);
    setRutinaSeleccionada(null);
  }, []);

  const guardarNombreRutina = useCallback(async () => {
    const rut = rutinaSeleccionada;
    const v = textoRenombrarDraft.trim();
    if (!rut || !v) return;
    setGuardandoNombre(true);
    try {
      const ok = await ejecutarCambiarNombre(rut, v);
      if (ok) cerrarModalNombre();
    } finally {
      setGuardandoNombre(false);
    }
  }, [textoRenombrarDraft, rutinaSeleccionada, ejecutarCambiarNombre, cerrarModalNombre]);

  const cerrarMenuModal = useCallback(() => {
    setModalMenuVisible(false);
    setRutinaSeleccionada(null);
  }, []);

  const onMenuCambiarNombre = useCallback(() => {
    const r = rutinaSeleccionada;
    if (!r) return;
    setModalMenuVisible(false);
    setTextoRenombrarDraft(r.nombre);
    setModalNombreVisible(true);
  }, [rutinaSeleccionada]);

  const onMenuBorrarRutina = useCallback(() => {
    setModalMenuVisible(false);
    setModalBorrarVisible(true);
  }, []);

  const cerrarModalBorrar = useCallback(() => {
    setModalBorrarVisible(false);
    setRutinaSeleccionada(null);
  }, []);

  const ejecutarBorrarRutina = useCallback(
    async (rut: RutinaListaVista): Promise<boolean> => {
      const snapshotLista = listaRef.current.map((r) => ({ ...r, ejercicios: [...r.ejercicios] }));
      const snapshotFav = new Set(favIdsRef.current);
      setLista((prev) => prev.filter((x) => x.id !== rut.id));
      setFavIds((prev) => {
        const n = new Set(prev);
        n.delete(rut.id);
        return n;
      });
      try {
        await borrarRutina(rut.id);
        return true;
      } catch (e) {
        setLista(snapshotLista);
        setFavIds(snapshotFav);
        mostrarErrorModal(e instanceof Error ? e.message : 'No se pudo borrar la rutina.');
        return false;
      }
    },
    [mostrarErrorModal],
  );

  const confirmarBorrarRutina = useCallback(async () => {
    const rut = rutinaSeleccionada;
    if (!rut) return;
    setBorrandoRutina(true);
    try {
      const ok = await ejecutarBorrarRutina(rut);
      if (ok) cerrarModalBorrar();
    } finally {
      setBorrandoRutina(false);
    }
  }, [rutinaSeleccionada, ejecutarBorrarRutina, cerrarModalBorrar]);

  return (
    <View style={styles.root}>
      <Pressable
        style={styles.primaryBtn}
        onPress={() => setModalEntrenoVacio(true)}
        accessibilityRole="button"
      >
        <Ionicons name="add" size={22} color={c.textOnPrimary} />
        <Text style={styles.primaryBtnText}>Empezar entreno vacío</Text>
      </Pressable>

      <View style={styles.secondaryRow}>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.push('/(tabs)/(entrenamiento)/crear-rutina')}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryBtnText}>NUEVA RUTINA</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => router.push('/(tabs)/(entrenamiento)/explorar-rutinas')} accessibilityRole="button">
          <Text style={styles.secondaryBtnText}>EXPLORAR</Text>
        </Pressable>
      </View>

      <View style={styles.accordionWrap}>
        <Pressable style={styles.accordionHeader} onPress={toggleAccordion} accessibilityRole="button">
          <Text style={styles.accordionTitulo}>{filtro === 'mis' ? 'Mis Rutinas' : 'Favoritos'}</Text>
          <Ionicons name={accordionOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.textSecondary} />
        </Pressable>
        {accordionOpen && (
          <View style={styles.accordionOptions}>
            <Pressable
              style={[styles.accordionOption, filtro === 'mis' && styles.accordionOptionActive]}
              onPress={() => seleccionarFiltro('mis')}
            >
              <Text style={styles.accordionOptionText}>Mis Rutinas</Text>
            </Pressable>
            <Pressable
              style={[styles.accordionOption, filtro === 'favoritos' && styles.accordionOptionActive]}
              onPress={() => seleccionarFiltro('favoritos')}
            >
              <Text style={styles.accordionOptionText}>Favoritos</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text style={styles.sectionMeta} numberOfLines={1}>
        {lista.length} RUTINA{lista.length === 1 ? '' : 'S'}
      </Text>

      {cargando ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <View style={styles.listArea}>
          {!user?.id ? (
            <Text style={styles.emptyTxt}>Inicia sesión para ver tus rutinas.</Text>
          ) : lista.length === 0 ? (
            <Text style={styles.emptyTxt}>
              {filtro === 'mis' ? 'No tienes rutinas creadas todavía.' : 'Aún no has marcado favoritas.'}
            </Text>
          ) : (
            lista.map((rut) => {
              const esFav = favIds.has(rut.id);
              return (
                <View key={rut.id} style={styles.card}>
                  {filtro === 'favoritos' ? (
                    <Pressable
                      style={styles.actionHit}
                      onPress={() => onToggleFavorito(rut.id)}
                      accessibilityRole="button"
                      accessibilityLabel={esFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                    >
                      <Ionicons name={esFav ? 'star' : 'star-outline'} size={22} color={esFav ? c.warning : c.textMuted} />
                    </Pressable>
                  ) : (
                    <Pressable
                      style={styles.actionHit}
                      onPress={() => {
                        setRutinaSeleccionada(rut);
                        setModalMenuVisible(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Opciones de rutina"
                    >
                      <Ionicons name="ellipsis-horizontal" size={22} color={c.textMuted} />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() =>
                      router.push(`/(tabs)/(entrenamiento)/rutina/${rut.id}` as Parameters<typeof router.push>[0])
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir rutina ${rut.nombre}`}
                  >
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {rut.nombre}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.startBtn,
                      (hayEntrenoActivo || rutinaIniciandoId != null) && styles.startBtnDisabled,
                    ]}
                    onPress={() => void onEmpezarRutina(rut)}
                    disabled={hayEntrenoActivo || rutinaIniciandoId != null}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: hayEntrenoActivo || rutinaIniciandoId != null }}
                  >
                    {rutinaIniciandoId === rut.id ? (
                      <ActivityIndicator color={c.primary} size="small" />
                    ) : (
                      <Text
                        style={[styles.startBtnText, hayEntrenoActivo && styles.startBtnTextMuted]}
                        numberOfLines={1}
                      >
                        {hayEntrenoActivo ? 'ENTRENO EN CURSO' : 'EMPEZAR RUTINA'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      )}

      <Modal visible={modalMenuVisible && rutinaSeleccionada != null} transparent animationType="fade" onRequestClose={cerrarMenuModal}>
        <Pressable style={styles.dsModalOverlay} onPress={cerrarMenuModal}>
          <Pressable style={styles.dsModalCard} onPress={(e) => e.stopPropagation()}>
            {rutinaSeleccionada ? (
              <>
                <Text style={styles.menuModalTitle} numberOfLines={2}>
                  {rutinaSeleccionada.nombre}
                </Text>
                <Pressable style={styles.menuOption} onPress={onMenuCambiarNombre} accessibilityRole="button">
                  <Text style={styles.menuOptionTxt}>Cambiar nombre</Text>
                </Pressable>
                <View style={styles.menuSep} />
                <Pressable style={styles.menuOption} onPress={onMenuBorrarRutina} accessibilityRole="button">
                  <Text style={styles.menuOptionDestructiveTxt}>Borrar rutina</Text>
                </Pressable>
                <Pressable style={styles.menuCancel} onPress={cerrarMenuModal} accessibilityRole="button">
                  <Text style={styles.menuCancelTxt}>Cancelar</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={modalBorrarVisible && rutinaSeleccionada != null} transparent animationType="fade" onRequestClose={cerrarModalBorrar}>
        <Pressable style={styles.dsModalOverlay} onPress={cerrarModalBorrar}>
          <Pressable style={styles.dsModalCard} onPress={(e) => e.stopPropagation()}>
            {rutinaSeleccionada ? (
              <>
                <Text style={styles.borrarModalTitle}>BORRAR RUTINA</Text>
                <Text style={styles.borrarModalBody}>
                  {`¿Seguro que quieres borrar «${rutinaSeleccionada.nombre}»? Esta acción no se puede deshacer.`}
                </Text>
                <View style={styles.borrarModalRow}>
                  <Pressable style={styles.borrarBtnSecondary} onPress={cerrarModalBorrar} accessibilityRole="button">
                    <Text style={styles.borrarBtnSecondaryTxt}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.borrarBtnDestructive, borrandoRutina && { opacity: 0.6 }]}
                    onPress={() => void confirmarBorrarRutina()}
                    disabled={borrandoRutina}
                    accessibilityRole="button"
                  >
                    {borrandoRutina ? (
                      <ActivityIndicator color={c.danger} size="small" />
                    ) : (
                      <Text style={styles.borrarBtnDestructiveTxt}>Borrar</Text>
                    )}
                  </Pressable>
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={modalNombreVisible && rutinaSeleccionada != null} transparent animationType="fade" onRequestClose={cerrarModalNombre}>
        <Pressable style={styles.renameModalOverlay} onPress={cerrarModalNombre}>
          <Pressable style={styles.renameModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.renameModalTitle}>CAMBIAR NOMBRE</Text>
            <TextInput
              style={styles.renameModalInput}
              value={textoRenombrarDraft}
              onChangeText={setTextoRenombrarDraft}
              placeholder="Nombre de la rutina"
              placeholderTextColor={c.textMuted}
              autoFocus
              autoCorrect={false}
            />
            <View style={styles.renameModalRow}>
              <Pressable style={styles.renameBtnGhost} onPress={cerrarModalNombre} accessibilityRole="button">
                <Text style={styles.renameBtnGhostTxt}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.renameBtnPrimary, (guardandoNombre || textoRenombrarDraft.trim() === '') && { opacity: 0.5 }]}
                onPress={() => void guardarNombreRutina()}
                disabled={guardandoNombre || textoRenombrarDraft.trim() === ''}
                accessibilityRole="button"
              >
                {guardandoNombre ? (
                  <ActivityIndicator color={c.textOnPrimary} size="small" />
                ) : (
                  <Text style={styles.renameBtnPrimaryTxt}>Guardar</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={modalErrorVisible} transparent animationType="fade" onRequestClose={cerrarErrorModal}>
        <Pressable style={styles.dsModalOverlay} onPress={cerrarErrorModal}>
          <Pressable style={styles.dsModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.renameModalTitle}>ERROR</Text>
            <Text style={styles.errorModalBody}>{errorModalMensaje}</Text>
            <Pressable style={styles.errorModalOk} onPress={cerrarErrorModal} accessibilityRole="button">
              <Text style={styles.errorModalOkTxt}>OK</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={modalEntrenoVacio} transparent animationType="fade" onRequestClose={cerrarModalEntrenoVacio}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo entreno</Text>
              <Pressable
                style={styles.modalClose}
                onPress={cerrarModalEntrenoVacio}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Ionicons name="close" size={24} color={c.textDisplay} />
              </Pressable>
            </View>
            <Text style={styles.modalLabel}>NOMBRE</Text>
            <TextInput
              style={styles.modalInput}
              value={nombreEntrenoVacio}
              onChangeText={setNombreEntrenoVacio}
              placeholder="Ej. Empuje, Pierna…"
              placeholderTextColor={c.textMuted}
              autoCorrect={false}
              autoFocus
            />
            <View style={styles.modalRow}>
              <Pressable style={styles.modalBtn} onPress={cerrarModalEntrenoVacio} accessibilityRole="button">
                <Text style={styles.modalBtnTxt}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  (!puedeComenzarEntrenoVacio || iniciandoEntrenoVacio) && { opacity: 0.4 },
                ]}
                onPress={() => void onComenzarEntrenoVacio()}
                disabled={!puedeComenzarEntrenoVacio || iniciandoEntrenoVacio}
                accessibilityRole="button"
                accessibilityState={{ disabled: !puedeComenzarEntrenoVacio || iniciandoEntrenoVacio }}
              >
                {iniciandoEntrenoVacio ? (
                  <ActivityIndicator color={c.textOnPrimary} size="small" />
                ) : (
                  <Text style={[styles.modalBtnTxt, styles.modalBtnTxtPrimary]}>Comenzar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
