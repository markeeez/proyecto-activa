/**
 * HOOK: usePerfil
 *
 * Carga y gestiona los datos del perfil del usuario autenticado.
 *
 * Retorna:
 *   - perfil: Profile | null
 *   - cargando: boolean
 *   - error: string | null
 *   - recargar: () => void
 *   - actualizarPerfil: (datos) => Promise<void>
 *
 * TODO: implementar con perfilService.obtenerPerfil()
 * TODO: invalidar caché al actualizar
 */

import type { Profile } from '@/types/database.types';

export function usePerfil() {
  // TODO: implementar
  return {
    perfil: null as Profile | null,
    cargando: false,
    error: null as string | null,
    recargar: () => {},
    actualizarPerfil: async (_datos: Partial<Profile>) => {},
  };
}
