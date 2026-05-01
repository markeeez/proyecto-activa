import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector, Swipeable } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarioNutricion } from '@/components/nutricion/CalendarioNutricion';
import { SortableMealList } from '@/components/SortableMealList';

import { COMIDAS_PREDETERMINADAS } from '@/constants/comidasPredeterminadas';
import { useAuth } from '@/hooks/useAuth';
import { useNutricion } from '@/hooks/useNutricion';
import { useTheme } from '@/hooks/useTheme';
import {
  agregarDiasIso,
  esDiaPasadoVsHoy,
  formatRangoSemanaCortoES,
  getSemanaMovil,
} from '@/lib/fechaNutricion';
import { iconoComida } from '@/lib/iconosComida';
import { guardarOrdenComidas, obtenerOrdenComidas } from '@/lib/nutricionLogPreferencias';
import { nutricionService } from '@/services/nutricion.service';
import type { ComidaConAlimentos } from '@/types/app.types';

const SKELETON_BG = '#1A1A1A';
const SKELETON_SHIMMER = '#2A2A2A';
const SKELETON_FADE_MS = 200;

type NutricionStyles = ReturnType<typeof makeStyles>;

interface SkeletonProps {
  styles: NutricionStyles;
  shimmerOpacity: Animated.Value;
}

const stylesStatic = StyleSheet.create({
  skeletonBlock: {
    backgroundColor: SKELETON_BG,
    overflow: 'hidden',
  },
  skeletonShimmer: {
    backgroundColor: SKELETON_SHIMMER,
  },
});

function SkeletonBlock({
  style,
  shimmerOpacity,
}: {
  style?: StyleProp<ViewStyle>;
  shimmerOpacity: Animated.Value;
}) {
  return (
    <View style={[stylesStatic.skeletonBlock, style]}>
      <Animated.View style={[StyleSheet.absoluteFillObject, stylesStatic.skeletonShimmer, { opacity: shimmerOpacity }]} />
    </View>
  );
}

