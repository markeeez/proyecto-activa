-- Fix 6: Índices compuestos faltantes
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- 1. nutrition_log_meals: la pantalla de nutrición filtra siempre por log_id
CREATE INDEX IF NOT EXISTS idx_nutrition_log_meals_log_id
  ON public.nutrition_log_meals (log_id);

-- 2. nutrition_log_items: cada meal carga sus ítems filtrando por meal_id
CREATE INDEX IF NOT EXISTS idx_nutrition_log_items_meal_id
  ON public.nutrition_log_items (meal_id);

-- 3. user_goals: se busca por user_id y se ordena por created_at DESC
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id_created_at
  ON public.user_goals (user_id, created_at DESC);
