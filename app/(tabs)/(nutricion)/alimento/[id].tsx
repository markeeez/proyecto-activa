/**
 * PANTALLA: Detalle de alimento
 *
 * Muestra la información nutricional completa de un alimento
 * por 100g y según la cantidad que el usuario haya consumido.
 *
 * Params de ruta:
 *   - id: uuid  → foods.id
 *
 * Datos que necesita:
 *   - foods (por id)
 *   - Opcionalmente: el nutrition_log_item si viene desde el log
 *
 * Muestra:
 *   - Nombre del alimento
 *   - Calorías / 100g y calorías totales según gramos
 *   - Tabla de macros: proteínas, carbos, grasas, fibra, azúcar
 *   - Fuente del alimento (api_source o "personalizado")
 *
 * Acciones:
 *   - alimentos.service.ts → obtenerAlimento(id)
 *   - Botón para editar gramos si viene de un log_item
 */

import { Text, View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function DetalleAlimento() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Detalle alimento</Text>
      <Text style={styles.id}>ID: {id}</Text>

      {/* TODO: Nombre y fuente del alimento */}
      {/* TODO: Selector de cantidad (gramos) */}
      {/* TODO: Tabla de macros calculados */}
      {/* TODO: Macros por 100g */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  id: { fontSize: 12, color: '#999' },
});
