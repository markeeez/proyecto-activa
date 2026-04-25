-- SEC-01: añade p_user_id a la RPC para que solo sume el volumen
-- del usuario que llama, y no el de todos los usuarios.
--
-- EJECUTAR en: Supabase → SQL Editor → New query → Run
--
-- La función recibe el user_id desde el cliente (TypeScript) Y
-- comprueba adicionalmente que coincida con auth.uid() como
-- segunda línea de defensa por si el cliente enviara un id ajeno.

CREATE OR REPLACE FUNCTION public.obtener_volumen_semana_kg(
  p_user_id      uuid,
  p_fecha_inicio date,
  p_fecha_fin    date
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    SUM(ws.peso_kg * ws.repeticiones),
    0
  )
  FROM workout_sets                ws
  JOIN workout_session_exercises   wse ON wse.id         = ws.session_exercise_id
  JOIN workout_sessions            s   ON s.id           = wse.session_id
  WHERE s.user_id      = p_user_id
    AND s.user_id      = auth.uid()          -- doble protección: aunque el cliente envíe un id ajeno, falla
    AND s.fecha::date BETWEEN p_fecha_inicio AND p_fecha_fin
    AND ws.completada  = true;
$$;
