-- =============================================================================
-- RLS modelo B: alimentos globales (builtin / caché USDA) solo vía service_role
-- (Edge Function). El cliente autenticado solo INSERT/UPDATE/DELETE custom propios.
--
-- ORDEN RECOMENDADO (evita romper la app):
--   1) supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
--   2) supabase functions deploy foods-upsert-global
--   3) Publicar la app que llama a la función
--   4) Ejecutar esta migración (o aplicar políticas en el SQL Editor)
-- =============================================================================

ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "foods_select_authenticated" ON public.foods;
CREATE POLICY "foods_select_authenticated"
  ON public.foods
  FOR SELECT
  TO authenticated
  USING (
    (is_custom = false AND created_by IS NULL)
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "foods_insert_authenticated" ON public.foods;
CREATE POLICY "foods_insert_authenticated"
  ON public.foods
  FOR INSERT
  TO authenticated
  WITH CHECK (is_custom = true AND created_by = auth.uid());

DROP POLICY IF EXISTS "foods_update_authenticated" ON public.foods;
CREATE POLICY "foods_update_authenticated"
  ON public.foods
  FOR UPDATE
  TO authenticated
  USING (is_custom = true AND created_by = auth.uid())
  WITH CHECK (is_custom = true AND created_by = auth.uid());

DROP POLICY IF EXISTS "foods_delete_own_custom" ON public.foods;
CREATE POLICY "foods_delete_own_custom"
  ON public.foods
  FOR DELETE
  TO authenticated
  USING (is_custom = true AND created_by = auth.uid());
