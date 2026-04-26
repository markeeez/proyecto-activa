/**
 * ModalRegistrarComida
 *
 * Bottom sheet que aparece al pulsar "+" en la quick action de "Registrar comida"
 * desde la pantalla Home. Es un atajo directo a la lógica de alimentación:
 *   - Muestra las comidas del día del usuario (scroll horizontal)
 *   - Seleccionada una comida: macros, kcal y lista de alimentos con borrado
 *   - Botón "Añadir alimento" → navega al buscador de alimentos de nutrición
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import type { ComidaConAlimentos } from '@/types/app.types';

/* ─── Iconos por comida predeterminada ────────────────────────────── */
const ICONOS_DEFAULT: Record<string, keyof (typeof Ionicons)['glyphMap']> = {
  desayuno: 'cafe-outline',
  almuerzo: 'sunny-outline',
  merienda: 'restaurant-outline',
  cena: 'moon-outline',
};

function iconoComida(
  nombre: string,
  isDefault: boolean,
): keyof (typeof Ionicons)['glyphMap'] {
  if (!isDefault) return 'nutrition-outline';
  return ICONOS_DEFAULT[nombre.toLowerCase().trim()] ?? 'nutrition-outline';
}

/* ─── Props ────────────────────────────────────────────────────────── */
interface Props {
  visible: boolean;
  onClose: () => void;
  comidas: ComidaConAlimentos[];
  fecha: string;
  cargando: boolean;
  eliminarAlimento: (itemId: string) => Promise<void>;
}

/* ─── Componente ───────────────────────────────────────────────────── */
export function ModalRegistrarComida({
  visible,
  onClose,
  comidas,
  fecha,
  cargando,
  eliminarAlimento,
}: Props) {
  const { c, s } = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  // Comida seleccionada: la que marcó el usuario o la primera disponible
  const comidaSeleccionada =
    comidas.find((m) => m.mealId === selectedMealId) ?? comidas[0] ?? null;

  const handleAgregar = useCallback(() => {
    if (!comidaSeleccionada) return;
    onClose();
    router.push({
      pathname: '/(tabs)/(nutricion)/agregar',
      params: { mealId: comidaSeleccionada.mealId, fecha },
    });
  }, [comidaSeleccionada, fecha, onClose]);

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
    mealTab: {
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      minWidth: 72,
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
      fontSize: 15,
      fontWeight: '600',
      color: c.textDisplay,
    },
    mealKcal: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textDisplay,
    },
    macrosRow: {
      paddingHorizontal: s.md,
      marginBottom: s.sm,
    },
    macrosText: {
      fontSize: 12,
      color: c.textSecondary,
    },
    /* Lista de alimentos */
    itemsWrap: {
      maxHeight: 160,
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
    },
    itemMeta: {
      fontSize: 12,
      color: c.textSecondary,
      marginRight: s.sm,
    },
    emptyTxt: {
      fontSize: 13,
      color: c.textMuted,
      textAlign: 'center',
      paddingVertical: s.md,
    },
    /* Botón añadir */
    addBtn: {
      marginHorizontal: s.md,
      marginTop: s.md,
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
                  <Text style={st.mealNombre}>{comidaSeleccionada.nombre}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={st.macrosText}>
                      {Math.round(comidaSeleccionada.totalProteinas)}P
                      {' / '}
                      {Math.round(comidaSeleccionada.totalCarbos)}C
                      {' / '}
                      {Math.round(comidaSeleccionada.totalGrasas)}G
                    </Text>
                    <Text style={st.mealKcal}>
                      {Math.round(comidaSeleccionada.totalCalorias)} kcal
                    </Text>
                  </View>
                </View>

                {/* Lista de alimentos */}
                <View style={st.itemsWrap}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {comidaSeleccionada.items.length === 0 ? (
                      <Text style={st.emptyTxt}>Todavía no hay alimentos en esta comida.</Text>
                    ) : (
                      comidaSeleccionada.items.map((item) => (
                        <View key={item.id} style={st.itemRow}>
                          <Text style={st.itemNombre} numberOfLines={1}>
                            {item.food.nombre}
                          </Text>
                          <Text style={st.itemMeta}>
                            {item.gramos}g · {Math.round(item.calorias_calculadas)} kcal
                          </Text>
                          <Pressable
                            onPress={() => void handleEliminar(item.id)}
                            hitSlop={8}
                            disabled={eliminandoId === item.id}
                          >
                            {eliminandoId === item.id ? (
                              <ActivityIndicator size="small" color={c.danger} />
                            ) : (
                              <Ionicons name="trash-outline" size={16} color={c.danger} />
                            )}
                          </Pressable>
                        </View>
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
