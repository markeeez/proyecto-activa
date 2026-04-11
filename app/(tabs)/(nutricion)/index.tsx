import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { Gesture, GestureDetector, Swipeable } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { useComidaPortapapeles } from '@/context/ComidaPortapapelesContext';
import { useAuth } from '@/hooks/useAuth';
import { useNutricion } from '@/hooks/useNutricion';
import { useTheme } from '@/hooks/useTheme';
import { agregarDiasIso, esDiaPasadoVsHoy, getSemanaMovil, parseFechaLocal } from '@/lib/fechaNutricion';
import { guardarOrdenComidas, obtenerOrdenComidas } from '@/lib/nutricionLogPreferencias';
import { nutricionService } from '@/services/nutricion.service';
import type { ComidaConAlimentos } from '@/types/app.types';

type MacroKey = 'proteinas' | 'carbos' | 'grasas';

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
  const { user } = useAuth();
  const {
    fecha,
    cambiarFecha,
    resumen,
    objetivos,
    cargando,
    vaciarComida,
    eliminarComidaDelLog,
    crearComidaPersonalizada,
    pegarAlimentosEnComida,
    eliminarAlimento,
  } = useNutricion();
  const { copiarDesdeComida, tieneCopia, lineas, limpiarPortapapeles } = useComidaPortapapeles();

  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [ordenIds, setOrdenIds] = useState<string[] | null>(null);
  const [comidasData, setComidasData] = useState<ComidaConAlimentos[]>([]);
  const [modalNuevaComida, setModalNuevaComida] = useState(false);
  const [nombreNuevaComida, setNombreNuevaComida] = useState('');
  const [menuMealId, setMenuMealId] = useState<string | null>(null);

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

  useEffect(() => {
    setComidasData(listaOrdenada);
  }, [listaOrdenada]);

  const fechaLabel = useMemo(() => {
    const d = parseFechaLocal(fecha);
    return d.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: 'short',
    });
  }, [fecha]);

  const objetivoCalorias = objetivos?.calorias_objetivo ?? 2000;
  const totalCalorias = resumen?.totalCalorias ?? 0;
  const totalProteinas = resumen?.totalProteinas ?? 0;
  const totalCarbos = resumen?.totalCarbos ?? 0;
  const totalGrasas = resumen?.totalGrasas ?? 0;
  const progresoCalorias = Math.min(1, totalCalorias / Math.max(1, objetivoCalorias));

  const macros = {
    proteinas: {
      label: 'PROTEINAS',
      actual: totalProteinas,
      objetivo: objetivos?.proteinas_objetivo ?? 0,
    },
    carbos: {
      label: 'CARBOS',
      actual: totalCarbos,
      objetivo: objetivos?.carbos_objetivo ?? 0,
    },
    grasas: {
      label: 'GRASAS',
      actual: totalGrasas,
      objetivo: objetivos?.grasas_objetivo ?? 0,
    },
  };

  const semana = useMemo(() => getSemanaMovil(fecha), [fecha]);

  const avanzarDia = useCallback(() => {
    cambiarFecha(agregarDiasIso(fecha, 1));
  }, [fecha, cambiarFecha]);

  const retrocederDia = useCallback(() => {
    cambiarFecha(agregarDiasIso(fecha, -1));
  }, [fecha, cambiarFecha]);

  const avanzarSemana = useCallback(() => {
    cambiarFecha(agregarDiasIso(fecha, 7));
  }, [fecha, cambiarFecha]);

  const retrocederSemana = useCallback(() => {
    cambiarFecha(agregarDiasIso(fecha, -7));
  }, [fecha, cambiarFecha]);

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
      setComidasData(data);
      const ids = data.map((c) => c.mealId);
      setOrdenIds(ids);
      if (user?.id) void guardarOrdenComidas(user.id, fecha, ids);
      const lid = resumen?.logId;
      if (lid) void nutricionService.actualizarOrdenComidas(lid, ids).catch(() => {});
    },
    [user?.id, fecha, resumen?.logId],
  );

  const cerrarMenu = useCallback(() => setMenuMealId(null), []);

  const mealDelMenu = useMemo(
    () => comidasData.find((m) => m.mealId === menuMealId) ?? null,
    [comidasData, menuMealId],
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

  const renderHeader = useCallback(() => {
    return (
      <>
        <View style={styles.weekCalendarRow}>
          <Pressable onPress={retrocederSemana} hitSlop={8} style={styles.weekArrow}>
            <Ionicons name="chevron-back" size={20} color={c.textSecondary} />
          </Pressable>

          <View style={styles.weekCalendarGestureWrap}>
            <GestureDetector gesture={swipeCalendario}>
              <View style={styles.weekCalendar}>
                {semana.map((d, index) => (
                  <Pressable
                    key={`${d.key}-${d.fechaIso}-${index}`}
                    style={[styles.dayItem, d.activo && styles.dayItemActive]}
                    onPress={() => cambiarFecha(d.fechaIso)}
                  >
                    <Text style={[styles.dayLetter, d.activo && styles.dayLetterActive]}>{d.key}</Text>
                    <Text style={[styles.dayNumber, d.activo && styles.dayNumberActive]}>{d.dia}</Text>
                  </Pressable>
                ))}
              </View>
            </GestureDetector>
          </View>

          <Pressable onPress={avanzarSemana} hitSlop={8} style={styles.weekArrow}>
            <Ionicons name="chevron-forward" size={20} color={c.textSecondary} />
          </Pressable>
        </View>

        <View style={[styles.summaryCard, styles.summaryCardBelowCalendar]}>
          <View style={styles.summaryTop}>
            <Text style={styles.summaryValue}>
              {Math.round(totalCalorias)}
              <Text style={styles.summaryUnit}> KCAL</Text>
            </Text>
            <Text style={styles.summaryGoal}>{fechaLabel.toUpperCase()}</Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progresoCalorias * 100}%` }]} />
          </View>

          <Text style={styles.summaryGoal}>OBJETIVO: {Math.round(objetivoCalorias)} KCAL</Text>

          {(['proteinas', 'carbos', 'grasas'] as MacroKey[]).map((macro) => {
            const data = macros[macro];
            const porcentaje = data.objetivo > 0 ? Math.min(1, data.actual / data.objetivo) : 0;
            return (
              <View key={macro} style={styles.macroRow}>
                <Text style={styles.macroLabel}>{data.label}</Text>
                <Text style={styles.macroValue}>
                  {Math.round(data.actual)} / {Math.round(data.objetivo)}g
                </Text>
                <View style={styles.macroTrack}>
                  <View style={[styles.macroFill, { width: `${porcentaje * 100}%` }]} />
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>COMIDAS DEL DIA</Text>
      </>
    );
  }, [
    swipeCalendario,
    semana,
    styles,
    cambiarFecha,
    retrocederSemana,
    avanzarSemana,
    c.textSecondary,
    totalCalorias,
    fechaLabel,
    progresoCalorias,
    objetivoCalorias,
    macros,
  ]);

  const renderItem = useCallback(
    ({ item: meal, drag, isActive }: { item: ComidaConAlimentos; drag: () => void; isActive: boolean }) => {
      const logId = resumen?.logId;

      const leftActions = () => (
        <View style={styles.swipeLeft}>
          <View style={styles.swipeDeleteInner}>
            <Text style={styles.swipeDeleteTxt}>Eliminar</Text>
          </View>
        </View>
      );

      return (
        <ScaleDecorator>
          <Swipeable
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
                <Pressable onLongPress={drag} delayLongPress={220} style={styles.dragHandle} hitSlop={8}>
                  <Text style={styles.dragHandleText}>≡</Text>
                </Pressable>
                <View style={styles.mealHeaderText}>
                  <Text style={styles.mealTitle}>{meal.nombre}</Text>
                  <Text style={styles.mealMeta}>
                    {Math.round(meal.totalCalorias)} KCAL · {Math.round(meal.totalProteinas)}P |{' '}
                    {Math.round(meal.totalCarbos)}C | {Math.round(meal.totalGrasas)}G
                  </Text>
                </View>
                <Pressable
                  style={styles.menuDots}
                  onPress={() => setMenuMealId(meal.mealId)}
                  hitSlop={10}
                >
                  <Text style={styles.menuDotsText}>⋮</Text>
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
                        <View style={styles.foodMain}>
                          <Text style={styles.foodName}>{item.food?.nombre ?? 'Alimento'}</Text>
                          <Text style={styles.foodMeta}>
                            {Math.round(item.gramos)}g · {Math.round(item.calorias_calculadas)} kcal
                          </Text>
                        </View>
                        <Text style={styles.foodMacros}>
                          {Math.round(item.proteinas_calculadas)}P / {Math.round(item.carbos_calculados)}C /{' '}
                          {Math.round(item.grasas_calculadas)}G
                        </Text>
                      </View>
                    </Swipeable>
                  );
                })}
                {meal.items.length === 0 && (
                  <Text style={styles.emptyMealText}>Todavia no hay alimentos en esta comida.</Text>
                )}
              </View>

              <View style={styles.actionsRow}>
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

                <View style={styles.queryBox}>
                  <TextInput
                    placeholder="Consulta tus dudas aquí"
                    placeholderTextColor={c.textMuted}
                    style={styles.queryInput}
                    editable={false}
                  />
                </View>
              </View>
            </View>
          </Swipeable>
        </ScaleDecorator>
      );
    },
    [styles, resumen?.logId, eliminarComidaDelLog, eliminarAlimento, fecha, c.textMuted],
  );

  const renderFooter = useCallback(() => {
    return (
      <View style={styles.footerBlock}>
        <Pressable style={styles.addMealBtn} onPress={() => setModalNuevaComida(true)}>
          <Text style={styles.addMealBtnText}>Añadir comida</Text>
        </Pressable>
      </View>
    );
  }, [styles]);

  return (
    <View style={styles.root}>
      {cargando && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={c.primary} />
        </View>
      )}

      <DraggableFlatList
        data={comidasData}
        keyExtractor={(item) => item.mealId}
        onDragEnd={onDragEnd}
        activationDistance={12}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        containerStyle={styles.listContainer}
      />

      {comidasData.length === 0 && !cargando && (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <Text style={styles.emptyMealText}>No hay comidas registradas para este dia.</Text>
        </View>
      )}

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

      <Modal visible={!!menuMealId} transparent animationType="fade" onRequestClose={cerrarMenu}>
        <Pressable style={styles.modalOverlay} onPress={cerrarMenu}>
          <Pressable style={styles.menuCard} onPress={(e) => e.stopPropagation()}>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                if (mealDelMenu) copiarDesdeComida(mealDelMenu.items);
                cerrarMenu();
              }}
            >
              <Text style={styles.menuRowText}>Copiar comida</Text>
            </Pressable>
            <Pressable
              style={[styles.menuRow, !tieneCopia && styles.menuRowDisabled]}
              disabled={!tieneCopia || !mealDelMenu}
              onPress={() => {
                void (async () => {
                  if (!mealDelMenu || !lineas?.length) {
                    cerrarMenu();
                    return;
                  }
                  try {
                    await pegarAlimentosEnComida(mealDelMenu.mealId, lineas);
                    limpiarPortapapeles();
                  } catch (e) {
                    console.error('[Nutricion] pegar comida', e);
                  } finally {
                    cerrarMenu();
                  }
                })();
              }}
            >
              <Text style={[styles.menuRowText, !tieneCopia && styles.menuRowTextDisabled]}>Pegar comida</Text>
            </Pressable>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                if (mealDelMenu) void vaciarComida(mealDelMenu.mealId);
                cerrarMenu();
              }}
            >
              <Text style={[styles.menuRowText, styles.menuRowDanger]}>Limpiar comida</Text>
            </Pressable>
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
      paddingHorizontal: s.lg,
      paddingTop: s.xl,
      paddingBottom: s['3xl'],
      gap: s.sm,
    },
    loadingOverlay: {
      position: 'absolute',
      top: 12,
      right: 20,
      zIndex: 10,
    },
    weekCalendarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.xs,
    },
    weekCalendarGestureWrap: {
      flex: 1,
      minWidth: 0,
    },
    weekArrow: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weekCalendar: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.lg,
      backgroundColor: c.surface,
      paddingHorizontal: s.xs,
      paddingVertical: s.sm,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    dayItem: {
      width: 30,
      paddingVertical: s.xs,
      borderRadius: r.pill,
      alignItems: 'center',
      gap: 2,
    },
    dayItemActive: {
      backgroundColor: c.textDisplay,
    },
    dayLetter: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.7,
    },
    dayLetterActive: {
      color: c.background,
    },
    dayNumber: {
      ...ts.caption,
      fontFamily: f.monoBold,
      color: c.textDisplay,
    },
    dayNumberActive: {
      color: c.background,
    },
    summaryCard: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.lg,
      backgroundColor: c.surface,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
      gap: s.sm,
    },
    summaryCardBelowCalendar: {
      marginTop: s.lg,
    },
    summaryTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    summaryValue: {
      ...ts.heading,
      fontFamily: f.sansBold,
      color: c.textDisplay,
    },
    summaryUnit: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textSecondary,
    },
    summaryGoal: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.7,
    },
    progressTrack: {
      height: 7,
      backgroundColor: c.primaryBg,
      borderRadius: r.pill,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: c.primary,
      borderRadius: r.pill,
    },
    macroRow: {
      gap: s.xs,
    },
    macroLabel: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: ts.label.letterSpacing,
    },
    macroValue: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.text,
    },
    macroTrack: {
      height: 6,
      backgroundColor: c.separator,
      borderRadius: r.pill,
      overflow: 'hidden',
    },
    macroFill: {
      height: '100%',
      backgroundColor: c.primary,
      borderRadius: r.pill,
    },
    sectionTitle: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: ts.label.letterSpacing,
      marginTop: s.sm,
    },
    mealCard: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      backgroundColor: c.surface,
      paddingHorizontal: s.md,
      paddingVertical: s.md,
      gap: s.md,
    },
    mealCardActive: {
      opacity: 0.92,
    },
    mealHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: s.sm,
    },
    dragHandle: {
      paddingVertical: 2,
      paddingHorizontal: 4,
    },
    dragHandleText: {
      ...ts.subheading,
      fontFamily: f.mono,
      color: c.textMuted,
    },
    mealHeaderText: {
      flex: 1,
      gap: s.xs,
    },
    menuDots: {
      padding: 4,
    },
    menuDotsText: {
      ...ts.subheading,
      fontFamily: f.monoBold,
      color: c.textDisplay,
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
      borderRadius: r.md,
      flex: 1,
      marginVertical: 2,
    },
    swipeDeleteTxt: {
      ...ts.label,
      fontFamily: f.monoBold,
      color: '#fff',
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
      borderRadius: r.md,
      flex: 1,
      marginVertical: 2,
    },
    mealItemsList: {
      gap: s.sm,
    },
    foodRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: s.md,
      backgroundColor: c.surface,
    },
    foodMain: {
      flex: 1,
    },
    mealTitle: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    mealMeta: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textMuted,
      letterSpacing: 0.4,
    },
    foodName: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    foodMeta: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textMuted,
    },
    foodMacros: {
      ...ts.caption,
      fontFamily: f.monoBold,
      color: c.primary,
    },
    emptyMealText: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textMuted,
    },
    emptyOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: s.xl,
      top: '45%',
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
      marginTop: s.xs,
    },
    addBtn: {
      width: '30%',
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surfaceElevated,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBtnText: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textDisplay,
      letterSpacing: 0.8,
      fontSize: 12,
    },
    queryBox: {
      width: '70%',
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surfaceElevated,
      height: 42,
      justifyContent: 'center',
      paddingHorizontal: s.md,
    },
    queryInput: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.text,
    },
    footerBlock: {
      marginTop: s.md,
      marginBottom: s.lg,
    },
    addMealBtn: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      backgroundColor: c.surfaceElevated,
      paddingVertical: s.md,
      alignItems: 'center',
    },
    addMealBtnDisabled: {
      opacity: 0.45,
    },
    addMealBtnText: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.primary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      paddingHorizontal: s.xl,
    },
    modalCard: {
      backgroundColor: c.surface,
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.borderVisible,
      padding: s.lg,
      gap: s.md,
    },
    modalTitle: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    modalInput: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.text,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      paddingHorizontal: s.md,
      paddingVertical: s.sm,
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
      backgroundColor: c.primary,
      borderRadius: r.md,
    },
    modalBtnPrimaryText: {
      ...ts.bodySm,
      fontFamily: f.sansBold,
      color: c.background,
    },
    menuCard: {
      backgroundColor: c.surface,
      borderRadius: r.lg,
      borderWidth: 1,
      borderColor: c.borderVisible,
      overflow: 'hidden',
      alignSelf: 'center',
      minWidth: 220,
    },
    menuRow: {
      paddingVertical: s.md,
      paddingHorizontal: s.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    menuRowDisabled: {
      opacity: 0.4,
    },
    menuRowText: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.text,
    },
    menuRowTextDisabled: {
      color: c.textMuted,
    },
    menuRowDanger: {
      color: c.danger,
    },
  });
}
