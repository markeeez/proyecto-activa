/**
 * PANTALLA: Entrenamiento principal
 *
 * Muestra las sesiones del día actual y acceso al historial.
 * Un usuario puede tener múltiples sesiones en el mismo día.
 *
 * Datos que necesita:
 *   - workout_sessions (filtrado por user_id + fecha hoy)
 *   - workout_session_exercises (para mostrar resumen por sesión)
 *
 * Secciones:
 *   - Sesiones de hoy (lista de <TarjetaSesion />)
 *   - Historial reciente (últimas sesiones)
 *
 * Acciones:
 *   - entrenamiento.service.ts → obtenerSesionesDia(fecha)
 *   - Botón "Nueva sesión" → modal nueva-sesion
 *
 * Navegación:
 *   - → nueva-sesion (modal)
 *   - → sesion/[id]
 */

import { Text, View, StyleSheet } from 'react-native';

export default function EntrenamientoIndex() {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Entrenamiento</Text>

      {/* TODO: Selector de fecha */}
      {/* TODO: Sesiones del día con <TarjetaSesion /> */}
      {/* TODO: Estado vacío si no hay sesiones */}
      {/* TODO: Botón "Nueva sesión" */}
      {/* TODO: Historial reciente (últimas 5 sesiones) */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  titulo: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
});
