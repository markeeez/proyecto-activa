-- Bucket `avatars` es publico via getPublicUrl(); no necesita policy SELECT abierta.
-- La policy actual permite que cualquier cliente liste todo el bucket. Bloqueamos eso.
-- Mantenemos: INSERT/UPDATE del propietario, anadimos DELETE del propietario.

drop policy if exists "Avatar público para todos" on storage.objects;

-- DELETE: solo el dueno puede borrar su propio avatar
drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- SELECT minimo para que el dueno pueda comprobar si su archivo existe (no para listar el bucket).
drop policy if exists "avatars_owner_select" on storage.objects;
create policy "avatars_owner_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
