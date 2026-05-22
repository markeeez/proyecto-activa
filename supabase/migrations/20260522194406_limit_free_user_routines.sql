-- Limit: users on plan 'free' may have at most 10 routines they created.
-- plus / premium: unlimited.

create or replace function public.enforce_free_routine_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_plan text;
  current_count integer;
  max_free_routines constant integer := 10;
begin
  if new.created_by is null then
    return new;
  end if;

  select plan into user_plan
  from public.profiles
  where id = new.created_by;

  if user_plan is distinct from 'free' then
    return new;
  end if;

  select count(*) into current_count
  from public.routines
  where created_by = new.created_by;

  if current_count >= max_free_routines then
    raise exception 'ROUTINE_LIMIT_REACHED: plan free permite un maximo de % rutinas.', max_free_routines
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_free_routine_limit on public.routines;
create trigger trg_enforce_free_routine_limit
before insert on public.routines
for each row execute function public.enforce_free_routine_limit();
