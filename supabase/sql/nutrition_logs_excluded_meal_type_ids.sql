-- Solo la columna. Para columna + RLS UPDATE (recomendado), usa en su lugar:
--   nutrition_logs_rls_update_excluded.sql

ALTER TABLE public.nutrition_logs
  ADD COLUMN IF NOT EXISTS excluded_meal_type_ids uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.nutrition_logs.excluded_meal_type_ids IS
  'meal_types ocultados para este día; no se insertan de nuevo en nutrition_log_meals.';
