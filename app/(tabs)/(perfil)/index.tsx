/**
 * PANTALLA: Perfil principal
 *
 * Resumen del usuario con acceso a todas las subsecciones.
 *
 * Datos que necesita:
 *   - profiles (del usuario actual)
 *   - user_goals (resumen de objetivos)
 *   - ai_usage (mensajes consumidos este mes)
 *   - plan_limits (del plan del usuario)
 *
 * Secciones:
 *   - Avatar + nombre + username + plan (badge)
 *   - Resumen de objetivos calóricos
 *   - Uso de IA este mes (si plan plus/premium)
 *   - Links: Editar perfil, Mis objetivos, Mi plan, Ajustes
 *   - Botón "Cerrar sesión"
 *
 * Acciones:
 *   - perfil.service.ts → obtenerPerfil()
 *   - auth.service.ts → cerrarSesion()
 */

import { Text, View, StyleSheet } from 'react-native';

export default function PerfilIndex() {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Perfil</Text>

      {/* TODO: Avatar + nombre + username + badge plan */}
      {/* TODO: Resumen objetivos calóricos */}
      {/* TODO: Uso IA este mes (plus/premium) */}
      {/* TODO: Lista de opciones: Editar, Objetivos, Plan, Ajustes */}
      {/* TODO: Botón "Cerrar sesión" */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  titulo: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
});
