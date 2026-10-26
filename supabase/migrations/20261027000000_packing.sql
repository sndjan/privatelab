-- Packing list module ("Packliste"): places, reusable templates, dated runs
-- and an inventory of what is already at each place. Every user only sees
-- their own rows, and only with access to the 'packing' module.

insert into public.modules (id, name) values ('packing', 'Packliste')
on conflict (id) do nothing;

create table public.packing_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table public.packing_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  from_place_id uuid references public.packing_places (id) on delete set null,
  to_place_id uuid references public.packing_places (id) on delete set null,
  created_at timestamptz not null default now()
);

-- kind 'pack' = something to take along, 'task' = something to do before leaving.
-- An item with conditions only appears in runs that have all of them.
-- forgotten = flagged in the last finished run; pinned to the top of the next one.
create table public.packing_template_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  template_id uuid not null references public.packing_templates (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  note text check (char_length(note) <= 200),
  kind text not null default 'pack' check (kind in ('pack', 'task')),
  conditions text[] not null default '{}'
    check (conditions <@ array['winter', 'gym', 'tennis', 'rain', 'long', 'exams']),
  forgotten boolean not null default false,
  created_at timestamptz not null default now()
);

create index packing_template_items_template_id_idx on public.packing_template_items (template_id);

-- A run copies the template's items when it starts, so editing a template
-- never changes past runs.
create table public.packing_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  template_id uuid references public.packing_templates (id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  trip_date date not null,
  from_place_id uuid references public.packing_places (id) on delete set null,
  to_place_id uuid references public.packing_places (id) on delete set null,
  conditions text[] not null default '{}'
    check (conditions <@ array['winter', 'gym', 'tennis', 'rain', 'long', 'exams']),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index packing_runs_user_id_idx on public.packing_runs (user_id, trip_date desc);

-- pinned = was flagged as forgotten when the run started.
-- at_destination = already at the destination according to the inventory.
create table public.packing_run_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  run_id uuid not null references public.packing_runs (id) on delete cascade,
  template_item_id uuid references public.packing_template_items (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  note text check (char_length(note) <= 200),
  kind text not null default 'pack' check (kind in ('pack', 'task')),
  done boolean not null default false,
  forgotten boolean not null default false,
  pinned boolean not null default false,
  at_destination boolean not null default false,
  sort integer not null default 0
);

create index packing_run_items_run_id_idx on public.packing_run_items (run_id);

create table public.packing_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  place_id uuid not null references public.packing_places (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  quantity integer not null default 1 check (quantity between 0 and 999),
  created_at timestamptz not null default now()
);

create unique index packing_inventory_place_name_idx on public.packing_inventory (place_id, lower(name));

alter table public.packing_places enable row level security;
alter table public.packing_templates enable row level security;
alter table public.packing_template_items enable row level security;
alter table public.packing_runs enable row level security;
alter table public.packing_run_items enable row level security;
alter table public.packing_inventory enable row level security;

grant select, insert, update, delete on
  public.packing_places,
  public.packing_templates,
  public.packing_template_items,
  public.packing_runs,
  public.packing_run_items,
  public.packing_inventory
to authenticated;

-- Rows that point at another row must point at the same user's row.

create or replace function private.owns_packing_place(place uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select place is null or exists (
    select 1 from public.packing_places p where p.id = place and p.user_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_packing_place(uuid) from public;
grant execute on function private.owns_packing_place(uuid) to authenticated;

create policy "packing_places: own rows" on public.packing_places
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('packing')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('packing')));

create policy "packing_templates: own rows" on public.packing_templates
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('packing')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('packing'))
    and private.owns_packing_place(from_place_id)
    and private.owns_packing_place(to_place_id)
  );

create policy "packing_template_items: own rows" on public.packing_template_items
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('packing')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('packing'))
    and exists (
      select 1 from public.packing_templates t
      where t.id = template_id and t.user_id = (select auth.uid())
    )
  );

create policy "packing_runs: own rows" on public.packing_runs
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('packing')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('packing'))
    and private.owns_packing_place(from_place_id)
    and private.owns_packing_place(to_place_id)
    and (
      template_id is null or exists (
        select 1 from public.packing_templates t
        where t.id = template_id and t.user_id = (select auth.uid())
      )
    )
  );

create policy "packing_run_items: own rows" on public.packing_run_items
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('packing')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('packing'))
    and exists (
      select 1 from public.packing_runs r
      where r.id = run_id and r.user_id = (select auth.uid())
    )
  );

create policy "packing_inventory: own rows" on public.packing_inventory
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('packing')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('packing'))
    and private.owns_packing_place(place_id)
  );
