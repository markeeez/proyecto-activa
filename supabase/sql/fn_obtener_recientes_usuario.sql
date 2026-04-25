-- Fix 2-D: obtenerRecientes — reemplaza join 3 niveles + dedup en JS
-- por DISTINCT ON en servidor que devuelve directamente 20 foods distintos.
--
-- DISTINCT ON (nli.food_id): para cada food_id conserva solo la fila
-- con el nli.id más reciente (ORDER BY nli.food_id, nli.id DESC).
-- El LIMIT 20 se aplica después de la dedup, no antes.

CREATE OR REPLACE FUNCTION public.obtener_recientes_usuario(p_user_id uuid)
RETURNS SETOF public.foods
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (nli.food_id) f.*
  FROM nutrition_log_items   nli
  JOIN nutrition_log_meals   nlm ON nlm.id  = nli.meal_id
  JOIN nutrition_logs        nl  ON nl.id   = nlm.log_id
  JOIN foods                 f   ON f.id    = nli.food_id
  WHERE nl.user_id = p_user_id
  ORDER BY nli.food_id, nli.id DESC
  LIMIT 20;
$$;
