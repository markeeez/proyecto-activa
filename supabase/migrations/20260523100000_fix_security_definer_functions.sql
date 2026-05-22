-- Endurecer funciones de la API publica.
--
-- 1. Fijar search_path en funciones que el linter marca como mutable (incluidas
--    las que no son SECURITY DEFINER pero corren en triggers / RPC).
-- 2. Revocar EXECUTE de anon en RPC que solo deberian llamar usuarios autenticados.
-- 3. Revocar EXECUTE en funciones-trigger internas que no deben ser callable via REST.

-- ─── A) search_path fijo ────────────────────────────────────────────────────

alter function public.f_unaccent(text)                       set search_path = public, pg_temp;
alter function public.set_updated_at()                       set search_path = public, pg_temp;
alter function public.update_updated_at_column()             set search_path = public, pg_temp;
alter function public.handle_updated_at()                    set search_path = public, pg_temp;
alter function public.consolidar_duplicados_slots(uuid)      set search_path = public, pg_temp;
alter function public.rls_auto_enable()                      set search_path = public, pg_temp;

-- ─── B) Trigger / housekeeping functions: nadie las llama desde REST ────────

revoke execute on function public.enforce_free_routine_limit()             from public, anon, authenticated;
revoke execute on function public.handle_new_user()                        from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()                        from public, anon, authenticated;
revoke execute on function public.set_updated_at()                         from public, anon, authenticated;
revoke execute on function public.update_updated_at_column()               from public, anon, authenticated;
revoke execute on function public.handle_updated_at()                      from public, anon, authenticated;
revoke execute on function public.consolidar_duplicados_slots(uuid)        from public, anon, authenticated;

-- ─── C) RPC validas: anon NUNCA, authenticated si ──────────────────────────

revoke execute on function public.finalizar_onboarding(
  text, integer, numeric, numeric, numeric, text, numeric, numeric, numeric, numeric, date
) from public, anon;

revoke execute on function public.actualizar_orden_comidas(uuid, uuid[]) from public, anon;
revoke execute on function public.asegurar_log_diario(uuid, date)        from public, anon;
revoke execute on function public.increment_food_popularity(uuid)        from public, anon;
revoke execute on function public.obtener_recientes_usuario(uuid)        from public, anon;

-- f_unaccent es helper SQL puro (no SECURITY DEFINER) usado en RLS/Indices.
-- No tocamos sus permisos para no romper queries indexadas.
