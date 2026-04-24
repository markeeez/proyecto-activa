-- =============================================================================
-- nutrition_logs: UNIQUE(user_id, fecha)
-- =============================================================================
-- Garantiza que nunca puede existir más de un log por usuario por día.
-- Elimina la race condition del patrón SELECT + INSERT: a partir de aquí
-- se puede usar INSERT ... ON CONFLICT DO NOTHING de forma segura.
--
-- PASO 1 (solo si hay duplicados): limpia filas duplicadas conservando la más
-- antigua de cada par. Si tu tabla está limpia puedes saltar al PASO 2.
-- Para verificar si tienes duplicados ejecuta primero:
--   SELECT user_id, fecha, COUNT(*) FROM nutrition_logs
--   GROUP BY user_id, fecha HAVING COUNT(*) > 1;
--
-- Ejecutar en Supabase → SQL Editor.
-- =============================================================================

-- PASO 1 (opcional): eliminar duplicados preservando el registro más antiguo
-- Descomenta este bloque SOLO si la query de verificación devuelve filas.
/*
DELETE FROM public.nutrition_logs
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, fecha) id
  FROM public.nutrition_logs
  ORDER BY user_id, fecha, created_at ASC
);
*/

-- PASO 2: añadir la constraint
ALTER TABLE public.nutrition_logs
  ADD CONSTRAINT nutrition_logs_user_fecha_key
  UNIQUE (user_id, fecha);
