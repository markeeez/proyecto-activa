/**
 * PANTALLA: Detalle de ejercicio
 *
 * Información completa de un ejercicio y su historial del usuario.
 *
 * Params de ruta:
 *   - id: uuid  → exercises.id
 *
 * Datos que necesita:
 *   - exercises (por id) → nombre, musculo_primario, musculos_secundarios,
 *                          categoria, descripcion, is_custom
 *   - workout_sets join session_exercises join sessions
 *     (filtrado por user_id y exercise_id) → historial de series
 *
 * Muestra:
 *   - Nombre y categoría (fuerza, cardio, flexibilidad)
 *   - Músculo primario y secundarios
 *   - Descripción / instrucciones
 *   - Historial de progresión (peso máximo, volumen por sesión)
 *
 * Acciones:
 *   - ejercicios.service.ts → obtenerEjercicio(id)
 *   - ejercicios.service.ts → obtenerHistorialEjercicio(id)
 */

import { Text, View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function DetalleEjercicio() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Ejercicio</Text>
      <Text style={styles.id}>ID: {id}</Text>

      {/* TODO: Nombre, categoría y músculo primario */}
      {/* TODO: Músculos secundarios (badges) */}
      {/* TODO: Descripción */}
      {/* TODO: Historial: tabla de últimas series */}
      {/* TODO: Gráfico de progresión de peso */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  id: { fontSize: 12, color: '#999' },
});
