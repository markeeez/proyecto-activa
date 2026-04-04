-- nutrition_log_meals: autodescripción por día (sin depender de meal_types en app)
-- Ejecutar en Supabase SQL Editor antes de usar la nueva lógica del cliente.

-- 1) Columnas nuevas
ALTER TABLE public.nutrition_log_meals
  ADD COLUMN IF NOT EXISTS nombre text,
  ADD COLUMN IF NOT EXISTS orden integer,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- 2) Rellenar desde meal_types cuando exista FK
UPDATE public.nutrition_log_meals nlm
SET
  nombre = COALESCE(nlm.nombre, mt.nombre, 'Comida'),
  orden = COALESCE(nlm.orden, mt.orden, 0),
  is_default = COALESCE(nlm.is_default, mt.is_default, false)
FROM public.meal_types mt
WHERE nlm.meal_type_id IS NOT NULL
  AND mt.id = nlm.meal_type_id;

-- 3) Nombre por defecto si sigue faltando
UPDATE public.nutrition_log_meals
SET nombre = COALESCE(nombre, 'Comida')
WHERE nombre IS NULL;

-- 4) Orden solo donde siga NULL (p. ej. huérfanas sin meal_types)
UPDATE public.nutrition_log_meals nlm
SET orden = s.seq
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY log_id ORDER BY created_at) AS seq
  FROM public.nutrition_log_meals
) s
WHERE nlm.id = s.id AND nlm.orden IS NULL;

UPDATE public.nutrition_log_meals
SET orden = COALESCE(orden, 999)
WHERE orden IS NULL;

ALTER TABLE public.nutrition_log_meals
  ALTER COLUMN nombre SET NOT NULL,
  ALTER COLUMN orden SET NOT NULL;

-- 5) meal_type_id opcional (la app ya no lo usa)
ALTER TABLE public.nutrition_log_meals
  ALTER COLUMN meal_type_id DROP NOT NULL;

COMMENT ON COLUMN public.nutrition_log_meals.nombre IS 'Nombre de la comida en este día concreto.';
COMMENT ON COLUMN public.nutrition_log_meals.orden IS 'Orden de visualización en el día.';
COMMENT ON COLUMN public.nutrition_log_meals.is_default IS 'true = una de las 4 predeterminadas del sistema.';
