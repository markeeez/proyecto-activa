/**
 * PANTALLA: Mi plan
 *
 * Muestra el plan actual del usuario y las opciones de upgrade.
 *
 * Datos que necesita:
 *   - profiles.plan (plan actual)
 *   - plan_limits (todos los planes para comparativa)
 *   - ai_usage (uso actual del mes)
 *
 * Muestra:
 *   - Plan actual con sus beneficios
 *   - Tabla comparativa free / plus / premium
 *   - Uso de mensajes IA este mes (barra de progreso)
 *   - CTAs de upgrade (si plan < premium)
 *
 * Nota: El cambio de plan se gestiona externamente (pasarela de pago).
 * Esta pantalla es informativa + enlaza a la pasarela.
 *
 * Acciones:
 *   - perfil.service.ts → obtenerPerfil()
 *   - plan_limits → lectura directa (todos los usuarios pueden leer)
 */

import { Text, View, StyleSheet } from 'react-native';

export default function MiPlan() {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Mi plan</Text>

      {/* TODO: Card plan actual (free / plus / premium) */}
      {/* TODO: Uso IA este mes (barra de progreso) */}
      {/* TODO: Tabla comparativa de planes */}
      {/* TODO: Botón "Mejorar a Plus/Premium" → pasarela de pago */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
});
