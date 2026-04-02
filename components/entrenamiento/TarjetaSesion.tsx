/**
 * COMPONENTE: TarjetaSesion
 *
 * Resumen de una sesión de entrenamiento en la lista.
 *
 * Props:
 *   - sesion: WorkoutSession
 *   - numEjercicios?: number
 *   - estaActiva?: boolean   → muestra badge "En curso"
 *   - onPress: () => void    → navega a sesion/[id]
 *
 * TODO: calcular duración desde hora_inicio y hora_fin
 */

import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import type { WorkoutSession } from '@/types/database.types';

interface TarjetaSesionProps {
  sesion: WorkoutSession;
  numEjercicios?: number;
  estaActiva?: boolean;
  onPress: () => void;
}

export function TarjetaSesion({ sesion, numEjercicios = 0, estaActiva = false, onPress }: TarjetaSesionProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.nombre}>{sesion.nombre ?? 'Sesión sin nombre'}</Text>
        {estaActiva && (
          <View style={styles.badgeActiva}>
            <Text style={styles.badgeTexto}>En curso</Text>
          </View>
        )}
      </View>
      <Text style={styles.detalle}>
        {numEjercicios} ejercicio{numEjercicios !== 1 ? 's' : ''}
        {sesion.hora_inicio ? ` · ${sesion.hora_inicio}` : ''}
      </Text>
    </TouchableOpacity>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nombre: { fontSize: 16, fontWeight: '600' },
  detalle: { fontSize: 13, color: '#6B7280', marginTop: 6 },
  badgeActiva: { backgroundColor: '#22C55E20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTexto: { fontSize: 11, color: '#22C55E', fontWeight: '600' },
});
