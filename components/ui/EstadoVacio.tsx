/**
 * COMPONENTE: EstadoVacio
 *
 * Placeholder para listas vacías o estados sin datos.
 *
 * Props:
 *   - titulo: string
 *   - descripcion?: string
 *   - icono?: ReactNode
 *   - accion?: { titulo: string; onPress: () => void }
 */

import { Text, View, StyleSheet } from 'react-native';

interface EstadoVacioProps {
  titulo: string;
  descripcion?: string;
  accion?: { titulo: string; onPress: () => void };
}

export function EstadoVacio({ titulo, descripcion, accion }: EstadoVacioProps) {
  return (
    <View style={styles.container}>
      {/* TODO: icono o ilustración */}
      <Text style={styles.titulo}>{titulo}</Text>
      {descripcion && <Text style={styles.descripcion}>{descripcion}</Text>}
      {/* TODO: botón de acción si se pasa */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  titulo: { fontSize: 17, fontWeight: '600', color: '#374151', textAlign: 'center', marginTop: 12 },
  descripcion: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8 },
});
