-- Ejecutar en Supabase → SQL Editor (proyecto correcto).
-- Borra alimentos globales en caché (FatSecret, Open Food Facts, USDA, etc.).
-- NO borra: api_source = 'builtin' ni filas is_custom = true.
-- Para borrar también builtin: ejecuta delete_builtin_foods.sql (y en código INCLUIR_BASICOS_EN_BUSQUEDA = false).
--
-- Si falla por claves foráneas (p. ej. nutrition_log_items → food_id), primero borra o
-- actualiza esas filas, o usa solo entornos de prueba sin historial.

DELETE FROM public.foods
WHERE is_custom = false
  AND created_by IS NULL
  AND COALESCE(api_source, '') <> 'builtin';

-- Popularidad asociada (PK = food_id) suele eliminarse en CASCADE; si no existe la FK:
-- DELETE FROM public.food_search_popularity
-- WHERE food_id NOT IN (SELECT id FROM public.foods);
