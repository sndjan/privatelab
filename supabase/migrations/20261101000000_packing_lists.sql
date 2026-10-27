-- Packliste, second version: instead of templates and dated runs, a list is
-- used like a note with checkboxes. You tick items while packing and reset
-- the list for the next time. Places and their inventory stay as they are.
-- The old tables are dropped with their data.

drop table if exists public.packing_run_items;
drop table if exists public.packing_runs;
drop table if exists public.packing_template_items;
drop table if exists public.packing_templates;

-- starred = shown as a big tile on the start page.
create table public.packing_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  starred boolean not null default false,
  created_at timestamptz not null default now()
);

create index packing_lists_user_id_idx on public.packing_lists (user_id);

create table public.packing_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  list_id uuid not null references public.packing_lists (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create index packing_sections_list_id_idx on public.packing_sections (list_id);

-- A chip is a toggle on a list (e.g. Gym, Regen). Items with an inactive chip
-- are collapsed at the bottom of the list.
create table public.packing_chips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  list_id uuid not null references public.packing_lists (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create index packing_chips_list_id_idx on public.packing_chips (list_id);

create table public.packing_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  list_id uuid not null references public.packing_lists (id) on delete cascade,
  section_id uuid not null references public.packing_sections (id) on delete cascade,
  chip_id uuid references public.packing_chips (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  note text check (char_length(note) <= 200),
  done boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create index packing_items_list_id_idx on public.packing_items (list_id);
create index packing_items_section_id_idx on public.packing_items (section_id);
create index packing_items_chip_id_idx on public.packing_items (chip_id);

alter table public.packing_lists enable row level security;
alter table public.packing_sections enable row level security;
alter table public.packing_chips enable row level security;
alter table public.packing_items enable row level security;

grant select, insert, update, delete on
  public.packing_lists,
  public.packing_sections,
  public.packing_chips,
  public.packing_items
to authenticated;

-- Rows that point at another row must point at the same user's row, and a
-- section or chip of an item must belong to the item's list.

create or replace function private.owns_packing_list(list uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.packing_lists l where l.id = list and l.user_id = (select auth.uid())
  );
$$;

create or replace function private.packing_section_in_list(section uuid, list uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.packing_sections s
    where s.id = section and s.list_id = list and s.user_id = (select auth.uid())
  );
$$;

create or replace function private.packing_chip_in_list(chip uuid, list uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select chip is null or exists (
    select 1 from public.packing_chips c
    where c.id = chip and c.list_id = list and c.user_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_packing_list(uuid) from public;
revoke all on function private.packing_section_in_list(uuid, uuid) from public;
revoke all on function private.packing_chip_in_list(uuid, uuid) from public;
grant execute on function private.owns_packing_list(uuid) to authenticated;
grant execute on function private.packing_section_in_list(uuid, uuid) to authenticated;
grant execute on function private.packing_chip_in_list(uuid, uuid) to authenticated;

create policy "packing_lists: own rows" on public.packing_lists
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('packing')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('packing')));

create policy "packing_sections: own rows" on public.packing_sections
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('packing')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('packing'))
    and private.owns_packing_list(list_id)
  );

create policy "packing_chips: own rows" on public.packing_chips
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('packing')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('packing'))
    and private.owns_packing_list(list_id)
  );

create policy "packing_items: own rows" on public.packing_items
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('packing')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('packing'))
    and private.packing_section_in_list(section_id, list_id)
    and private.packing_chip_in_list(chip_id, list_id)
  );
