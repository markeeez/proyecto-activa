-- RLS: permitir UPDATE en nutrition_log_meals (orden, nombre, etc.)
-- Necesario para reordenar comidas en la app (nutricionService.actualizarOrdenComidas).
--
-- Ajusta el nombre de la política si choca con una existente.

DROP POLICY IF EXISTS "El usuario actualiza comidas de su log" ON public.nutrition_log_meals;

CREATE POLICY "El usuario actualiza comidas de su log"
ON public.nutrition_log_meals
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.nutrition_logs nl
    WHERE nl.id = nutrition_log_meals.log_id
      AND nl.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.nutrition_logs nl
    WHERE nl.id = nutrition_log_meals.log_id
      AND nl.user_id = auth.uid()
  )
);

COMMENT ON POLICY "El usuario actualiza comidas de su log" ON public.nutrition_log_meals IS
  'Permite actualizar filas (p. ej. orden) solo si el log pertenece al usuario autenticado.';
