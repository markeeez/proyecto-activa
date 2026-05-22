select cron.unschedule(jobid)
from cron.job
where jobname = 'purge-old-notification-events';

select cron.schedule(
  'purge-old-notification-events',
  '15 3 * * *',
  $$
  delete from public.notification_events
  where created_at < now() - interval '30 days';
  $$
);
