alter table public.routine_sets
  add column if not exists duracion_seg integer,
  add column if not exists distancia_km numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'routine_sets_duracion_seg_check'
      and conrelid = 'public.routine_sets'::regclass
  ) then
    alter table public.routine_sets
      add constraint routine_sets_duracion_seg_check
      check (duracion_seg is null or duracion_seg >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'routine_sets_distancia_km_check'
      and conrelid = 'public.routine_sets'::regclass
  ) then
    alter table public.routine_sets
      add constraint routine_sets_distancia_km_check
      check (distancia_km is null or distancia_km >= 0);
  end if;
end $$;

comment on column public.routine_sets.duracion_seg is
  'Planned duration in seconds for timed/cardio exercises in routine templates.';

comment on column public.routine_sets.distancia_km is
  'Optional planned distance in kilometers for cardio routine templates.';
