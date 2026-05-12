create table if not exists public.exercise_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  record_type text not null,
  value numeric not null check (value > 0),
  workout_set_id uuid references public.workout_sets(id) on delete set null,
  session_id uuid references public.workout_sessions(id) on delete set null,
  achieved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_records_record_type_check
    check (record_type in ('max_weight', 'max_volume', 'max_duration', 'max_distance')),
  constraint exercise_records_user_exercise_type_key
    unique (user_id, exercise_id, record_type)
);

create table if not exists public.exercise_record_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  workout_set_id uuid not null references public.workout_sets(id) on delete cascade,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  record_type text not null,
  value numeric not null check (value > 0),
  previous_value numeric check (previous_value is null or previous_value > 0),
  achieved_at timestamptz not null default now(),
  invalidated_at timestamptz,
  constraint exercise_record_events_record_type_check
    check (record_type in ('max_weight', 'max_volume', 'max_duration', 'max_distance'))
);

create unique index if not exists exercise_record_events_active_set_type_key
  on public.exercise_record_events (workout_set_id, record_type)
  where invalidated_at is null;

create index if not exists exercise_records_user_exercise_idx
  on public.exercise_records (user_id, exercise_id);

create index if not exists exercise_record_events_user_exercise_idx
  on public.exercise_record_events (user_id, exercise_id);

create index if not exists exercise_record_events_session_idx
  on public.exercise_record_events (session_id)
  where invalidated_at is null;

alter table public.exercise_records enable row level security;
alter table public.exercise_record_events enable row level security;

drop policy if exists "Users can view own exercise records" on public.exercise_records;
create policy "Users can view own exercise records"
on public.exercise_records
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own exercise record events" on public.exercise_record_events;
create policy "Users can view own exercise record events"
on public.exercise_record_events
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.obtener_records_vigentes_ejercicios(p_exercise_ids uuid[])
returns table(
  exercise_id uuid,
  record_type text,
  value numeric,
  workout_set_id uuid,
  session_id uuid,
  achieved_at timestamptz
)
language sql
stable
set search_path to 'public'
as $function$
  select
    er.exercise_id,
    er.record_type,
    er.value,
    er.workout_set_id,
    er.session_id,
    er.achieved_at
  from public.exercise_records er
  where er.user_id = auth.uid()
    and er.exercise_id = any(coalesce(p_exercise_ids, array[]::uuid[]));
$function$;

create or replace function public.obtener_record_events_sesion(p_session_id uuid)
returns table(
  exercise_id uuid,
  workout_set_id uuid,
  record_type text,
  value numeric,
  previous_value numeric,
  achieved_at timestamptz
)
language sql
stable
set search_path to 'public'
as $function$
  select
    ere.exercise_id,
    ere.workout_set_id,
    ere.record_type,
    ere.value,
    ere.previous_value,
    ere.achieved_at
  from public.exercise_record_events ere
  join public.workout_sessions ws on ws.id = ere.session_id
  where ere.session_id = p_session_id
    and ere.invalidated_at is null
    and ws.user_id = auth.uid()
    and ere.user_id = auth.uid();
$function$;

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

create or replace function public.recalcular_records_usuario_ejercicio(
  p_user_id uuid,
  p_exercise_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or v_user_id <> p_user_id then
    raise exception 'Not allowed';
  end if;

  delete from public.exercise_records
  where user_id = p_user_id
    and exercise_id = p_exercise_id;

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
    p_user_id,
    ranked.exercise_id,
    ranked.record_type,
    ranked.value,
    ranked.workout_set_id,
    ranked.session_id,
    ranked.achieved_at,
    now()
  from (
    select
      wse.exercise_id,
      sess.id as session_id,
      ws.id as workout_set_id,
      metric.record_type,
      metric.value,
      coalesce(sess.hora_fin, sess.hora_inicio, sess.created_at, sess.fecha::timestamptz) as achieved_at,
      row_number() over (
        partition by metric.record_type
        order by metric.value desc,
                 coalesce(sess.hora_fin, sess.hora_inicio, sess.created_at, sess.fecha::timestamptz) asc,
                 ws.id asc
      ) as rn
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
    where sess.user_id = p_user_id
      and wse.exercise_id = p_exercise_id
      and ws.completada = true
      and metric.value is not null
  ) ranked
  where ranked.rn = 1;

  update public.exercise_record_events ere
  set invalidated_at = now()
  where ere.user_id = p_user_id
    and ere.exercise_id = p_exercise_id
    and ere.invalidated_at is null
    and not exists (
      select 1
      from public.exercise_records er
      where er.user_id = ere.user_id
        and er.exercise_id = ere.exercise_id
        and er.record_type = ere.record_type
        and er.workout_set_id = ere.workout_set_id
    );
end;
$function$;

revoke execute on function public.obtener_records_vigentes_ejercicios(uuid[]) from public, anon;
revoke execute on function public.obtener_record_events_sesion(uuid) from public, anon;
revoke execute on function public.registrar_record_events_para_sets(uuid[]) from public, anon;
revoke execute on function public.recalcular_records_usuario_ejercicio(uuid, uuid) from public, anon;

grant execute on function public.obtener_records_vigentes_ejercicios(uuid[]) to authenticated;
grant execute on function public.obtener_record_events_sesion(uuid) to authenticated;
grant execute on function public.registrar_record_events_para_sets(uuid[]) to authenticated;
grant execute on function public.recalcular_records_usuario_ejercicio(uuid, uuid) to authenticated;
