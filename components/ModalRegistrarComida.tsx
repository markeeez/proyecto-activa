import { BuscadorAlimentos } from '@/components/nutricion/BuscadorAlimentos';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import { iconoComida } from '@/lib/iconosComida';
import type { Food } from '@/types/database.types';
import type { AlimentoEnLog, ComidaConAlimentos } from '@/types/app.types';

/* ─── Props ────────────────────────────────────────────────────────── */
interface Props {
  visible: boolean;
  onClose: () => void;
  comidas: ComidaConAlimentos[];
  fecha: string;
  cargando: boolean;
  userId?: string;
  eliminarAlimento: (itemId: string) => Promise<void>;
  reemplazarAlimento: (itemId: string, food: Food, gramos: number) => Promise<void>;
  onAgregarAlimento: (mealId: string) => void;
}

/* ─── Componente ───────────────────────────────────────────────────── */
export function ModalRegistrarComida({
  visible,
  onClose,
  comidas,
  fecha: _fecha, // conservado en Props para compatibilidad, no usado en render
  cargando,
  userId,
  eliminarAlimento,
  reemplazarAlimento,
  onAgregarAlimento,
}: Props) {
  const { c, s } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [itemAReemplazar, setItemAReemplazar] = useState<AlimentoEnLog | null>(null);

  // Comida seleccionada: la que marcó el usuario o la primera disponible
  const comidaSeleccionada =
    comidas.find((m) => m.mealId === selectedMealId) ?? comidas[0] ?? null;

  const handleAgregar = useCallback(() => {
    if (!comidaSeleccionada) return;
    onAgregarAlimento(comidaSeleccionada.mealId);
  }, [comidaSeleccionada, onAgregarAlimento]);

  const handleEliminar = useCallback(
    async (itemId: string) => {
      if (eliminandoId) return;
      setEliminandoId(itemId);
      try {
        await eliminarAlimento(itemId);
      } finally {
        setEliminandoId(null);
      }
    },
    [eliminandoId, eliminarAlimento],
  );

  const handleReemplazar = useCallback(
    async (food: Food, gramos: number) => {
      if (!itemAReemplazar) return;
      await reemplazarAlimento(itemAReemplazar.id, food, gramos);
      setItemAReemplazar(null);
    },
    [itemAReemplazar, reemplazarAlimento],
  );
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
    closeBtn: {
      padding: 4,
    },
    subtitle: {
      fontSize: 13,
      color: c.textSecondary,
      paddingHorizontal: s.md,
      marginBottom: s.sm,
    },
    /* Tabs de comidas */
    mealTabsScroll: {
      flexGrow: 0,
      flexShrink: 0,
      height: 86,
      maxHeight: 86,
    },
    mealTab: {
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      minWidth: 72,
      height: 76,
      justifyContent: 'center',
    },
    mealTabLabel: {
      fontSize: 11,
      textAlign: 'center',
    },
    /* Separador */
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginHorizontal: s.md,
      marginVertical: s.sm,
    },
    /* Info de comida seleccionada */
    mealInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: s.md,
      marginBottom: 4,
    },
    mealNombre: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: c.textDisplay,
      marginRight: s.sm,
    },
    mealKcal: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textSecondary,
    },
    metricsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      flexWrap: 'nowrap',
      gap: 6,
      flexShrink: 0,
    },
    totalMetrics: {
      marginRight: s.sm * 2 + 16,
    },
    totalLabel: {
      fontSize: 12,
      lineHeight: 15,
      fontWeight: '600',
      color: c.textSecondary,
    },
    macroMetric: {
      fontSize: 12,
      lineHeight: 15,
      fontWeight: '700',
    },
    macroProtein: {
      color: c.primary,
    },
    macroCarbs: {
      color: c.success,
    },
    macroFat: {
      color: c.macroFat,
    },
    /* Lista de alimentos */
    itemsWrap: {
      flex: 1,
      minHeight: 0,
      marginHorizontal: s.md,
      borderRadius: 10,
      backgroundColor: c.surfaceElevated,
      overflow: 'hidden',
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: s.sm,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    itemNombre: {
      flex: 1,
      fontSize: 14,
      color: c.textDisplay,
      marginRight: s.sm,
    },
    itemMetrics: {
      marginRight: s.sm,
    },
    emptyTxt: {
      flex: 1,
      fontSize: 13,
      color: c.textMuted,
      textAlign: 'center',
      textAlignVertical: 'center',
      paddingHorizontal: s.md,
    },
    /* Botón añadir */
    addBtn: {
      marginHorizontal: s.md,
      marginTop: s.md,
      flexShrink: 0,
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    addBtnTxt: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Buscador para reemplazar un item */}
      <BuscadorAlimentos
        visible={itemAReemplazar !== null}
        onClose={() => setItemAReemplazar(null)}
        onAlimentoSeleccionado={handleReemplazar}
        userId={userId}
      />

      {/* Toca fuera → cierra */}
      <Pressable style={st.overlay} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={st.sheet}>
            {/* Handle */}
            <View style={st.handle} />

            {/* Header */}
            <View style={st.header}>
              <Text style={st.headerTitle}>Registrar comida</Text>
              <Pressable style={st.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={22} color={c.textMuted} />
              </Pressable>
            </View>

            <Text style={st.subtitle}>¿En qué comida quieres registrar?</Text>

            {/* ── Tabs de comidas (scroll horizontal) ── */}
            {cargando && comidas.length === 0 ? (
              <ActivityIndicator color={c.primary} style={{ marginVertical: s.md }} />
            ) : (
              <ScrollView
                horizontal
                style={st.mealTabsScroll}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: s.md, gap: 8, paddingBottom: 4 }}
              >
                {comidas.map((meal) => {
                  const selected = meal.mealId === comidaSeleccionada?.mealId;
                  return (
                    <Pressable
                      key={meal.mealId}
                      style={[
                        st.mealTab,
                        { backgroundColor: selected ? c.primary : c.surfaceElevated },
                      ]}
                      onPress={() => setSelectedMealId(meal.mealId)}
                    >
                      <Ionicons
                        name={iconoComida(meal.nombre, meal.isDefault)}
                        size={22}
                        color={selected ? '#fff' : c.textSecondary}
                      />
                      <Text
                        style={[
                          st.mealTabLabel,
                          { color: selected ? '#fff' : c.textDisplay },
                        ]}
                        numberOfLines={2}
                      >
                        {meal.nombre}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <View style={st.divider} />

            {/* ── Info de la comida seleccionada ── */}
            {comidaSeleccionada && (
              <>
                <View style={st.mealInfoRow}>
                  <Text style={st.mealNombre} numberOfLines={1}>
                    {comidaSeleccionada.nombre}
                  </Text>
                  <View style={[st.metricsRow, st.totalMetrics]}>
                    <Text style={[st.macroMetric, st.macroProtein]}>
                      {Math.round(comidaSeleccionada.totalProteinas)}P
                    </Text>
                    <Text style={[st.macroMetric, st.macroCarbs]}>
                      {Math.round(comidaSeleccionada.totalCarbos)}C
                    </Text>
                    <Text style={[st.macroMetric, st.macroFat]}>
                      {Math.round(comidaSeleccionada.totalGrasas)}G
                    </Text>
                    <Text style={st.mealKcal}>
                      {Math.round(comidaSeleccionada.totalCalorias)} kcal
                    </Text>
                  </View>
                </View>

                {/* Lista de alimentos */}
                <View style={st.itemsWrap}>
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={comidaSeleccionada.items.length === 0 ? { flexGrow: 1 } : undefined}
                  >
                    {comidaSeleccionada.items.length === 0 ? (
                      <Text style={st.emptyTxt}>Todavía no hay alimentos en esta comida.</Text>
                    ) : (
                      comidaSeleccionada.items.map((item) => (
                        <Pressable
                          key={item.id}
                          style={st.itemRow}
                          onPress={() => setItemAReemplazar(item)}
                        >
                          <Text style={st.itemNombre} numberOfLines={1}>
                            {item.food.nombre}
                          </Text>
                          <View style={[st.metricsRow, st.itemMetrics]}>
                            <Text style={[st.macroMetric, st.macroProtein]}>
                              {Math.round(item.proteinas_calculadas)}P
                            </Text>
                            <Text style={[st.macroMetric, st.macroCarbs]}>
                              {Math.round(item.carbos_calculados)}C
                            </Text>
                            <Text style={[st.macroMetric, st.macroFat]}>
                              {Math.round(item.grasas_calculadas)}G
                            </Text>
                            <Text style={st.mealKcal}>
                              {Math.round(item.calorias_calculadas)} kcal
                            </Text>
                          </View>
                          <Pressable
                            onPress={(e) => { e.stopPropagation(); void handleEliminar(item.id); }}
                            hitSlop={8}
                            disabled={eliminandoId === item.id}
                          >
                            {eliminandoId === item.id ? (
                              <ActivityIndicator size="small" color={c.danger} />
                            ) : (
                              <Ionicons name="trash-outline" size={16} color={c.danger} />
                            )}
                          </Pressable>
                        </Pressable>
                      ))
                    )}
                  </ScrollView>
                </View>
              </>
            )}

            {/* ── Botón añadir alimento ── */}
            <Pressable
              style={[st.addBtn, !comidaSeleccionada && { opacity: 0.5 }]}
              onPress={handleAgregar}
              disabled={!comidaSeleccionada}
            >
              <Text style={st.addBtnTxt}>+ Añadir alimento</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
