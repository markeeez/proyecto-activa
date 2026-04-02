/**
 * CONFIGURACIÓN DE LA APP
 *
 * Las variables EXPO_PUBLIC_ están disponibles en el bundle del cliente.
 * La anon key de Supabase es segura en el cliente: la seguridad real
 * está en las políticas RLS de la base de datos.
 *
 * Para cambiar entre entornos (dev/prod), basta con cambiar el .env.
 */

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Google Sign-In — rellenar en .env tras crear credenciales en Google Cloud Console
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

/** Open Food Facts — búsqueda de respaldo (sin clave en cliente). */
export const FOOD_API_SOURCE = 'openfoodfacts';
/** FatSecret — búsqueda principal vía Edge Function (credenciales en secretos Supabase). */
export const FATSECRET_API_SOURCE = 'fatsecret';

export const EXERCISE_API_SOURCE = 'api_ninjas';
