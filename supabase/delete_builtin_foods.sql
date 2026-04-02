-- Borra filas globales con api_source = 'builtin' (diccionario que se había insertado en BD).
-- La app con INCLUIR_BASICOS_EN_BUSQUEDA = false no los vuelve a crear al buscar.
-- Si lo pones en true, al buscar "pollo" etc. se hará upsert otra vez vía Edge.
--
-- Ejecutar en Supabase → SQL Editor. Si hay FK desde nutrition_log_items u otras tablas,
-- resuélvelas antes o solo usa en entornos de prueba.

DELETE FROM public.foods
WHERE is_custom = false
  AND created_by IS NULL
  AND api_source = 'builtin';
