create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets where name = 'project_url'
  ) then
    perform vault.create_secret(
      'https://ylhzkdzmhaifzyairthz.supabase.co',
      'project_url',
      'Supabase project URL for scheduled Edge Functions'
    );
  end if;

  if not exists (
    select 1 from vault.decrypted_secrets where name = 'smart_notifications_cron_secret'
  ) then
    raise notice 'Missing Vault secret smart_notifications_cron_secret. Cron job will not be scheduled until the secret exists.';
  end if;
end $$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'smart-notifications-every-15-minutes';

select cron.schedule(
  'smart-notifications-every-15-minutes',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/smart-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'smart_notifications_cron_secret')
    ),
    body := jsonb_build_object('source', 'pg_cron'),
    timeout_milliseconds := 10000
  );
  $$
)
where exists (
  select 1 from vault.decrypted_secrets where name = 'smart_notifications_cron_secret'
);
