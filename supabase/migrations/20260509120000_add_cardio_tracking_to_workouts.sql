alter table public.exercises
  add column if not exists tracking_mode text;

update public.exercises
set tracking_mode = case
  when categoria = 'cardio'
   and (
    lower(coalesce(nombre, '')) like any (array[
      '%cinta%', '%caminar%', '%caminata%', '%andar%', '%carrera%', '%correr%',
      '%bicicleta%', '%bici%', '%elíptica%', '%eliptica%'
    ])
    or lower(coalesce(equipamiento, '')) like any (array[
      '%cinta%', '%bicicleta%', '%bici%', '%elíptica%', '%eliptica%'
    ])
   ) then 'cardio_time_distance'
  when categoria = 'cardio' then 'cardio_time'
  else 'strength'
end
where tracking_mode is null
   or tracking_mode not in ('strength', 'cardio_time', 'cardio_time_distance');

alter table public.exercises
  alter column tracking_mode set default 'strength',
  alter column tracking_mode set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'exercises_tracking_mode_check'
      and conrelid = 'public.exercises'::regclass
  ) then
    alter table public.exercises
      add constraint exercises_tracking_mode_check
      check (tracking_mode in ('strength', 'cardio_time', 'cardio_time_distance'));
  end if;
end $$;

comment on column public.exercises.tracking_mode is
  'How the exercise is logged in workout sessions: strength, cardio_time, or cardio_time_distance.';

alter table public.workout_sets
  add column if not exists distancia_km numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workout_sets_distancia_km_check'
      and conrelid = 'public.workout_sets'::regclass
  ) then
    alter table public.workout_sets
      add constraint workout_sets_distancia_km_check
      check (distancia_km is null or distancia_km >= 0);
  end if;
end $$;

comment on column public.workout_sets.duracion_seg is
  'Duration in seconds for timed/cardio exercise logs. Rest duration is stored separately in descanso_seg.';

comment on column public.workout_sets.descanso_seg is
  'Rest in seconds between completed strength sets. Must remain null for cardio logs.';

comment on column public.workout_sets.distancia_km is
  'Optional distance in kilometers for cardio exercises that track distance.';

create or replace function public.obtener_anterior_ejercicio_registro(p_exercise_id uuid)
returns table(
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
  select
    e.tracking_mode,
    ws.peso_kg,
    ws.repeticiones,
    ws.tipo_peso,
    ws.duracion_seg,
    ws.distancia_km
  from public.workout_sets ws
  join public.workout_session_exercises wse on wse.id = ws.session_exercise_id
  join public.workout_sessions wss on wss.id = wse.session_id
  join public.exercises e on e.id = wse.exercise_id
  where ws.completada = true
    and wse.exercise_id = p_exercise_id
    and wss.user_id = auth.uid()
  order by coalesce(wss.hora_fin, wss.hora_inicio, wss.created_at, wss.fecha::timestamptz) desc,
           ws.numero_serie desc
  limit 1;
$function$;
