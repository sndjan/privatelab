-- Noch-mal-Blätter: a sticker library everyone with access to the module can
-- use. One row per shared picture (its public URL in the nochmal-images
-- bucket and its height/width ratio); placing it on a sheet copies it into
-- the sheet's own data.stickers. Everyone with access sees the library; only
-- the uploader (or an admin) removes a sticker from it. Removing it keeps the
-- file, so sheets that use it stay as they are.

create table public.nochmal_stickers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  url text not null check (char_length(url) <= 300),
  ratio real not null check (ratio between 0.1 and 10),
  created_at timestamptz not null default now(),
  unique (url)
);

create index nochmal_stickers_created_at_idx on public.nochmal_stickers (created_at desc);

alter table public.nochmal_stickers enable row level security;

grant select, insert, delete on public.nochmal_stickers to authenticated;

create policy "nochmal_stickers: read with access" on public.nochmal_stickers
  for select to authenticated
  using ((select private.has_module_access('nochmal')));

create policy "nochmal_stickers: add own" on public.nochmal_stickers
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select private.has_module_access('nochmal')));

create policy "nochmal_stickers: remove own or admin" on public.nochmal_stickers
  for delete to authenticated
  using (((select auth.uid()) = user_id or (select private.is_admin())) and (select private.has_module_access('nochmal')));
