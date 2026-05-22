# Supabase

Backend de la app (PostgreSQL + Auth + Edge Functions). Project: `ylhzkdzmhaifzyairthz`.

## Estructura

- `migrations/` — Migraciones SQL aplicadas al schema. Nombradas con timestamp UTC.
- `functions/smart-notifications/` — Edge function (Deno) que envía notificaciones inteligentes vía Expo Push. Disparada por `pg_cron` cada 15 minutos.
- `sql/` — SQL utilitario no versionado como migración (manual / ad-hoc).
- `config.toml` — Config local de Supabase CLI (no se aplica al remoto).

## Notas operativas

### SMTP

Hoy el envío de correos de Auth (confirmación, recuperación de contraseña, magic links) usa el **SMTP por defecto de Supabase** — gratuito y suficiente para desarrollo, pero limitado a ~30 mensajes/hora y con riesgo alto de caer en spam en producción.

**Antes de salir a producción** configurar SMTP propio en Dashboard → Auth → SMTP Settings. Opciones recomendadas: Resend, SendGrid o Postmark. Documentación: <https://supabase.com/docs/guides/auth/auth-smtp>.

### pg_cron

Job activo: `smart-notifications-every-15-minutes` (cada 15 min) y `purge-old-notification-events` (diario a las 03:15 UTC). Definidos en las migraciones correspondientes.
