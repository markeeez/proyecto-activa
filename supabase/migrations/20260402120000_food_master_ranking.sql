-- Capa maestros, tipificación de fuente y popularidad de búsqueda/selección.

ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS food_tier text NOT NULL DEFAULT 'reference'
    CHECK (food_tier IN ('master', 'reference', 'brand'));

ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS source_kind text NULL;

ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS verified_basic boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.foods.food_tier IS 'master=curado local; reference=USDA/ genérico; brand=FNDDS/producto preparado u OF';
COMMENT ON COLUMN public.foods.source_kind IS 'builtin | usda_foundation | usda_sr_legacy | usda_fndds | openfoodfacts | custom';
COMMENT ON COLUMN public.foods.verified_basic IS 'true para alimentos base oficiales (Foundation / curados)';

-- Popularidad agregada (contador de usos al registrar en el log)
CREATE TABLE IF NOT EXISTS public.food_search_popularity (
  food_id uuid NOT NULL PRIMARY KEY REFERENCES public.foods (id) ON DELETE CASCADE,
  selection_count integer NOT NULL DEFAULT 0 CHECK (selection_count >= 0),
  last_selected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS food_search_popularity_count_idx
  ON public.food_search_popularity (selection_count DESC);

ALTER TABLE public.food_search_popularity ENABLE ROW LEVEL SECURITY;

-- Lectura para usuarios autenticados (ranking en cliente)
DROP POLICY IF EXISTS food_search_popularity_select_auth ON public.food_search_popularity;
CREATE POLICY food_search_popularity_select_auth
  ON public.food_search_popularity
  FOR SELECT
  TO authenticated
  USING (true);

-- Sin INSERT/UPDATE directo: solo RPC SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.increment_food_popularity(p_food_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_food_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.food_search_popularity (food_id, selection_count, last_selected_at)
  VALUES (p_food_id, 1, now())
  ON CONFLICT (food_id) DO UPDATE SET
    selection_count = public.food_search_popularity.selection_count + 1,
    last_selected_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.increment_food_popularity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_food_popularity(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_food_popularity(uuid) TO service_role;
