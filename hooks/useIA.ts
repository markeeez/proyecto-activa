/**
 * HOOK: useIA
 *
 * Gestiona el chat con la IA para una sesión dada.
 *
 * Params:
 *   - sessionId: string
 *   - plan: Plan (para saber el historial permitido)
 *
 * Retorna:
 *   - mensajes: MensajeChat[]
 *   - cargando: boolean
 *   - enviando: boolean (mientras espera respuesta de IA)
 *   - enviarMensaje: (contenido: string) => Promise<void>
 *   - mensajesRestantes: number | null (null si es ilimitado)
 *
 * TODO: implementar con iaService
 * TODO: scroll automático al recibir nuevo mensaje
 */

import type { MensajeChat } from '@/types/app.types';
import type { Plan } from '@/types/database.types';

export function useIA(_sessionId: string, _plan: Plan) {
  // TODO: implementar

  return {
    mensajes: [] as MensajeChat[],
    cargando: false,
    enviando: false,
    enviarMensaje: async (_contenido: string) => {},
    mensajesRestantes: null as number | null,
  };
}
