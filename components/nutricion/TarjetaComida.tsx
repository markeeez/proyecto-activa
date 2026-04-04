/**
 * COMPONENTE: TarjetaComida
 *
 * Muestra una comida del log diario (Desayuno, Almuerzo, etc.)
 * con sus alimentos y totales.
 *
 * Props:
 *   - comida: ComidaConAlimentos
 *   - onAgregarAlimento: () => void → abre modal agregar
 *   - onEliminarAlimento: (itemId: string) => void
 *
 * TODO: swipe to delete en cada <ItemAlimento />
 * TODO: collapsible (expandir/contraer la lista de alimentos)
 */

import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import type { ComidaConAlimentos } from '@/types/app.types';

interface TarjetaComidaProps {
  comida: ComidaConAlimentos;
  onAgregarAlimento: () => void;
  onEliminarAlimento: (itemId: string) => void;
}

export function TarjetaComida({ comida, onAgregarAlimento }: TarjetaComidaProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.nombre}>{comida.nombre}</Text>
        <Text style={styles.calorias}>{comida.totalCalorias.toFixed(0)} kcal</Text>
      </View>

      {/* TODO: lista de <ItemAlimento /> para comida.items */}

      <TouchableOpacity style={styles.botonAgregar} onPress={onAgregarAlimento}>
        <Text style={styles.textoAgregar}>+ Añadir alimento</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  nombre: { fontSize: 16, fontWeight: '600' },
  calorias: { fontSize: 14, color: '#6B7280' },
  botonAgregar: { marginTop: 8, paddingVertical: 8 },
  textoAgregar: { color: '#4F7CFF', fontSize: 14, fontWeight: '500' },
});
