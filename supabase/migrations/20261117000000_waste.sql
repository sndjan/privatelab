-- Mülltrenn-Hilfe: choose where you live, see the local waste rules, take a
-- photo of a thing and the AI says which bin it goes in.
--
-- waste_rules is a shared cache: one row per municipality (Gemeinde/Stadt)
-- with the local differences to the national baseline (src/modules/waste/
-- bins.ts), looked up once by Claude with web search. Everyone with access to
-- the module reads it; only the server writes it (secret key), after checking
-- that the caller may (first lookup: any user of the module; refresh and
-- edits: admins).
--
-- waste_places are a user's saved places ("Zuhause", "Bei den Eltern"); the
-- one with the latest selected_at is the current one. waste_scans is the
-- user's history with a small thumbnail in the private 'waste-thumbs' bucket.

insert into public.modules (id, name) values ('waste', 'Mülltrenn-Hilfe')
on conflict (id) do nothing;

-- key: "<bundesland>|<landkreis or kreisfreie stadt>|<gemeinde>", lower case.
-- status: pending while the lookup runs (started_at), ready, or failed.
-- rules: LocalRules from src/modules/waste/bins.ts, sources: [{title, url}].
create table public.waste_rules (
  key text primary key check (char_length(key) between 3 and 300),
  name text not null check (char_length(name) between 1 and 120),
  district text not null default '' check (char_length(district) <= 120),
  state text not null default '' check (char_length(state) <= 60),
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  rules jsonb,
  sources jsonb not null default '[]',
  error text check (char_length(error) <= 500),
  started_at timestamptz not null default now(),
  fetched_at timestamptz,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.waste_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  label text not null default '' check (char_length(label) <= 40),
  rules_key text not null references public.waste_rules (key),
  name text not null check (char_length(name) between 1 and 120),
  district text not null default '' check (char_length(district) <= 120),
  state text not null default '' check (char_length(state) <= 60),
  postcode text not null default '' check (char_length(postcode) <= 10),
  selected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index waste_places_user_id_idx on public.waste_places (user_id);
create index waste_places_rules_key_idx on public.waste_places (rules_key);

-- input: what the user typed or corrected. result: Verdict from
-- src/modules/waste/bins.ts. thumb_path: path in the 'waste-thumbs' bucket.
create table public.waste_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  place_id uuid references public.waste_places (id) on delete set null,
  place_name text not null default '' check (char_length(place_name) <= 120),
  input text not null default '' check (char_length(input) <= 1000),
  result jsonb not null,
  thumb_path text check (char_length(thumb_path) <= 200),
  created_at timestamptz not null default now()
);

create index waste_scans_user_id_created_at_idx on public.waste_scans (user_id, created_at desc);
create index waste_scans_place_id_idx on public.waste_scans (place_id);

alter table public.waste_rules enable row level security;
alter table public.waste_places enable row level security;
alter table public.waste_scans enable row level security;

grant select on public.waste_rules to authenticated;
grant select, insert, update, delete on public.waste_places, public.waste_scans to authenticated;

create policy "waste_rules: read with module access" on public.waste_rules
  for select to authenticated
  using ((select private.has_module_access('waste')));

create policy "waste_places: own rows" on public.waste_places
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('waste')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('waste')));

create policy "waste_scans: own rows" on public.waste_scans
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('waste')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('waste')));

-- Thumbnails: private bucket, one folder per user. The app shows them with
-- short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('waste-thumbs', 'waste-thumbs', false, 204800, '{image/webp,image/jpeg}')
on conflict (id) do nothing;

create policy "waste-thumbs: read own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'waste-thumbs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "waste-thumbs: upload own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'waste-thumbs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.has_module_access('waste'))
  );

create policy "waste-thumbs: delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'waste-thumbs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
