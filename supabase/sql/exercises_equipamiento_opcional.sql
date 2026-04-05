-- Opcional: filtro "Equipamiento" en búsqueda de ejercicios.
-- Ejecutar en Supabase SQL Editor si quieres persistir equipamiento por ejercicio.

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS equipamiento text;

COMMENT ON COLUMN exercises.equipamiento IS 'Ej: barra, mancuernas, máquina, cable, peso corporal…';
