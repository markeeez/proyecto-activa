/**
 * SERVICIO DE PERFIL
 *
 * Gestiona los datos del perfil del usuario: profiles, user_body_metrics.
 */

import { supabase } from '@/lib/supabase';
import type { Profile, UserBodyMetric } from '@/types/database.types';

export const perfilService = {
  /**
   * Obtiene el perfil del usuario autenticado.
   */
  async obtenerPerfil(userId: string): Promise<Profile | null> {
    // TODO: implementar
    // const { data } = await supabase
    //   .from('profiles')
    //   .select('*')
    //   .eq('id', userId)
    //   .single();
    // return data;
    return null;
  },

  /**
   * Actualiza nombre, apellidos o username del perfil.
   */
  async actualizarPerfil(
    userId: string,
    datos: Partial<Pick<Profile, 'nombre' | 'apellidos' | 'username'>>
  ) {
    // TODO: implementar
    // return supabase.from('profiles').update(datos).eq('id', userId);
  },

  /**
   * Comprueba si un username está disponible.
   * @returns true si está libre
   */
  async usernameDisponible(username: string, userId: string): Promise<boolean> {
    // TODO: implementar
    // const { data } = await supabase
    //   .from('profiles')
    //   .select('id')
    //   .eq('username', username)
    //   .neq('id', userId)
    //   .single();
    // return !data;
    return true;
  },

  /**
   * Registra nuevas métricas corporales del usuario.
   */
  async registrarMetricasCorporales(
    userId: string,
    datos: Pick<UserBodyMetric, 'peso_kg' | 'altura_cm' | 'grasa_corporal'>
  ) {
    // TODO: implementar
    // return supabase.from('user_body_metrics').insert({
    //   user_id: userId,
    //   ...datos,
    //   fecha: new Date().toISOString().split('T')[0],
    // });
  },

  /**
   * Obtiene el historial de métricas corporales.
   * @param limite - número de registros a traer (por defecto 90 días)
   */
  async obtenerMetricasCorporales(
    userId: string,
    limite = 90
  ): Promise<UserBodyMetric[]> {
    // TODO: implementar
    // const { data } = await supabase
    //   .from('user_body_metrics')
    //   .select('*')
    //   .eq('user_id', userId)
    //   .order('fecha', { ascending: false })
    //   .limit(limite);
    // return data ?? [];
    return [];
  },
};
