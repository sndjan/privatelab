-- Noch-mal-Blätter: own score sheets for the dice game "Noch mal!",
-- generated, adjusted by hand and printed.
--
-- One row per sheet. data is the whole sheet as JSON (Sheet in
-- src/modules/nochmal/data.ts: grid size, start column, the colour of every
-- box, the stars and the points); the server cleans it before every write.

insert into public.modules (id, name) values ('nochmal', 'Noch-mal-Blätter')
on conflict (id) do nothing;

create table public.nochmal_sheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nochmal_sheets_data_size check (pg_column_size(data) <= 50000)
);

create index nochmal_sheets_user_id_updated_at_idx on public.nochmal_sheets (user_id, updated_at desc);

alter table public.nochmal_sheets enable row level security;

grant select, insert, update, delete on public.nochmal_sheets to authenticated;

create policy "nochmal_sheets: own rows" on public.nochmal_sheets
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('nochmal')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('nochmal')));