function MealCardsSkeleton({ styles, shimmerOpacity }: SkeletonProps) {
  return (
    <View style={styles.skeletonMealsList}>
      {COMIDAS_PREDETERMINADAS.map((meal) => (
        <View key={`meal-skeleton-${meal.slot}`} style={[styles.mealCard, styles.skeletonSurface]}>
          <View style={styles.mealHeaderRow}>
            <SkeletonBlock style={styles.skeletonMealIcon} shimmerOpacity={shimmerOpacity} />

            <View style={styles.mealHeaderText}>
              <SkeletonBlock style={styles.skeletonMealTitle} shimmerOpacity={shimmerOpacity} />
              <View style={styles.mealMetaRow}>
                <SkeletonBlock style={styles.skeletonMealKcal} shimmerOpacity={shimmerOpacity} />
                <View style={styles.mealMetaDivider} />
                <SkeletonBlock style={styles.skeletonMealMacro} shimmerOpacity={shimmerOpacity} />
                <View style={styles.mealMetaDivider} />
                <SkeletonBlock style={styles.skeletonMealMacro} shimmerOpacity={shimmerOpacity} />
                <View style={styles.mealMetaDivider} />
                <SkeletonBlock style={styles.skeletonMealMacro} shimmerOpacity={shimmerOpacity} />
              </View>
            </View>

            <SkeletonBlock style={styles.skeletonAddBtn} shimmerOpacity={shimmerOpacity} />
          </View>

          <View style={[styles.mealItemsList, styles.skeletonMealItemsList]}>
            <View style={styles.foodRow}>
              <SkeletonBlock style={styles.skeletonFoodName} shimmerOpacity={shimmerOpacity} />
              <View style={styles.foodMetaRow}>
                <SkeletonBlock style={styles.skeletonFoodGrams} shimmerOpacity={shimmerOpacity} />
                <View style={styles.foodMetrics}>
                  <SkeletonBlock style={styles.skeletonFoodMetric} shimmerOpacity={shimmerOpacity} />
                  <SkeletonBlock style={styles.skeletonFoodMetric} shimmerOpacity={shimmerOpacity} />
                  <SkeletonBlock style={styles.skeletonFoodMetric} shimmerOpacity={shimmerOpacity} />
                  <SkeletonBlock style={styles.skeletonFoodKcal} shimmerOpacity={shimmerOpacity} />
                </View>
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function ordenarComidas(comidas: ComidaConAlimentos[], ordenIds: string[] | null): ComidaConAlimentos[] {
  if (!ordenIds?.length) {
    return [...comidas].sort((a, b) => a.orden - b.orden);
  }
  const map = new Map(comidas.map((c) => [c.mealId, c]));
  const seen = new Set<string>();
  const out: ComidaConAlimentos[] = [];
  for (const id of ordenIds) {
    const c = map.get(id);
    if (c) {
      out.push(c);
      seen.add(id);
    }
  }
  for (const c of comidas) {
    if (!seen.has(c.mealId)) out.push(c);
  }
  return out;
}

export default function NutricionIndex() {
  const { c, f, ts, s, r } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    fecha,
    cambiarFecha,
    resumen,
    objetivos,
    cargando,
    eliminarComidaDelLog,
    crearComidaPersonalizada,
    eliminarAlimento,
  } = useNutricion();

  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [ordenIds, setOrdenIds] = useState<string[] | null>(null);
  // dragOverride: orden optimista durante/después de un drag. Se limpia cuando llegan datos frescos.
  const [dragOverride, setDragOverride] = useState<ComidaConAlimentos[] | null>(null);
  const [modalNuevaComida, setModalNuevaComida] = useState(false);
  const [nombreNuevaComida, setNombreNuevaComida] = useState('');
  const [calendarioVisible, setCalendarioVisible] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    void obtenerOrdenComidas(user.id, fecha).then(setOrdenIds);
  }, [user?.id, fecha]);

  /** Quitar del orden guardado los meal_id que ya no existen en el log. */
  useEffect(() => {
    if (!user?.id || !resumen?.comidas) return;
    setOrdenIds((prev) => {
      if (prev == null) return prev;
      const present = new Set(resumen.comidas.map((x) => x.mealId));
      const next = prev.filter((id) => present.has(id));
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
      void guardarOrdenComidas(user.id, fecha, next);
      return next;
    });
  }, [resumen?.comidas, user?.id, fecha]);

  const listaOrdenada = useMemo(
    () => ordenarComidas(resumen?.comidas ?? [], ordenIds),
    [resumen?.comidas, ordenIds],
  );

  // comidasData: usa el override del drag si existe, si no la lista ordenada del servidor.
  // Esto evita el render extra que causaba que los macros aparecieran antes que las comidas.
  const comidasData = dragOverride ?? listaOrdenada;

  // Limpiar el override cuando llegan datos frescos del servidor.
  useEffect(() => {
    setDragOverride(null);
  }, [resumen]);

  // true mientras se cargan datos de un día nuevo (resumen aún no corresponde a `fecha`)
  const cargandoDia = cargando && !resumen;

  const semana = useMemo(() => getSemanaMovil(fecha), [fecha]);
  const rangoSemanaLabel = useMemo(() => formatRangoSemanaCortoES(semana), [semana]);
  const skeletonFadeOpacity = useRef(new Animated.Value(cargandoDia ? 1 : 0)).current;
  const shimmerOpacity = useRef(new Animated.Value(0.3)).current;
  const contentOpacity = useRef(new Animated.Value(cargandoDia ? 0 : 1)).current;
  const [skeletonVisible, setSkeletonVisible] = useState(cargandoDia);

  const avanzarDia = useCallback(() => {
    cambiarFecha(agregarDiasIso(fecha, 1));
  }, [fecha, cambiarFecha]);

  const retrocederDia = useCallback(() => {
    cambiarFecha(agregarDiasIso(fecha, -1));
  }, [fecha, cambiarFecha]);

  const abrirCalendario = useCallback(() => {
    setCalendarioVisible(true);
  }, []);

  const cerrarCalendario = useCallback(() => {
    setCalendarioVisible(false);
  }, []);

  const seleccionarDiaCalendario = useCallback(
    (fechaIso: string) => {
      cambiarFecha(fechaIso);
      setCalendarioVisible(false);
    },
    [cambiarFecha],
  );

  const swipeCalendario = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-20, 20])
        .onEnd((e) => {
          'worklet';
          if (e.translationX < -48) {
            runOnJS(avanzarDia)();
          } else if (e.translationX > 48) {
            runOnJS(retrocederDia)();
          }
        }),
    [avanzarDia, retrocederDia],
  );

  const onDragEnd = useCallback(
    ({ data }: { data: ComidaConAlimentos[] }) => {
      setDragOverride(data);
      const ids = data.map((c) => c.mealId);
      setOrdenIds(ids);
      if (user?.id) void guardarOrdenComidas(user.id, fecha, ids);

      // Timeout de seguridad: si el servidor no responde en 10s, limpiar el override
      // para que el estado visual vuelva a sincronizarse con lo que haya en servidor.
      const safetyTimer = setTimeout(() => setDragOverride(null), 10_000);

      const lid = resumen?.logId;
      if (lid) {
        nutricionService
          .actualizarOrdenComidas(lid, ids)
          .then(() => clearTimeout(safetyTimer))
          .catch(() => {
            clearTimeout(safetyTimer);
            setDragOverride(null);
            if (typeof __DEV__ !== 'undefined' && __DEV__) {
              console.warn('[nutricion] actualizarOrdenComidas falló — orden revertido');
            }
          });
      } else {
        clearTimeout(safetyTimer);
      }
    },
    [user?.id, fecha, resumen?.logId],
  );

  const confirmarNuevaComida = useCallback(async () => {
    if (!nombreNuevaComida.trim()) return;
    try {
      const nuevoMealId = await crearComidaPersonalizada(nombreNuevaComida.trim());
      setModalNuevaComida(false);
      setNombreNuevaComida('');
      if (nuevoMealId && esDiaPasadoVsHoy(fecha)) {
        router.push({
          pathname: '/(tabs)/(nutricion)/agregar',
          params: { mealId: nuevoMealId, fecha },
        });
      }
    } catch {
      /* silencioso; podría mostrarse toast */
    }
  }, [nombreNuevaComida, crearComidaPersonalizada, fecha]);

  useEffect(() => {
    if (cargandoDia) {
      setSkeletonVisible(true);
      skeletonFadeOpacity.setValue(1);
      contentOpacity.setValue(0);
      shimmerOpacity.setValue(0.3);

      const shimmerLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerOpacity, {
            toValue: 0.8,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerOpacity, {
            toValue: 0.3,
            duration: 650,
            useNativeDriver: true,
          }),
        ]),
      );

      shimmerLoop.start();
      return () => shimmerLoop.stop();
    }

    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: SKELETON_FADE_MS,
        useNativeDriver: true,
      }),
      Animated.timing(skeletonFadeOpacity, {
        toValue: 0,
        duration: SKELETON_FADE_MS,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setSkeletonVisible(false);
    });
  }, [cargandoDia, contentOpacity, shimmerOpacity, skeletonFadeOpacity]);

  const renderHeader = useCallback(() => {
    return (
      <>
        <View style={styles.screenHeader}>
          <View style={styles.titleRow}>
            <Text style={styles.screenTitle}>Alimentación</Text>
            <View style={styles.titleBadge}>
              <Ionicons name="nutrition-outline" size={15} color={c.primary} />
            </View>
          </View>

          <View style={styles.statsButton}>
            <Ionicons name="bar-chart-outline" size={22} color={c.textDisplay} />
          </View>
        </View>

        <View style={styles.weekStripCard}>
          <View style={styles.weekStripLeft}>
            <Text style={styles.weekStripTitle}>Esta semana</Text>
            <Text style={styles.weekStripSubtitle} numberOfLines={1} ellipsizeMode="tail">
              {rangoSemanaLabel}
            </Text>
          </View>
          <GestureDetector gesture={swipeCalendario}>
            <View style={styles.weekStripDaysGestureHost}>
              <View style={styles.weekStripDaysWrap}>
                {semana.map((d, index) => (
                  <View key={`${d.key}-${d.fechaIso}-${index}`} style={styles.weekDayColumn}>
                    <Pressable
                      style={styles.weekDayPress}
                      onPress={() => cambiarFecha(d.fechaIso)}
                      hitSlop={{ top: 4, bottom: 4, left: 1, right: 1 }}
                    >
                      <View style={[styles.weekDayCell, d.activo && styles.weekDayCellActive]}>
                        <Text style={[styles.weekDayLetter, d.activo && styles.weekDayLetterActive]}>{d.key}</Text>
                        <Text
                          style={[styles.weekDayNumber, d.activo && styles.weekDayNumberActive]}
                          allowFontScaling={false}
                        >
                          {d.dia}
                        </Text>
                      </View>
                    </Pressable>
                    <View style={[styles.weekDayUnderline, d.activo && styles.weekDayUnderlineActive]} />
                  </View>
                ))}
              </View>
            </View>
          </GestureDetector>
          <Pressable
            onPress={abrirCalendario}
            hitSlop={8}
            style={styles.weekStripCalendarBtn}
            accessibilityRole="button"
            accessibilityLabel="Abrir calendario de nutrición"
          >
            <Ionicons name="calendar-outline" size={18} color={c.textDisplay} />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>COMIDAS DEL DÍA</Text>

        {skeletonVisible && (
          <Animated.View pointerEvents="none" style={{ opacity: skeletonFadeOpacity }}>
            <MealCardsSkeleton styles={styles} shimmerOpacity={shimmerOpacity} />
          </Animated.View>
        )}
      </>
    );
  }, [
    swipeCalendario,
    semana,
    rangoSemanaLabel,
    styles,
    cambiarFecha,
    abrirCalendario,
    c.textDisplay,
    c.primary,
    shimmerOpacity,
    skeletonFadeOpacity,
    skeletonVisible,
  ]);

  const renderItem = useCallback(
    ({ item: meal, drag, isActive }: { item: ComidaConAlimentos; drag: () => void; isActive: boolean; }) => {
      const logId = resumen?.logId;
      const mealIcon = iconoComida(meal.nombre, meal.isDefault);

      const leftActions = () => (
        <View style={styles.swipeLeft}>
          <View style={styles.swipeDeleteInner}>
            <Text style={styles.swipeDeleteTxt}>Eliminar</Text>
          </View>
        </View>
      );

      return (
        <Animated.View style={{ opacity: contentOpacity }}>
          <Swipeable
            enabled={!isActive}
            renderLeftActions={leftActions}
            overshootLeft={false}
            onSwipeableOpen={(direction) => {
              const mid = meal.mealId;
              if (direction !== 'left' || !logId || !mid) return;
              void (async () => {
                try {
                  await eliminarComidaDelLog(logId, mid);
                } catch (e) {
                  console.error('[Nutricion] eliminar comida', e);
                }
              })();
            }}
          >
            <View style={[styles.mealCard, isActive && styles.mealCardActive]}>
              <View style={styles.mealHeaderRow}>
                <Pressable onLongPress={drag} delayLongPress={150} style={styles.mealIconWrap} hitSlop={12}>
                  <Ionicons name={mealIcon} size={22} color={c.primary} />
                </Pressable>

                <View style={styles.mealHeaderText}>
                  <Text style={styles.mealTitle} numberOfLines={1}>{meal.nombre}</Text>
                  <View style={styles.mealMetaRow}>
                    <Ionicons name="flame-outline" size={11} color={c.danger} />
                    <Text style={styles.mealMetaKcal}>{Math.round(meal.totalCalorias)} kcal</Text>
                    <View style={styles.mealMetaDivider} />
                    <Text style={styles.mealMetaProtein}>{Math.round(meal.totalProteinas)}P</Text>
                    <View style={styles.mealMetaDivider} />
                    <Text style={styles.mealMetaCarbs}>{Math.round(meal.totalCarbos)}C</Text>
                    <View style={styles.mealMetaDivider} />
                    <Text style={styles.mealMetaFat}>{Math.round(meal.totalGrasas)}G</Text>
                  </View>
                </View>

                <Pressable
                  style={styles.addBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/(nutricion)/agregar',
                      params: { mealId: meal.mealId, fecha },
                    })
                  }
                >
                  <Text style={styles.addBtnText}>+</Text>
                </Pressable>
              </View>

              <View style={styles.mealItemsList}>
                {meal.items.map((item) => {
                  const rightActionsFood = () => (
                    <View style={styles.swipeRight}>
                      <View style={styles.swipeDeleteFoodInner}>
                        <Text style={styles.swipeDeleteTxt}>Quitar</Text>
                      </View>
                    </View>
                  );
                  return (
                    <Swipeable
                      key={item.id}
                      renderRightActions={rightActionsFood}
                      overshootRight={false}
                      friction={2}
                      onSwipeableOpen={(direction) => {
                        if (direction !== 'right') return;
                        void (async () => {
                          try {
                            await eliminarAlimento(item.id);
                          } catch (e) {
                            console.error('[Nutricion] eliminar alimento', e);
                          }
                        })();
                      }}
                    >
                      <View style={styles.foodRow}>
                        <Text style={styles.foodName} numberOfLines={1}>{item.food?.nombre ?? 'Alimento'}</Text>

                        <View style={styles.foodMetaRow}>
                          <Text style={styles.foodMeta}>{Math.round(item.gramos)} g</Text>
                          <View style={styles.foodMetrics}>
                            <Text style={[styles.foodMetricText, styles.foodMacroProteinText]}>
                              {Math.round(item.proteinas_calculadas)}P
                            </Text>
                            <Text style={[styles.foodMetricText, styles.foodMacroCarbsText]}>
                              {Math.round(item.carbos_calculados)}C
                            </Text>
                            <Text style={[styles.foodMetricText, styles.foodMacroFatText]}>
                              {Math.round(item.grasas_calculadas)}G
                            </Text>
                            <Text style={styles.foodKcalText}>{Math.round(item.calorias_calculadas)} kcal</Text>
                          </View>
                        </View>
                      </View>
                    </Swipeable>
                  );
                })}
                {meal.items.length === 0 && (
                  <Text style={styles.emptyMealSlotHint}>Todavía no hay alimentos en esta comida</Text>
                )}
              </View>
            </View>
          </Swipeable>
        </Animated.View>
      );
    },
    [styles, resumen?.logId, eliminarComidaDelLog, eliminarAlimento, fecha, c.primary, c.danger, contentOpacity],
  );

  const renderFooter = useCallback(() => {
    if (cargandoDia) return null;

    return (
      <View style={styles.footerBlock}>
        <View style={styles.adviceCard}>
          <View style={styles.adviceIcon}>
            <Ionicons name="sparkles-outline" size={16} color={c.textSecondary} />
          </View>
          <View style={styles.adviceTextBlock}>
            <Text style={styles.adviceLabel}>Consejo del día</Text>
            <Text style={styles.adviceText}>Intenta alcanzar tus objetivos de proteínas 💪</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
        </View>

      </View>
    );
  }, [styles, c.textSecondary, cargandoDia]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <SortableMealList
        data={cargandoDia ? [] : comidasData}
        keyExtractor={(item) => item.mealId}
        onDragEnd={onDragEnd}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        containerStyle={styles.listContainer}
      />

      {comidasData.length === 0 && !cargando && (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <Text style={styles.emptyMealText}>No hay comidas registradas para este día.</Text>
        </View>
      )}

      <CalendarioNutricion
        visible={calendarioVisible}
        fechaActual={fecha}
        objetivos={objetivos}
        onClose={cerrarCalendario}
        onSeleccionarDia={seleccionarDiaCalendario}
      />

      <Modal visible={modalNuevaComida} transparent animationType="fade" onRequestClose={() => setModalNuevaComida(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalNuevaComida(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Nueva comida</Text>
            <TextInput
              value={nombreNuevaComida}
              onChangeText={setNombreNuevaComida}
              placeholder="Nombre"
              placeholderTextColor={c.textMuted}
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtnGhost} onPress={() => setModalNuevaComida(false)}>
                <Text style={styles.modalBtnGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.modalBtnPrimary} onPress={() => void confirmarNuevaComida()}>
                <Text style={styles.modalBtnPrimaryText}>Aceptar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(
  c: ReturnType<typeof useTheme>['c'],
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
    listContainer: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: s.md,
      paddingBottom: s.xxl,
      gap: s.sm,
    },
    skeletonSurface: {
      backgroundColor: SKELETON_BG,
      borderColor: SKELETON_BG,
    },
    skeletonMealsList: {
      gap: s.sm,
    },
    skeletonMealIcon: {
      width: 44,
      height: 44,
      borderRadius: r.pill,
    },
    skeletonMealTitle: {
      width: '58%',
      height: 18,
      borderRadius: r.technical,
    },
    skeletonMealKcal: {
      width: 52,
      height: 12,
      borderRadius: r.technical,
    },
    skeletonMealMacro: {
      width: 20,
      height: 12,
      borderRadius: r.technical,
    },
    skeletonAddBtn: {
      width: 38,
      height: 38,
      borderRadius: r.sm,
    },
    skeletonMealItemsList: {
      backgroundColor: SKELETON_BG,
      borderColor: SKELETON_BG,
    },
    skeletonFoodName: {
      width: '62%',
      height: 16,
      borderRadius: r.technical,
    },
    skeletonFoodGrams: {
      width: 40,
      height: 13,
      borderRadius: r.technical,
    },
    skeletonFoodMetric: {
      width: 18,
      height: 13,
      borderRadius: r.technical,
    },
    skeletonFoodKcal: {
      width: 48,
      height: 13,
      borderRadius: r.technical,
    },
    screenHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: s.md,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
    },
    screenTitle: {
      ...ts.heading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      letterSpacing: -0.6,
    },
    titleBadge: {
      width: s.lg,
      height: s.lg,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statsButton: {
      width: 42,
      height: 42,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weekStripCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.borderVisible,
      paddingVertical: s.xs,
      paddingHorizontal: s.sm,
      gap: s.xs,
    },
    weekStripLeft: {
      justifyContent: 'center',
      alignItems: 'flex-start',
      flexShrink: 0,
      maxWidth: 112,
      paddingRight: s.xs,
    },
    weekStripTitle: {
      fontSize: 12,
      lineHeight: 15,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      letterSpacing: -0.2,
    },
    weekStripSubtitle: {
      marginTop: 1,
      fontSize: 10,
      lineHeight: 13,
      fontFamily: f.sans,
      color: c.textMuted,
    },
    weekStripDaysGestureHost: {
      flex: 1,
      flexBasis: 0,
      minWidth: 0,
    },
    weekStripDaysWrap: {
      flex: 1,
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.xs,
      paddingHorizontal: 2,
    },
    weekDayColumn: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
    },
    weekDayPress: {
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    weekDayCell: {
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
      width: '100%',
      minWidth: 0,
      paddingHorizontal: 3,
      paddingVertical: 5,
      borderRadius: r.pill,
      overflow: 'hidden',
    },
    weekDayCellActive: {
      backgroundColor: c.primary,
    },
    weekDayLetter: {
      fontSize: 10,
      lineHeight: 12,
      fontFamily: f.mono,
      color: c.textMuted,
      letterSpacing: 0.45,
      textTransform: 'uppercase',
    },
    weekDayLetterActive: {
      color: c.textOnPrimary,
    },
    weekDayNumber: {
      marginTop: 1,
      fontSize: 12,
      lineHeight: 15,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      letterSpacing: -0.35,
      includeFontPadding: false,
      textAlign: 'center',
    },
    weekDayNumberActive: {
      color: c.textOnPrimary,
    },
    weekDayUnderline: {
      width: '75%',
      maxWidth: 36,
      height: 2,
      marginTop: 3,
      borderRadius: 1,
      backgroundColor: c.border,
    },
    weekDayUnderlineActive: {
      height: 3,
      maxWidth: 38,
      backgroundColor: c.primary,
    },
    weekStripCalendarBtn: {
      width: 36,
      height: 36,
      flexShrink: 0,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginTop: s.md,
    },
    mealCard: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.lg,
      backgroundColor: c.surface,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
      gap: s.sm,
    },
    mealCardActive: {
      borderColor: c.borderVisible,
      backgroundColor: c.surfaceElevated,
    },
    mealHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.xs,
    },
    mealIconWrap: {
      width: 44,
      height: 44,
      borderRadius: r.pill,
      backgroundColor: c.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mealHeaderText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    swipeLeft: {
      justifyContent: 'center',
      marginRight: s.sm,
    },
    swipeDeleteInner: {
      backgroundColor: c.danger,
      justifyContent: 'center',
      alignItems: 'center',
      width: 88,
      borderRadius: r.sm,
      flex: 1,
      marginVertical: 2,
    },
    swipeDeleteTxt: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textOnPrimary,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    swipeRight: {
      justifyContent: 'center',
      marginLeft: s.sm,
    },
    swipeDeleteFoodInner: {
      backgroundColor: c.danger,
      justifyContent: 'center',
      alignItems: 'center',
      width: 76,
      borderRadius: r.sm,
      flex: 1,
      marginVertical: 2,
    },
    mealItemsList: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    foodRow: {
      gap: 3,
      backgroundColor: 'transparent',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
    },
    mealTitle: {
      ...ts.subheading,
      fontFamily: f.sansBold,
      fontSize: 17,
      lineHeight: 21,
      letterSpacing: -0.2,
      color: c.textDisplay,
    },
    mealMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexWrap: 'nowrap',
      flexShrink: 1,
      minWidth: 0,
    },
    mealMetaKcal: {
      ...ts.label,
      fontFamily: f.sansMedium,
      fontSize: 10,
      lineHeight: 13,
      color: c.textSecondary,
    },
    mealMetaDivider: {
      width: 1,
      height: 10,
      alignSelf: 'center',
      backgroundColor: c.borderVisible,
    },
    mealMetaProtein: {
      ...ts.label,
      fontFamily: f.sansBold,
      fontSize: 10,
      lineHeight: 13,
      color: c.primary,
    },
    mealMetaCarbs: {
      ...ts.label,
      fontFamily: f.sansBold,
      fontSize: 10,
      lineHeight: 13,
      color: c.success,
    },
    mealMetaFat: {
      ...ts.label,
      fontFamily: f.sansBold,
      fontSize: 10,
      lineHeight: 13,
      color: c.macroFat,
    },
    foodName: {
      ...ts.bodySm,
      fontFamily: f.sansBold,
      color: c.textDisplay,
      alignSelf: 'stretch',
    },
    foodMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: s.sm,
    },
    foodMeta: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.textMuted,
      flexShrink: 1,
    },
    foodMetrics: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      flexWrap: 'nowrap',
      gap: 6,
      flexShrink: 0,
    },
    foodMetricText: {
      ...ts.caption,
      fontFamily: f.sansBold,
      lineHeight: 15,
    },
    foodMacroProteinText: {
      color: c.primary,
    },
    foodMacroCarbsText: {
      color: c.success,
    },
    foodMacroFatText: {
      color: c.macroFat,
    },
    foodKcalText: {
      fontSize: 10,
      lineHeight: 13,
      fontFamily: f.sansMedium,
      color: c.textMuted,
      marginLeft: 2,
    },
    emptyMealText: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textMuted,
      paddingHorizontal: s.md,
      paddingVertical: s.lg,
      textAlign: 'center',
    },
    emptyMealSlotHint: {
      ...ts.caption,
      fontFamily: f.sans,
      fontSize: 11,
      lineHeight: 15,
      color: c.textMuted,
      paddingHorizontal: s.sm,
      paddingVertical: s.xs,
      textAlign: 'center',
    },
    emptyOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: s.xl,
      top: '45%',
    },
    addBtn: {
      width: 38,
      height: 38,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBtnText: {
      fontSize: 22,
      lineHeight: 24,
      fontFamily: f.mono,
      color: c.textDisplay,
    },
    footerBlock: {
      marginTop: s.sm,
      marginBottom: s.lg,
      gap: s.sm,
    },
    adviceCard: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      backgroundColor: c.surfaceElevated,
      padding: s.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.md,
    },
    adviceIcon: {
      width: 42,
      height: 42,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    adviceTextBlock: {
      flex: 1,
      gap: s.xs,
    },
    adviceLabel: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    adviceText: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.textSecondary,
    },
    addMealBtn: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.technical,
      backgroundColor: 'transparent',
      paddingVertical: s.md,
      alignItems: 'center',
    },
    addMealBtnDisabled: {
      opacity: 0.45,
    },
    addMealBtnText: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textDisplay,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: c.background,
      justifyContent: 'center',
      paddingHorizontal: s.xl,
    },
    modalCard: {
      backgroundColor: c.surface,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      padding: s.lg,
      gap: s.md,
    },
    modalTitle: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    modalInput: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.text,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.technical,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
      backgroundColor: c.surfaceElevated,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: s.md,
    },
    modalBtnGhost: {
      paddingVertical: s.sm,
      paddingHorizontal: s.md,
    },
    modalBtnGhostText: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textSecondary,
    },
    modalBtnPrimary: {
      paddingVertical: s.sm,
      paddingHorizontal: s.md,
      backgroundColor: 'transparent',
      borderRadius: r.technical,
      borderWidth: 1,
      borderColor: c.borderVisible,
    },
    modalBtnPrimaryText: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
  });
}
