import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, Swipeable } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { SortableMealList } from '@/components/SortableMealList';

import { useComidaPortapapeles } from '@/context/ComidaPortapapelesContext';
import { useAuth } from '@/hooks/useAuth';
import { useNutricion } from '@/hooks/useNutricion';
import { useTheme } from '@/hooks/useTheme';
import { agregarDiasIso, esDiaPasadoVsHoy, getSemanaMovil, parseFechaLocal } from '@/lib/fechaNutricion';
import { guardarOrdenComidas, obtenerOrdenComidas } from '@/lib/nutricionLogPreferencias';
import { nutricionService } from '@/services/nutricion.service';
import type { ComidaConAlimentos } from '@/types/app.types';

type MacroKey = 'proteinas' | 'carbos' | 'grasas';

const GAUGE_SIZE = 148;
const GAUGE_STROKE = 9;
const GAUGE_RADIUS = (GAUGE_SIZE - GAUGE_STROKE) / 2;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;
const GAUGE_ARC = GAUGE_CIRCUMFERENCE * 0.78;

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
    vaciarComida,
    eliminarComidaDelLog,
    crearComidaPersonalizada,
    pegarAlimentosEnComida,
    eliminarAlimento,
  } = useNutricion();
  const { copiarDesdeComida, tieneCopia, lineas, limpiarPortapapeles } = useComidaPortapapeles();

  const styles = useMemo(() => makeStyles(c, f, ts, s, r), [c, f, ts, s, r]);

  const [ordenIds, setOrdenIds] = useState<string[] | null>(null);
  // dragOverride: orden optimista durante/después de un drag. Se limpia cuando llegan datos frescos.
  const [dragOverride, setDragOverride] = useState<ComidaConAlimentos[] | null>(null);
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

  // comidasData: usa el override del drag si existe, si no la lista ordenada del servidor.
  // Esto evita el render extra que causaba que los macros aparecieran antes que las comidas.
  const comidasData = dragOverride ?? listaOrdenada;

  // Limpiar el override cuando llegan datos frescos del servidor.
  useEffect(() => {
    setDragOverride(null);
  }, [resumen]);

  const fechaLabel = useMemo(() => {
    const d = parseFechaLocal(fecha);
    return d.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: 'short',
    });
  }, [fecha]);

  // true mientras se cargan datos de un día nuevo (resumen aún no corresponde a `fecha`)
  const cargandoDia = cargando && !resumen;

  const objetivoCalorias = objetivos?.calorias_objetivo ?? 2000;
  const totalCalorias = resumen?.totalCalorias ?? 0;
  const totalProteinas = resumen?.totalProteinas ?? 0;
  const totalCarbos = resumen?.totalCarbos ?? 0;
  const totalGrasas = resumen?.totalGrasas ?? 0;
  const progresoCalorias = Math.min(1, totalCalorias / Math.max(1, objetivoCalorias));
  const caloriasRestantes = Math.max(0, objetivoCalorias - totalCalorias);
  const progresoRestante = Math.min(1, caloriasRestantes / Math.max(1, objetivoCalorias));

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
    const gaugeProgress = Math.max(0.03, progresoRestante);

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

        <View style={styles.dateSelectorRow}>
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

          <Pressable onPress={avanzarSemana} hitSlop={8} style={styles.calendarButton}>
            <Ionicons name="calendar-outline" size={21} color={c.textSecondary} />
          </Pressable>
        </View>

        <View style={[styles.summaryCard, styles.summaryCardBelowCalendar, cargandoDia && styles.summaryCardCargando]}>
          <View style={styles.summaryContent}>
            <View style={styles.kcalPanel}>
              <View style={styles.gaugeWrap}>
                <Svg width={GAUGE_SIZE} height={GAUGE_SIZE} viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}>
                  <Circle
                    cx={GAUGE_SIZE / 2}
                    cy={GAUGE_SIZE / 2}
                    r={GAUGE_RADIUS}
                    stroke={c.border}
                    strokeWidth={GAUGE_STROKE}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${GAUGE_ARC} ${GAUGE_CIRCUMFERENCE}`}
                    transform={`rotate(140 ${GAUGE_SIZE / 2} ${GAUGE_SIZE / 2})`}
                  />
                  <Circle
                    cx={GAUGE_SIZE / 2}
                    cy={GAUGE_SIZE / 2}
                    r={GAUGE_RADIUS}
                    stroke={c.primary}
                    strokeWidth={GAUGE_STROKE}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${GAUGE_ARC * gaugeProgress} ${GAUGE_CIRCUMFERENCE}`}
                    transform={`rotate(140 ${GAUGE_SIZE / 2} ${GAUGE_SIZE / 2})`}
                  />
                  <Circle
                    cx={GAUGE_SIZE / 2}
                    cy={GAUGE_SIZE / 2}
                    r={GAUGE_RADIUS - 16}
                    stroke={c.border}
                    strokeWidth={GAUGE_STROKE}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${GAUGE_ARC * 0.92} ${GAUGE_CIRCUMFERENCE}`}
                    transform={`rotate(150 ${GAUGE_SIZE / 2} ${GAUGE_SIZE / 2})`}
                    opacity={0.45}
                  />
                </Svg>

                <View style={styles.gaugeCenter}>
                  <Text style={styles.gaugeValue}>{Math.round(totalCalorias)}</Text>
                  <Text style={styles.gaugeUnit}>kcal</Text>
                  <Text style={styles.gaugeOf}>consumidas</Text>
                  <Text style={styles.gaugeOf}>de {Math.round(objetivoCalorias)} kcal</Text>
                </View>
              </View>

              <View style={styles.remainingBadge}>
                <Text style={styles.remainingText}>{Math.round(caloriasRestantes)} kcal restantes</Text>
              </View>
            </View>

            <View style={styles.macrosPanel}>
              <View style={styles.goalBlock}>
                <Text style={styles.summaryEyebrow}>OBJETIVO DIARIO</Text>
                <Text style={styles.summaryValue}>
                  {Math.round(objetivoCalorias)} <Text style={styles.summaryUnit}>kcal</Text>
                </Text>
              </View>

              {(['proteinas', 'carbos', 'grasas'] as MacroKey[]).map((macro) => {
                const data = macros[macro];
                const porcentaje = data.objetivo > 0 ? Math.min(1, data.actual / data.objetivo) : 0;
                const macroColor = macro === 'proteinas' ? c.primary : macro === 'carbos' ? c.success : c.macroFat;
                const macroIcon = macro === 'proteinas' ? 'pulse-outline' : macro === 'carbos' ? 'leaf-outline' : 'flame-outline';
                const macroLabel = macro === 'proteinas' ? 'Proteínas' : macro === 'carbos' ? 'Carbohidratos' : 'Grasas';
                return (
                  <View key={macro} style={styles.macroRow}>
                    <View style={[styles.macroIcon, { backgroundColor: macroColor }]}>
                      <Ionicons name={macroIcon} size={16} color={c.textOnPrimary} />
                    </View>
                    <View style={styles.macroBody}>
                      <View style={styles.macroHeader}>
                        <Text style={styles.macroLabel}>{macroLabel}</Text>
                        <Text style={styles.macroValue}>
                          {Math.round(data.actual)} / {Math.round(data.objetivo)} g
                        </Text>
                      </View>
                      <View style={styles.macroTrack}>
                        <View style={[styles.macroFill, { width: `${porcentaje * 100}%`, backgroundColor: macroColor }]} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {cargandoDia && <Text style={styles.loadingInline}>[CARGANDO...]</Text>}
        </View>

        <Text style={styles.sectionTitle}>COMIDAS DEL DIA</Text>

        {cargandoDia && <Text style={styles.loadingInline}>[CARGANDO...]</Text>}
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
    c.textDisplay,
    c.textOnPrimary,
    c.primary,
    c.success,
    c.macroFat,
    c.border,
    totalCalorias,
    caloriasRestantes,
    objetivoCalorias,
    macros,
    cargandoDia,
    progresoRestante,
  ]);

  const renderItem = useCallback(
    ({ item: meal, drag, isActive }: { item: ComidaConAlimentos; drag: () => void; isActive: boolean; }) => {
      const logId = resumen?.logId;
      const nombreLower = meal.nombre.toLowerCase();
      const mealIcon =
        nombreLower.includes('desayuno') ? 'sunny-outline' :
        nombreLower.includes('almuerzo') ? 'partly-sunny-outline' :
        nombreLower.includes('merienda') ? 'cafe-outline' :
        nombreLower.includes('cena') ? 'moon-outline' :
        'restaurant-outline';

      const leftActions = () => (
        <View style={styles.swipeLeft}>
          <View style={styles.swipeDeleteInner}>
            <Text style={styles.swipeDeleteTxt}>Eliminar</Text>
          </View>
        </View>
      );

      return (
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
                  <Text style={styles.mealTitle}>{meal.nombre}</Text>
                  <Text style={styles.mealMeta}>
                    {Math.round(meal.totalProteinas)}P | {Math.round(meal.totalCarbos)}C |{' '}
                    {Math.round(meal.totalGrasas)}G
                  </Text>
                </View>

                <View style={styles.mealRight}>
                  <Text style={styles.mealKcal}>{Math.round(meal.totalCalorias)} KCAL</Text>
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
                            {Math.round(item.gramos)}G / {Math.round(item.calorias_calculadas)} KCAL
                          </Text>
                        </View>
                        <Text style={styles.foodMacros}>
                          {Math.round(item.proteinas_calculadas)}P | {Math.round(item.carbos_calculados)}C |{' '}
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
            </View>
      </Swipeable>
      );
    },
    [styles, resumen?.logId, eliminarComidaDelLog, eliminarAlimento, fecha, c.primary],
  );

  const renderFooter = useCallback(() => {
    return (
      <View style={styles.footerBlock}>
        <View style={styles.adviceCard}>
          <View style={styles.adviceIcon}>
            <Ionicons name="sparkles-outline" size={16} color={c.textSecondary} />
          </View>
          <View style={styles.adviceTextBlock}>
            <Text style={styles.adviceLabel}>CONSEJO DEL DIA</Text>
            <Text style={styles.adviceText}>Intenta alcanzar tu objetivo de proteinas.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
        </View>

        <Pressable style={styles.addMealBtn} onPress={() => setModalNuevaComida(true)}>
          <Text style={styles.addMealBtnText}>Añadir comida</Text>
        </Pressable>
      </View>
    );
  }, [styles, c.textSecondary]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      {cargando && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingInline}>[CARGANDO...]</Text>
        </View>
      )}

      <SortableMealList
        data={comidasData}
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
      paddingHorizontal: s.md,
      paddingBottom: s.xxl,
      gap: s.sm,
    },
    loadingOverlay: {
      position: 'absolute',
      top: s.md,
      right: s.md,
      zIndex: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: r.technical,
      paddingHorizontal: s.sm,
      paddingVertical: s.xs,
    },
    loadingInline: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
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
    dateSelectorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.xs,
    },
    weekCalendarGestureWrap: {
      flex: 1,
      minWidth: 0,
    },
    calendarButton: {
      width: 44,
      height: 58,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.borderVisible,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weekCalendar: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.md,
      backgroundColor: c.surface,
      paddingHorizontal: s.sm,
      paddingVertical: s.xs,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 58,
    },
    dayItem: {
      width: 50,
      paddingVertical: s.xs,
      borderRadius: r.sm,
      alignItems: 'center',
      gap: s.xs,
    },
    dayItemActive: {
      backgroundColor: c.primary,
    },
    dayLetter: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textMuted,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
    },
    dayLetterActive: {
      color: c.textOnPrimary,
    },
    dayNumber: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
    },
    dayNumberActive: {
      color: c.textOnPrimary,
    },
    summaryCard: {
      borderWidth: 1,
      borderColor: c.borderVisible,
      borderRadius: r.lg,
      backgroundColor: c.surface,
      padding: s.md,
    },
    summaryCardCargando: {
      opacity: 0.55,
    },
    summaryCardBelowCalendar: {
      marginTop: s.md,
    },
    summaryContent: {
      flexDirection: 'row',
      gap: s.md,
      alignItems: 'center',
    },
    kcalPanel: {
      width: 166,
      alignItems: 'center',
      gap: s.sm,
    },
    gaugeWrap: {
      width: GAUGE_SIZE,
      height: GAUGE_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gaugeCenter: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    gaugeValue: {
      ...ts.displayMd,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
      lineHeight: 36,
    },
    gaugeUnit: {
      ...ts.caption,
      fontFamily: f.sans,
      color: c.text,
      lineHeight: 16,
    },
    gaugeOf: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      textAlign: 'center',
    },
    remainingBadge: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceElevated,
      borderRadius: r.technical,
      paddingHorizontal: s.md,
      paddingVertical: s.xs,
      alignSelf: 'stretch',
    },
    remainingText: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.primary,
      letterSpacing: 0.9,
      textAlign: 'center',
    },
    macrosPanel: {
      flex: 1,
      gap: s.sm,
      justifyContent: 'center',
    },
    goalBlock: {
      borderBottomWidth: 1,
      borderBottomColor: c.borderVisible,
      paddingBottom: s.sm,
      marginBottom: s.xs,
      gap: s.xs,
    },
    summaryEyebrow: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.primary,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      backgroundColor: c.primaryBg,
      alignSelf: 'flex-start',
      paddingHorizontal: s.xs,
      paddingVertical: 2,
      borderRadius: r.technical,
      overflow: 'hidden',
    },
    summaryValue: {
      ...ts.subheading,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    summaryUnit: {
      ...ts.bodySm,
      fontFamily: f.sans,
      color: c.text,
    },
    macroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
    },
    macroIcon: {
      width: 28,
      height: 28,
      borderRadius: r.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    macroBody: {
      flex: 1,
      gap: s.xs,
    },
    macroHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: s.sm,
    },
    macroLabel: {
      ...ts.caption,
      fontFamily: f.sansMedium,
      color: c.text,
      flexShrink: 1,
    },
    macroValue: {
      ...ts.caption,
      fontFamily: f.mono,
      color: c.textDisplay,
    },
    macroTrack: {
      height: 4,
      backgroundColor: c.border,
      borderRadius: r.technical,
      overflow: 'hidden',
    },
    macroFill: {
      height: '100%',
      backgroundColor: c.borderVisible,
      borderRadius: r.technical,
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
      borderRadius: r.md,
      backgroundColor: c.surface,
      padding: s.sm,
    },
    mealCardActive: {
      borderColor: c.borderVisible,
      backgroundColor: c.surfaceElevated,
    },
    mealHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.md,
    },
    mealIconWrap: {
      width: 50,
      height: 50,
      borderRadius: r.pill,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mealHeaderText: {
      flex: 1,
      gap: s.xs,
    },
    mealRight: {
      alignItems: 'flex-end',
      gap: s.sm,
    },
    mealKcal: {
      ...ts.caption,
      fontFamily: f.mono,
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
      marginLeft: 66,
      marginTop: -18,
    },
    foodRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: s.md,
      backgroundColor: 'transparent',
    },
    foodMain: {
      flex: 1,
    },
    mealTitle: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    mealMeta: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textMuted,
      letterSpacing: 0.9,
      textTransform: 'uppercase',
    },
    foodName: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.text,
    },
    foodMeta: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textMuted,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    foodMacros: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textSecondary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    emptyMealText: {
      ...ts.label,
      fontFamily: f.mono,
      color: c.textMuted,
      letterSpacing: 0.8,
    },
    emptyOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: s.xl,
      top: '45%',
    },
    addBtn: {
      width: 46,
      height: 46,
      borderRadius: r.sm,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBtnText: {
      fontSize: 26,
      lineHeight: 28,
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
      ...ts.caption,
      fontFamily: f.sansMedium,
      color: c.textDisplay,
    },
    adviceText: {
      ...ts.label,
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
    menuCard: {
      backgroundColor: c.surface,
      borderRadius: r.sm,
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
      borderBottomColor: c.border,
    },
    menuRowDisabled: {
      opacity: 0.4,
    },
    menuRowText: {
      ...ts.bodySm,
      fontFamily: f.sansMedium,
      color: c.text,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    menuRowTextDisabled: {
      color: c.textMuted,
    },
    menuRowDanger: {
      color: c.danger,
    },
  });
}
