-- Búsqueda sin tildes en foods.nombre
-- Crea extensión unaccent, wrapper IMMUTABLE, columna generada nombre_norm e índices.

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Wrapper IMMUTABLE necesario para columnas generadas e índices funcionales
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
  RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT unaccent($1) $$;

-- Columna generada: lower(unaccent(nombre)) — se actualiza automáticamente con cada UPDATE
ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS nombre_norm text
  GENERATED ALWAYS AS (lower(public.f_unaccent(nombre))) STORED;

-- Índice trigrama para ilike rápido (usado por buscarFoodsPorTextoLibre)
CREATE INDEX IF NOT EXISTS idx_foods_nombre_norm_trgm
  ON public.foods USING gin (nombre_norm gin_trgm_ops);

-- Índice btree para prefix/equality lookups
CREATE INDEX IF NOT EXISTS idx_foods_nombre_norm_btree
  ON public.foods USING btree (nombre_norm);
