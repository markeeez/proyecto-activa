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

export const FOOD_API_SOURCE = 'openfoodfacts';
export const USDA_API_SOURCE = 'usda_fdc';
export const USDA_API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY ?? 'DEMO_KEY';
export const EXERCISE_API_SOURCE = 'api_ninjas';
