-- =============================================================================
-- nutrition_logs: columna excluded_meal_type_ids + política UPDATE
-- =============================================================================
-- Tu tabla ya tiene RLS con INSERT y SELECT sobre el rol public
-- ("El usuario crea/ve sus logs de nutrición"). Este script añade lo que falta
-- para que la app pueda hacer UPDATE (guardar exclusiones al borrar una comida).
--
-- Ejecutar en Supabase → SQL Editor.
-- =============================================================================

-- Columna: tipos de comida ocultados ese día (no recrear nutrition_log_meals)
ALTER TABLE public.nutrition_logs
  ADD COLUMN IF NOT EXISTS excluded_meal_type_ids uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.nutrition_logs.excluded_meal_type_ids IS
  'meal_types ocultados para este día; no se insertan de nuevo en nutrition_log_meals.';

-- Misma convención que tus políticas: rol public + solo filas propias (auth.uid())
DROP POLICY IF EXISTS "El usuario actualiza sus logs de nutrición" ON public.nutrition_logs;

CREATE POLICY "El usuario actualiza sus logs de nutrición"
  ON public.nutrition_logs
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
