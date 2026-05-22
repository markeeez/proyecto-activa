-- Eliminar indices y constraints UNIQUE duplicados detectados por Supabase
-- database linter. Conservamos los nombres mas descriptivos.

-- exercises: dos indices identicos sobre (nombre). Mantenemos exercises_nombre_idx.
drop index if exists public.idx_exercises_nombre;

-- workout_sessions: dos indices identicos sobre (user_id, fecha DESC).
-- Mantenemos el nombre con sufijo _idx que sigue la convencion del schema.
drop index if exists public.idx_workout_sessions_user_id_fecha;

-- nutrition_logs: dos UNIQUE constraints sobre (user_id, fecha). Son constraints,
-- por lo que hay que dropear via ALTER TABLE.
-- Mantenemos nutrition_logs_user_id_fecha_key (mas explicito).
alter table public.nutrition_logs drop constraint if exists nutrition_logs_user_fecha_key;
