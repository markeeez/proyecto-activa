alter table public.notification_reminders
  drop constraint if exists notification_reminders_title_length_chk;

alter table public.notification_reminders
  drop constraint if exists notification_reminders_body_length_chk;

update public.notification_reminders
set
  title = left(trim(title), 30),
  body = case
    when body is null then null
    when trim(body) = '' then null
    else left(trim(body), 100)
  end;

alter table public.notification_reminders
  add constraint notification_reminders_title_length_chk
  check (char_length(trim(title)) between 1 and 30);

alter table public.notification_reminders
  add constraint notification_reminders_body_length_chk
  check (body is null or char_length(body) <= 100);
