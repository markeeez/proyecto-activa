/**
 * PANTALLA: Detalle de sesión
 *
 * Vista de una sesión activa o pasada con todos sus ejercicios y series.
 * Es la pantalla más compleja del módulo de entrenamiento.
 *
 * Params de ruta:
 *   - id: uuid  → workout_sessions.id
 *
 * Datos que necesita:
 *   - workout_sessions (por id) → nombre, fecha, hora_inicio/fin, notas
 *   - workout_session_exercises con exercise join → ejercicios en orden
 *   - workout_sets (por session_exercise_id) → series de cada ejercicio
 *
 * Modos:
 *   - Activa (sin hora_fin): permite añadir ejercicios y registrar series
 *   - Finalizada (con hora_fin): solo lectura, muestra resumen
 *
 * Componentes:
 *   - <ItemEjercicio /> por cada ejercicio (con sus <FilaSerie />)
 *   - <TemporizadorDescanso /> (solo en modo activo)
 *
 * Acciones:
 *   - entrenamiento.service.ts → obtenerSesion(id)
 *   - entrenamiento.service.ts → añadirEjercicio(sessionId, exerciseId)
 *   - entrenamiento.service.ts → registrarSerie(sessionExerciseId, datos)
 *   - entrenamiento.service.ts → finalizarSesion(id)
 *
 * Navegación:
 *   - → ejercicio/[id] (para ver detalle de un ejercicio)
 *   - Modal de búsqueda de ejercicio (al añadir)
 */

import { Text, View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function DetalleSesion() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Sesión</Text>
      <Text style={styles.id}>ID: {id}</Text>

      {/* TODO: Header con nombre sesión + hora inicio/fin */}
      {/* TODO: Lista de ejercicios con <ItemEjercicio /> */}
      {/* TODO: <FilaSerie /> dentro de cada ejercicio */}
      {/* TODO: Botón "Añadir ejercicio" (modo activo) */}
      {/* TODO: <TemporizadorDescanso /> (modo activo) */}
      {/* TODO: Botón "Finalizar sesión" (modo activo) */}
      {/* TODO: Resumen de volumen total (modo finalizado) */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  id: { fontSize: 12, color: '#999' },
});
