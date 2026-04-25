/**
 * CONFIGURACIÓN DE LA APP
 *
 * Las variables EXPO_PUBLIC_ están disponibles en el bundle del cliente.
 * La anon key de Supabase es segura en el cliente: la seguridad real
 * está en las políticas RLS de la base de datos.
 *
 * Para cambiar entre entornos (dev/prod), basta con cambiar el .env.
 */

const _supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const _supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!_supabaseUrl) throw new Error('[config] EXPO_PUBLIC_SUPABASE_URL no está definida. Revisa tu archivo .env');
if (!_supabaseAnonKey) throw new Error('[config] EXPO_PUBLIC_SUPABASE_ANON_KEY no está definida. Revisa tu archivo .env');

export const SUPABASE_URL = _supabaseUrl;
export const SUPABASE_ANON_KEY = _supabaseAnonKey;

// Google Sign-In — rellenar en .env tras crear credenciales en Google Cloud Console
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

/** Open Food Facts — búsqueda de respaldo (sin clave en cliente). */
export const FOOD_API_SOURCE = 'openfoodfacts';
/** FatSecret — legado / asegurarFoodParaLog; la búsqueda usa USDA + OFF. */
export const FATSECRET_API_SOURCE = 'fatsecret';

/** USDA FoodData Central — clave en https://fdc.nal.usda.gov/api-key-signup.html */
export const USDA_FDC_API_KEY = process.env.EXPO_PUBLIC_USDA_FDC_API_KEY ?? '';

/** LibreTranslate: instancia por defecto pública (límites bajos); mejor self-host en producción. */
export const LIBRETRANSLATE_URL =
  (process.env.EXPO_PUBLIC_LIBRETRANSLATE_URL ?? 'https://libretranslate.com').replace(
    /\/$/,
    '',
  );
export const LIBRETRANSLATE_API_KEY = process.env.EXPO_PUBLIC_LIBRETRANSLATE_API_KEY ?? '';

export const EXERCISE_API_SOURCE = 'api_ninjas';
