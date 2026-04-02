/**
 * SERVICIO DE IA
 *
 * Gestiona las sesiones de chat, mensajes y el control de límites de uso.
 *
 * Nota: Las llamadas a Claude se hacen a través del backend (función de
 * Supabase Edge Function o API propia) para no exponer la API key en el cliente.
 *
 * Tablas: ai_chat_sessions, ai_chat_messages, ai_usage, ai_notes, plan_limits
 */

import { supabase } from '@/lib/supabase';
import type {
  AIChatSession,
  AIChatMessage,
  AIUsage,
  PlanLimit,
  ContextoIA,
  Plan,
} from '@/types/database.types';
import type { MensajeChat } from '@/types/app.types';

export const iaService = {
  // ─── Límites ───────────────────────────────────────────────────────────────

  async obtenerLimitesPlan(plan: Plan): Promise<PlanLimit | null> {
    // TODO: implementar
    // SELECT * FROM plan_limits WHERE plan = plan
    return null;
  },

  async obtenerUsoIA(userId: string): Promise<AIUsage | null> {
    // TODO: implementar
    // SELECT * FROM ai_usage WHERE user_id = userId
    return null;
  },

  /**
   * Verifica si el usuario puede enviar un mensaje.
   * Compara mensajes_mes_actual con el límite de su plan.
   * También resetea el contador si cambió el mes.
   */
  async puedeEnviarMensaje(userId: string, plan: Plan): Promise<boolean> {
    // TODO: implementar
    return false;
  },

  // ─── Sesiones de chat ──────────────────────────────────────────────────────

  /**
   * Obtiene o crea la sesión de chat general del usuario.
   */
  async obtenerSesionGeneral(userId: string): Promise<AIChatSession | null> {
    // TODO: implementar
    // SELECT * FROM ai_chat_sessions
    // WHERE user_id = userId AND contexto_tipo = 'general'
    // ORDER BY updated_at DESC LIMIT 1
    // Si no existe → INSERT
    return null;
  },

  /**
   * Obtiene o crea una sesión de chat contextual.
   * @param contextoTipo - tipo de elemento al que se liga
   * @param contextoId - id del elemento
   */
  async obtenerSesionContextual(
    userId: string,
    contextoTipo: ContextoIA,
    contextoId: string
  ): Promise<AIChatSession | null> {
    // TODO: implementar
    return null;
  },

  // ─── Mensajes ──────────────────────────────────────────────────────────────

  /**
   * Obtiene los mensajes de una sesión, limitados según el plan del usuario.
   * @param limite - número de mensajes históricos permitidos por el plan
   */
  async obtenerMensajes(
    sessionId: string,
    limite: number
  ): Promise<MensajeChat[]> {
    // TODO: implementar
    // SELECT * FROM ai_chat_messages
    // WHERE session_id = sessionId
    // ORDER BY created_at ASC
    // LIMIT limite (aplicado desde el final → los más recientes)
    return [];
  },

  /**
   * Envía un mensaje al asistente y devuelve la respuesta.
   * El mensaje del usuario se guarda antes de llamar a la IA.
   * La respuesta de la IA se guarda al recibirla.
   *
   * IMPORTANTE: La llamada a Claude se hace en el servidor (Edge Function).
   */
  async enviarMensaje(
    sessionId: string,
    userId: string,
    contenido: string,
    historial: MensajeChat[]
  ): Promise<MensajeChat | null> {
    // TODO: implementar
    // 1. INSERT ai_chat_messages { rol: 'user', contenido, session_id }
    // 2. Llamar a Edge Function con { historial, nuevo_mensaje }
    // 3. INSERT ai_chat_messages { rol: 'assistant', contenido: respuesta }
    // 4. UPDATE ai_usage SET mensajes_mes_actual += 1
    // 5. UPDATE ai_chat_sessions SET updated_at = now()
    // 6. Retornar el mensaje del asistente
    return null;
  },
};
