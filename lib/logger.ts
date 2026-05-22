/**
 * Logger que solo emite en `__DEV__`. En producción no escribe nada para
 * evitar filtrar errores internos / IDs / payloads de Supabase.
 *
 * Uso:
 *   import { logger } from '@/lib/logger';
 *   logger.error('alimentos.guardar', err);
 *   logger.warn('notificaciones.registrarDispositivo', err);
 */

declare const __DEV__: boolean | undefined;

function isDev(): boolean {
  try {
    return typeof __DEV__ !== 'undefined' ? __DEV__ === true : process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}

function fmt(scope: string, payload: unknown): string {
  if (payload instanceof Error) return `[${scope}] ${payload.message}`;
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const msg = (payload as { message?: unknown }).message;
    if (typeof msg === 'string') return `[${scope}] ${msg}`;
  }
  return `[${scope}] ${String(payload)}`;
}

export const logger = {
  error(scope: string, payload: unknown): void {
    if (!isDev()) return;
    // eslint-disable-next-line no-console
    console.error(fmt(scope, payload));
  },
  warn(scope: string, payload: unknown): void {
    if (!isDev()) return;
    // eslint-disable-next-line no-console
    console.warn(fmt(scope, payload));
  },
  info(scope: string, payload: unknown): void {
    if (!isDev()) return;
    // eslint-disable-next-line no-console
    console.info(fmt(scope, payload));
  },
};
