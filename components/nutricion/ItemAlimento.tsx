/**
 * COMPONENTE: ItemAlimento
 *
 * Fila de alimento en la lista de resultados de búsqueda
 * o dentro de una TarjetaComida.
 *
 * Props:
 *   - alimento: Food
 *   - gramos?: number         → si viene de un log_item
 *   - calorias?: number       → calculadas según gramos
 *   - onPress?: () => void    → navega a detalle o selecciona
 *
 * TODO: dos variantes visuales: buscador vs log
 */

import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import type { Food } from '@/types/database.types';

interface ItemAlimentoProps {
  alimento: Food;
  gramos?: number;
  calorias?: number;
  onPress?: () => void;
}

export function ItemAlimento({ alimento, gramos, calorias, onPress }: ItemAlimentoProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.info}>
        <Text style={styles.nombre} numberOfLines={1}>{alimento.nombre}</Text>
        <Text style={styles.detalle}>
          {gramos ? `${gramos}g · ` : '100g · '}
          {(calorias ?? alimento.calorias).toFixed(0)} kcal
        </Text>
      </View>
      <View style={styles.macros}>
        <Text style={styles.macro}>P {(gramos ? alimento.proteinas * gramos / 100 : alimento.proteinas).toFixed(1)}g</Text>
        <Text style={styles.macro}>C {(gramos ? alimento.carbohidratos * gramos / 100 : alimento.carbohidratos).toFixed(1)}g</Text>
        <Text style={styles.macro}>G {(gramos ? alimento.grasas * gramos / 100 : alimento.grasas).toFixed(1)}g</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', paddingVertical: 12, alignItems: 'center' },
  info: { flex: 1 },
  nombre: { fontSize: 15, fontWeight: '500', color: '#111827' },
  detalle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  macros: { flexDirection: 'row', gap: 8 },
  macro: { fontSize: 11, color: '#9CA3AF' },
});
