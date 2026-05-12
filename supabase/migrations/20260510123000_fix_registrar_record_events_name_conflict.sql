create or replace function public.registrar_record_events_para_sets(p_set_ids uuid[])
returns table(
  exercise_id uuid,
  workout_set_id uuid,
  record_type text,
  value numeric,
  previous_value numeric,
  achieved_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  with set_values as (
    select
      ws.id as workout_set_id,
      wse.exercise_id,
      sess.id as session_id,
      coalesce(sess.hora_fin, sess.hora_inicio, sess.created_at, sess.fecha::timestamptz) as achieved_at,
      metric.record_type,
      metric.value
    from public.workout_sets ws
    join public.workout_session_exercises wse on wse.id = ws.session_exercise_id
    join public.workout_sessions sess on sess.id = wse.session_id
    cross join lateral (
      values
        ('max_weight'::text, case when ws.peso_kg is not null and ws.peso_kg > 0 then ws.peso_kg else null end),
        ('max_volume'::text, case when ws.peso_kg is not null and ws.peso_kg > 0 and ws.repeticiones is not null and ws.repeticiones > 0 then ws.peso_kg * ws.repeticiones else null end),
        ('max_duration'::text, case when ws.duracion_seg is not null and ws.duracion_seg > 0 then ws.duracion_seg::numeric else null end),
        ('max_distance'::text, case when ws.distancia_km is not null and ws.distancia_km > 0 then ws.distancia_km else null end)
    ) as metric(record_type, value)
    where ws.id = any(coalesce(p_set_ids, array[]::uuid[]))
      and ws.completada = true
      and sess.user_id = v_user_id
      and metric.value is not null
  ),
  ranked as (
    select
      sv.*,
      er.value as previous_value,
      row_number() over (
        partition by sv.exercise_id, sv.record_type
        order by sv.value desc, sv.achieved_at asc, sv.workout_set_id asc
      ) as rn
    from set_values sv
    left join public.exercise_records er
      on er.user_id = v_user_id
     and er.exercise_id = sv.exercise_id
     and er.record_type = sv.record_type
    where er.value is null or sv.value > er.value
  ),
  winners as (
    select *
    from ranked
    where rn = 1
  ),
  inserted_events as (
    insert into public.exercise_record_events (
      user_id,
      exercise_id,
      workout_set_id,
      session_id,
      record_type,
      value,
      previous_value,
      achieved_at
    )
    select
      v_user_id,
      w.exercise_id,
      w.workout_set_id,
      w.session_id,
      w.record_type,
      w.value,
      w.previous_value,
      w.achieved_at
    from winners w
    on conflict do nothing
    returning
      public.exercise_record_events.exercise_id,
      public.exercise_record_events.workout_set_id,
      public.exercise_record_events.session_id,
      public.exercise_record_events.record_type,
      public.exercise_record_events.value,
      public.exercise_record_events.previous_value,
      public.exercise_record_events.achieved_at
  ),
  upserted_records as (
    insert into public.exercise_records (
      user_id,
      exercise_id,
      record_type,
      value,
      workout_set_id,
      session_id,
      achieved_at,
      updated_at
    )
    select
      v_user_id,
      ie.exercise_id,
      ie.record_type,
      ie.value,
      ie.workout_set_id,
      ie.session_id,
      ie.achieved_at,
      now()
    from inserted_events ie
    on conflict (user_id, exercise_id, record_type) do update
      set value = excluded.value,
          workout_set_id = excluded.workout_set_id,
          session_id = excluded.session_id,
          achieved_at = excluded.achieved_at,
          updated_at = now()
    returning 1
  )
  select
    ie.exercise_id,
    ie.workout_set_id,
    ie.record_type,
    ie.value,
    ie.previous_value,
    ie.achieved_at
  from inserted_events ie;
end;
$function$;

revoke execute on function public.registrar_record_events_para_sets(uuid[]) from public, anon;
grant execute on function public.registrar_record_events_para_sets(uuid[]) to authenticated;
