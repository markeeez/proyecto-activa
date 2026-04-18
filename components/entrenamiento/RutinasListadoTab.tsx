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
import { entrenamientoService, type RutinaListaVista } from '@/services/entrenamiento.service';
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
    favHit: {
      position: 'absolute',
      top: s.xs,
      right: s.xs,
      zIndex: 2,
      padding: s.xs,
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
                  <Pressable
                    style={styles.favHit}
                    onPress={() => onToggleFavorito(rut.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={esFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                  >
                    <Ionicons name={esFav ? 'star' : 'star-outline'} size={22} color={esFav ? c.warning : c.textMuted} />
                  </Pressable>
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
