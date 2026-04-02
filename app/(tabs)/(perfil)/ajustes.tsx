/**
 * PANTALLA: Ajustes
 *
 * Preferencias generales de la app.
 *
 * Opciones:
 *   - Tema: claro / oscuro / sistema
 *   - Unidades: kg/cm o lb/in
 *   - Notificaciones: recordatorio de log diario (hora)
 *   - Cambiar contraseña (redirige a Supabase Auth)
 *   - Eliminar cuenta (acción destructiva con confirmación)
 *
 * Nota: Los ajustes de unidades y tema se guardan en AsyncStorage
 * (no en Supabase, ya que son preferencias locales del dispositivo).
 */

import { Text, View, StyleSheet } from 'react-native';

export default function Ajustes() {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Ajustes</Text>

      {/* TODO: Selector de tema (claro/oscuro/sistema) */}
      {/* TODO: Selector de unidades (kg/cm o lb/in) */}
      {/* TODO: Toggle notificación recordatorio diario */}
      {/* TODO: Opción "Cambiar contraseña" */}
      {/* TODO: Opción "Eliminar cuenta" (con confirmación) */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 24 },
});
