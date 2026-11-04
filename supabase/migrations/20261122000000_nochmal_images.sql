-- Noch-mal-Blätter: own pictures for the stars, golden dice and diamonds, and
-- a background for the sheet (cropped or drawn in the browser).
--
-- A public bucket, like the Wunsch-Liste images: the file names are random and
-- printed sheets load them without a signed URL. Users upload into a folder
-- named after their user id, only with access to the 'nochmal' module. The
-- sheets keep the public URLs in data.art.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nochmal-images', 'nochmal-images', true, 2097152, '{image/webp,image/jpeg,image/png}')
on conflict (id) do nothing;

create policy "nochmal-images: read own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'nochmal-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "nochmal-images: upload own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'nochmal-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.has_module_access('nochmal'))
  );

create policy "nochmal-images: delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'nochmal-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
