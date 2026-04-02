/**
 * COMPONENTE: FilaSerie
 *
 * Fila editable para una serie dentro de un ejercicio.
 * Permite registrar peso, reps y marcar como completada.
 *
 * Props:
 *   - serie: WorkoutSet
 *   - modoActivo: boolean  → si false, solo lectura
 *   - onChange: (datos: Partial<WorkoutSet>) => void
 *   - onEliminar: () => void
 *
 * Diseño previsto (3 columnas):
 *   [Serie nº]  [Peso kg]  [Reps]  [✓ Completar]
 *
 * TODO: inputs numéricos con teclado numérico
 * TODO: animación al marcar como completada
 * TODO: soporte bodyweight (sin campo de peso)
 */

import { Text, View, StyleSheet } from 'react-native';
import type { WorkoutSet } from '@/types/database.types';

interface FilaSerieProps {
  serie: WorkoutSet;
  modoActivo?: boolean;
  onChange?: (datos: Partial<WorkoutSet>) => void;
  onEliminar?: () => void;
}

export function FilaSerie({ serie, modoActivo = false }: FilaSerieProps) {
  return (
    <View style={[styles.fila, serie.completada && styles.completada]}>
      <Text style={styles.numero}>{serie.numero_serie}</Text>
      <Text style={styles.dato}>
        {serie.tipo_peso === 'bodyweight' ? 'BW' : `${serie.peso_kg ?? '-'} kg`}
      </Text>
      <Text style={styles.dato}>{serie.repeticiones ?? '-'} reps</Text>
      {/* TODO: Checkbox "completar" si modoActivo */}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 16,
  },
  completada: { opacity: 0.6 },
  numero: { width: 24, fontSize: 13, color: '#6B7280', fontWeight: '600' },
  dato: { flex: 1, fontSize: 14, color: '#111827' },
});
