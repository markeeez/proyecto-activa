/**
 * PANTALLA: Nueva sesión (modal)
 *
 * Formulario para iniciar una sesión de entrenamiento.
 *
 * Datos que genera:
 *   workout_sessions {
 *     nombre?: string       (ej: "Empuje", "Pierna", "Full Body")
 *     fecha: hoy
 *     hora_inicio: ahora
 *     notas?: string
 *   }
 *
 * Flujo:
 *   1. Usuario rellena nombre (opcional) y notas
 *   2. Se crea la sesión en BD
 *   3. Redirige a sesion/[id] para añadir ejercicios
 *
 * Acciones:
 *   - entrenamiento.service.ts → crearSesion()
 */

import { Text, View, StyleSheet } from 'react-native';

export default function NuevaSesion() {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Nueva sesión</Text>

      {/* TODO: Input nombre de sesión (opcional, placeholder "Sesión X") */}
      {/* TODO: Input notas (opcional) */}
      {/* TODO: Botón "Empezar sesión" */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 24 },
});
