-- Opcional: permitir UPDATE en nutrition_log_items (p. ej. cambiar meal_id al consolidar duplicados).
-- Si en consola ves "[nutricionService] consolidar: mover items", aplica esta política.

DROP POLICY IF EXISTS "El usuario actualiza ítems de su log" ON public.nutrition_log_items;

CREATE POLICY "El usuario actualiza ítems de su log"
ON public.nutrition_log_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.nutrition_log_meals nlm
    JOIN public.nutrition_logs nl ON nl.id = nlm.log_id
    WHERE nlm.id = nutrition_log_items.meal_id
      AND nl.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.nutrition_log_meals nlm
    JOIN public.nutrition_logs nl ON nl.id = nlm.log_id
    WHERE nlm.id = nutrition_log_items.meal_id
      AND nl.user_id = auth.uid()
  )
);
