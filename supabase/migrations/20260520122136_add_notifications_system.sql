create extension if not exists pgcrypto;

create table if not exists public.notification_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  hour smallint not null check (hour between 0 and 23),
  minute smallint not null check (minute between 0 and 59),
  repeat_type text not null check (repeat_type in ('once', 'daily', 'weekdays')),
  weekdays smallint[] not null default '{}',
  enabled boolean not null default true,
  next_trigger_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_reminders_title_length_chk check (char_length(trim(title)) between 1 and 30),
  constraint notification_reminders_body_length_chk check (body is null or char_length(body) <= 100),
  constraint notification_reminders_weekdays_chk check (
    repeat_type <> 'weekdays'
    or (
      array_length(weekdays, 1) between 1 and 7
      and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]
    )
  )
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('no_food_today', 'calories_remaining', 'no_workout_3_days', 'weigh_in')),
  enabled boolean not null default false,
  hour smallint not null check (hour between 0 and 23),
  minute smallint not null check (minute between 0 and 59),
  timezone text not null default 'Europe/Madrid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, type)
);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('no_food_today', 'calories_remaining', 'no_workout_3_days', 'weigh_in')),
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  scheduled_for_date date not null,
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, type, scheduled_for_date)
);

create table if not exists public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android', 'web', 'unknown')),
  device_name text,
  timezone text not null default 'Europe/Madrid',
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists notification_reminders_user_id_idx
  on public.notification_reminders (user_id, enabled);

create index if not exists notification_preferences_due_idx
  on public.notification_preferences (enabled, hour, minute);

create index if not exists notification_events_user_id_created_at_idx
  on public.notification_events (user_id, created_at desc);

create index if not exists notification_devices_user_id_enabled_idx
  on public.notification_devices (user_id, enabled);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_notification_reminders_updated_at on public.notification_reminders;
create trigger set_notification_reminders_updated_at
  before update on public.notification_reminders
  for each row execute function public.set_updated_at();

drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

drop trigger if exists set_notification_devices_updated_at on public.notification_devices;
create trigger set_notification_devices_updated_at
  before update on public.notification_devices
  for each row execute function public.set_updated_at();

alter table public.notification_reminders enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_devices enable row level security;

drop policy if exists "notification_reminders_select_own" on public.notification_reminders;
create policy "notification_reminders_select_own"
  on public.notification_reminders for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "notification_reminders_insert_own" on public.notification_reminders;
create policy "notification_reminders_insert_own"
  on public.notification_reminders for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "notification_reminders_update_own" on public.notification_reminders;
create policy "notification_reminders_update_own"
  on public.notification_reminders for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notification_reminders_delete_own" on public.notification_reminders;
create policy "notification_reminders_delete_own"
  on public.notification_reminders for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "notification_preferences_select_own" on public.notification_preferences;
create policy "notification_preferences_select_own"
  on public.notification_preferences for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "notification_preferences_insert_own" on public.notification_preferences;
create policy "notification_preferences_insert_own"
  on public.notification_preferences for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "notification_preferences_update_own" on public.notification_preferences;
create policy "notification_preferences_update_own"
  on public.notification_preferences for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notification_events_select_own" on public.notification_events;
create policy "notification_events_select_own"
  on public.notification_events for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "notification_events_update_own" on public.notification_events;
create policy "notification_events_update_own"
  on public.notification_events for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notification_devices_select_own" on public.notification_devices;
create policy "notification_devices_select_own"
  on public.notification_devices for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "notification_devices_insert_own" on public.notification_devices;
create policy "notification_devices_insert_own"
  on public.notification_devices for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "notification_devices_update_own" on public.notification_devices;
create policy "notification_devices_update_own"
  on public.notification_devices for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.notification_reminders to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select on public.notification_events to authenticated;
grant update (read_at) on public.notification_events to authenticated;
grant select, insert, update on public.notification_devices to authenticated;
