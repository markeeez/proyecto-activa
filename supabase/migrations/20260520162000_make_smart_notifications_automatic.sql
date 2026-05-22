update public.notification_preferences
set
  enabled = true,
  hour = case
    when type = 'no_food_today' then 17
    when type = 'calories_remaining' then 21
    when type = 'no_workout_3_days' then 10
    when type = 'weigh_in' then 9
    else hour
  end,
  minute = case
    when type = 'no_food_today' then 0
    when type = 'calories_remaining' then 30
    when type = 'no_workout_3_days' then 0
    when type = 'weigh_in' then 30
    else minute
  end,
  updated_at = now()
where type in ('no_food_today', 'calories_remaining', 'no_workout_3_days', 'weigh_in');

with active_users as (
  select
    user_id,
    coalesce(max(timezone), 'Europe/Madrid') as timezone
  from public.notification_devices
  where enabled = true
  group by user_id
),
defaults(type, hour, minute) as (
  values
    ('no_food_today', 17, 0),
    ('calories_remaining', 21, 30),
    ('no_workout_3_days', 10, 0),
    ('weigh_in', 9, 30)
)
insert into public.notification_preferences (user_id, type, enabled, hour, minute, timezone)
select
  active_users.user_id,
  defaults.type,
  true,
  defaults.hour,
  defaults.minute,
  active_users.timezone
from active_users
cross join defaults
on conflict (user_id, type) do update
set
  enabled = true,
  hour = excluded.hour,
  minute = excluded.minute,
  timezone = excluded.timezone,
  updated_at = now();
