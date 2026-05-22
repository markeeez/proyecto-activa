-- Rate-limit por usuario para push notifications generadas por el edge function
-- smart-notifications. Evita que una preferencia mal-configurada o un ataque
-- pueda generar mas de 1 push cada 30 min al mismo usuario.

create table if not exists public.notification_send_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (user_id, sent_at)
);

create index if not exists notification_send_log_user_recent_idx
  on public.notification_send_log (user_id, sent_at desc);

-- Solo service_role la lee/escribe (edge function). Authenticated no la toca.
alter table public.notification_send_log enable row level security;

-- ─── Helper: ¿podemos enviar push a este user ahora? ────────────────────────
-- Solo callable por service_role (edge function via supabase-js sin RLS).
create or replace function public.can_send_smart_push(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from public.notification_send_log
    where user_id = p_user_id
      and sent_at > now() - interval '30 minutes'
  );
$$;

revoke execute on function public.can_send_smart_push(uuid) from public, anon, authenticated;

-- ─── Cleanup helper: purga registros mas viejos de 24h ──────────────────────
create or replace function public.purge_notification_send_log_old()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.notification_send_log where sent_at < now() - interval '24 hours';
$$;

revoke execute on function public.purge_notification_send_log_old() from public, anon, authenticated;
