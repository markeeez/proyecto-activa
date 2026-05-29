-- Devuelve todos los sets del último entreno para un ejercicio dado (ordenados por numero_serie asc).
-- Usado para mostrar el texto "anterior" por serie en el entreno activo.
create or replace function public.obtener_anterior_ejercicio_sets(p_exercise_id uuid)
returns table(
  numero_serie integer,
  tracking_mode text,
  peso_kg numeric,
  repeticiones integer,
  tipo_peso text,
  duracion_seg integer,
  distancia_km numeric
)
language sql
stable
set search_path to 'public'
as $function$
  with ultima_sesion as (
    select wse.id as wse_id
    from public.workout_session_exercises wse
    join public.workout_sessions wss on wss.id = wse.session_id
    where wse.exercise_id = p_exercise_id
      and wss.user_id = auth.uid()
      and exists (
        select 1 from public.workout_sets ws2
        where ws2.session_exercise_id = wse.id and ws2.completada = true
      )
    order by coalesce(wss.hora_fin, wss.hora_inicio, wss.created_at, wss.fecha::timestamptz) desc
    limit 1
  )
  select
    ws.numero_serie,
    e.tracking_mode,
    ws.peso_kg,
    ws.repeticiones,
    ws.tipo_peso,
    ws.duracion_seg,
    ws.distancia_km
  from public.workout_sets ws
  join ultima_sesion us on us.wse_id = ws.session_exercise_id
  join public.workout_session_exercises wse on wse.id = ws.session_exercise_id
  join public.exercises e on e.id = wse.exercise_id
  where ws.completada = true
  order by ws.numero_serie asc;
$function$;
