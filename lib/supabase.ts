import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/constants/config';

/**
 * Supabase Auth storage.
 *
 * Usamos AsyncStorage para evitar el limite de 2048 bytes de SecureStore
 * en sesiones JWT largas y mantener la sesión persistida de forma estable.
 */

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
