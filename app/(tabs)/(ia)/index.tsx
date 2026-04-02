/**
 * PANTALLA: Chat general con IA
 *
 * Conversación libre con el asistente de ACTIVA.
 * Solo disponible para usuarios con plan plus o premium.
 *
 * Datos que necesita:
 *   - ai_chat_sessions (contexto_tipo: 'general', del usuario actual)
 *   - ai_chat_messages (últimos N según plan: ai_mensajes_historial)
 *   - ai_usage (mensajes_mes_actual vs límite del plan)
 *   - plan_limits (del plan del usuario)
 *
 * Comportamiento según plan:
 *   - free: muestra pantalla de upgrade, sin acceso al chat
 *   - plus: acceso con límite de 100 mensajes/mes, historial de 20
 *   - premium: acceso con límite de 1000 mensajes/mes, historial de 50
 *
 * Componentes:
 *   - <BurbujaMensaje rol="user" /> y <BurbujaMensaje rol="assistant" />
 *   - <InputChat /> con botón de enviar
 *   - <BadgePlan /> con mensajes restantes del mes
 *
 * Acciones:
 *   - ia.service.ts → obtenerSesionGeneral()
 *   - ia.service.ts → enviarMensaje(sessionId, contenido)
 *   - ia.service.ts → verificarLimiteMensajes()
 *
 * Nota sobre historial:
 *   El historial enviado a Claude se limita a los últimos N mensajes
 *   según plan, pero en BD se guardan todos para referencia del usuario.
 */

import { Text, View, StyleSheet } from 'react-native';

export default function IAIndex() {
  // TODO: verificar plan → si es free, mostrar pantalla de upgrade

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Asistente</Text>

      {/* TODO: <BadgePlan /> con mensajes restantes */}
      {/* TODO: ScrollView con <BurbujaMensaje /> */}
      {/* TODO: <InputChat /> anclado al fondo */}
      {/* TODO: Estado vacío para primera conversación */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  titulo: { fontSize: 24, fontWeight: 'bold', padding: 16 },
});
