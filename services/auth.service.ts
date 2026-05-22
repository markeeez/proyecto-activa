/**
 * Servicios de autenticación que NO son llamadas directas a supabase.auth.
 *
 * Las pantallas de auth usan `supabase.auth.signInWithPassword/signUp/...`
 * directamente; este modulo solo expone utilidades adicionales (recuperación
 * de contraseña vía deeplink, traducción de errores).
 */

import { supabase } from '@/lib/supabase';

export const PASSWORD_RECOVERY_REDIRECT_TO = 'proyectoactiva://restablecer-contrasena';

type ErrorLike = { message?: string; code?: string; name?: string } | null | undefined;

export function traducirErrorAuth(error: ErrorLike): string {
  if (!error) return 'Ha ocurrido un error. Inténtalo de nuevo.';
  const code = (error.code ?? '').toLowerCase();
  const message = (error.message ?? '').toLowerCase();

  if (
    code === 'user_already_exists' ||
    code === 'identity_already_exists' ||
    message.includes('already registered') ||
    message.includes('user already registered') ||
    message.includes('identity already linked')
  ) {
    return 'Este email ya está registrado. Inicia sesión con el método con el que te diste de alta.';
  }

  if (message.includes('invalid login credentials')) {
    return 'Email o contraseña incorrectos.';
  }

  if (message.includes('email not confirmed')) {
    return 'Confirma tu email antes de iniciar sesión. Revisa tu bandeja de entrada.';
  }

  return error.message ?? 'Ha ocurrido un error. Inténtalo de nuevo.';
}

export const authService = {
  async recuperarContrasena(email: string, options?: { redirectTo?: string }) {
    return supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: options?.redirectTo ?? PASSWORD_RECOVERY_REDIRECT_TO,
    });
  },
};
