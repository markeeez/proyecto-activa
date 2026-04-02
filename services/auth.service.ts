/**
 * SERVICIO DE AUTENTICACIÓN
 *
 * Gestiona todo lo relacionado con la sesión del usuario via Supabase Auth.
 * El perfil se crea automáticamente mediante el trigger de Supabase.
 */

import { supabase } from '@/lib/supabase';

export const authService = {
  /**
   * Inicia sesión con email y contraseña.
   * @returns session del usuario o error
   */
  async iniciarSesion(email: string, contrasena: string) {
    // TODO: implementar
    // return supabase.auth.signInWithPassword({ email, password: contrasena });
  },

  /**
   * Registra un nuevo usuario.
   * El trigger on_auth_user_created crea automáticamente profiles.
   * @param email
   * @param contrasena
   * @param datosExtra - nombre y username para el perfil
   */
  async registrarse(
    email: string,
    contrasena: string,
    datosExtra: { nombre: string; username: string }
  ) {
    // TODO: implementar
    // 1. supabase.auth.signUp({ email, password: contrasena, options: { data: datosExtra } })
    // 2. El trigger crea el perfil con nombre y username de options.data
  },

  /**
   * Cierra la sesión del usuario actual.
   */
  async cerrarSesion() {
    // TODO: implementar
    // return supabase.auth.signOut();
  },

  /**
   * Envía el email de recuperación de contraseña.
   */
  async recuperarContrasena(email: string) {
    return supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
  },

  /**
   * Devuelve la sesión activa o null.
   */
  async obtenerSesion() {
    // TODO: implementar
    // const { data } = await supabase.auth.getSession();
    // return data.session;
  },

  /**
   * Suscribe a cambios de estado de autenticación.
   * Usar en el AuthProvider para actualizar el estado global.
   */
  onAuthStateChange(callback: (sesion: any) => void) {
    // TODO: implementar
    // return supabase.auth.onAuthStateChange((_event, session) => {
    //   callback(session);
    // });
  },
};
