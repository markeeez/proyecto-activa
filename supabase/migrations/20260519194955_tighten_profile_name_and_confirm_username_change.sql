update public.profiles
set nombre = coalesce(
  nullif(regexp_replace(nombre, '[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]', '', 'g'), ''),
  'Usuario'
)
where nombre is null
  or nombre !~ '^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]{1,80}$';

alter table public.profiles
  drop constraint if exists profiles_nombre_length_chk;

alter table public.profiles
  add constraint profiles_nombre_alphanumeric_chk
  check (nombre ~ '^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]{1,80}$');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  raw_username text := lower(trim(coalesce(new.raw_user_meta_data->>'username', '')));
  raw_nombre text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'nombre'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    'Usuario'
  );
  clean_nombre text := regexp_replace(raw_nombre, '[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]', '', 'g');
begin
  insert into public.profiles (id, username, nombre)
  values (
    new.id,
    coalesce(
      case when raw_username ~ '^[a-z0-9]{3,20}$' then raw_username end,
      'user' || left(replace(new.id::text, '-', ''), 16)
    ),
    coalesce(nullif(clean_nombre, ''), 'Usuario')
  );

  return new;
end;
$function$;

create or replace function public.update_profile_identity(
  p_nombre text,
  p_username text,
  p_altura_cm numeric,
  p_edad integer
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_nombre text := trim(coalesce(p_nombre, ''));
  v_username text := lower(trim(coalesce(p_username, '')));
  v_profile public.profiles;
  v_username_changed boolean;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if v_nombre !~ '^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]{1,80}$' then
    raise exception 'INVALID_NAME' using errcode = '22023';
  end if;

  if v_username !~ '^[a-z0-9]{3,20}$' then
    raise exception 'INVALID_USERNAME' using errcode = '22023';
  end if;

  if p_altura_cm is null or p_altura_cm < 80 or p_altura_cm > 250 then
    raise exception 'INVALID_HEIGHT' using errcode = '22023';
  end if;

  if p_edad is null or p_edad < 10 or p_edad > 100 then
    raise exception 'INVALID_AGE' using errcode = '22023';
  end if;

  select *
    into v_profile
    from public.profiles
    where id = v_user_id
    for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_username_changed := v_username <> v_profile.username;

  if v_username_changed then
    if v_profile.username_last_changed_at is not null
      and v_profile.username_last_changed_at > now() - interval '15 days' then
      raise exception 'USERNAME_COOLDOWN' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from public.profiles
      where lower(username) = v_username
        and id <> v_user_id
    ) then
      raise exception 'USERNAME_TAKEN' using errcode = '23505';
    end if;
  end if;

  update public.profiles
    set nombre = v_nombre,
        username = v_username,
        altura_cm = p_altura_cm,
        edad = p_edad,
        username_last_changed_at = case
          when v_username_changed then now()
          else username_last_changed_at
        end
    where id = v_user_id
    returning * into v_profile;

  return v_profile;
end;
$function$;

revoke execute on function public.update_profile_identity(text, text, numeric, integer) from public, anon;
grant execute on function public.update_profile_identity(text, text, numeric, integer) to authenticated;
