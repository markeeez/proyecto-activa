/**
 * SERVICIO DE PERFIL
 *
 * Gestiona los datos del perfil del usuario: profiles, user_body_metrics.
 */

import { supabase } from '@/lib/supabase';
import type { Profile, UserBodyMetric } from '@/types/database.types';

export type PerfilIdentidadInput = {
  nombre: string;
  username: string;
  altura_cm: number;
  edad: number;
};

export function normalizarUsername(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function normalizarNombrePerfil(value: string): string {
  return value.replace(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]/g, '');
}

export function validarNombrePerfil(value: string): boolean {
  return /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]{1,80}$/.test(value);
}

export function validarUsername(value: string): boolean {
  return /^[a-z0-9]{3,20}$/.test(value);
}

export function fechaProximoCambioUsername(lastChangedAt: string | null | undefined): Date | null {
  if (!lastChangedAt) return null;
  const changed = new Date(lastChangedAt);
  if (Number.isNaN(changed.getTime())) return null;
  return new Date(changed.getTime() + 15 * 24 * 60 * 60 * 1000);
}

export function puedeCambiarUsername(lastChangedAt: string | null | undefined, now = new Date()): boolean {
  const next = fechaProximoCambioUsername(lastChangedAt);
  return !next || now >= next;
}

export function mensajeErrorPerfil(message: string): string {
  if (message.includes('USERNAME_TAKEN') || message.includes('duplicate key')) {
    return 'Ese @ ya esta en uso.';
  }
  if (message.includes('USERNAME_COOLDOWN')) {
    return 'Solo puedes cambiar tu @ una vez cada 15 dias.';
  }
  if (message.includes('INVALID_USERNAME')) {
    return 'El @ debe tener 3-20 letras o numeros, sin espacios ni simbolos.';
  }
  if (message.includes('INVALID_NAME')) {
    return 'El nombre solo puede usar letras y numeros, sin espacios ni emojis.';
  }
  if (message.includes('INVALID_HEIGHT')) {
    return 'La altura debe estar entre 80 y 250 cm.';
  }
  if (message.includes('INVALID_AGE')) {
    return 'La edad debe estar entre 10 y 100 anos.';
  }
  return message || 'No se pudo guardar el perfil.';
}

export const perfilService = {
  /**
   * Obtiene el perfil del usuario autenticado.
   */
  async obtenerPerfil(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return (data as Profile | null) ?? null;
  },

  /**
   * Actualiza identidad y metricas basicas mediante RPC segura.
   */
  async actualizarIdentidad(datos: PerfilIdentidadInput): Promise<Profile> {
    const { data, error } = await supabase.rpc('update_profile_identity', {
      p_nombre: datos.nombre.trim(),
      p_username: normalizarUsername(datos.username),
      p_altura_cm: datos.altura_cm,
      p_edad: datos.edad,
    });

    if (error) throw new Error(mensajeErrorPerfil(error.message));
    if (!data) throw new Error('No se pudo guardar el perfil.');
    return data as Profile;
  },

  /**
   * Actualiza nombre, apellidos o username del perfil.
   */
  async actualizarPerfil(
    userId: string,
    datos: Partial<Pick<Profile, 'nombre' | 'apellidos' | 'username'>>
  ) {
    const { error } = await supabase.from('profiles').update(datos).eq('id', userId);
    if (error) throw error;
  },

  /**
   * Comprueba si un username esta disponible.
   * @returns true si esta libre
   */
  async usernameDisponible(username: string, userId: string): Promise<boolean> {
    const normalized = normalizarUsername(username);
    if (!validarUsername(normalized)) return false;

    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', normalized)
      .neq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return !data;
  },

  /**
   * Registra nuevas metricas corporales del usuario.
   */
  async registrarMetricasCorporales(
    userId: string,
    datos: Pick<UserBodyMetric, 'peso_kg' | 'altura_cm' | 'grasa_corporal'>
  ) {
    const { error } = await supabase.from('user_body_metrics').insert({
      user_id: userId,
      ...datos,
      fecha: new Date().toISOString().split('T')[0],
    });
    if (error) throw error;
  },

  /**
   * Obtiene el historial de metricas corporales.
   * @param limite - numero de registros a traer (por defecto 90 dias)
   */
  async obtenerMetricasCorporales(
    userId: string,
    limite = 90
  ): Promise<UserBodyMetric[]> {
    const { data, error } = await supabase
      .from('user_body_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('fecha', { ascending: false })
      .limit(limite);

    if (error) throw error;
    return (data ?? []) as UserBodyMetric[];
  },
};
