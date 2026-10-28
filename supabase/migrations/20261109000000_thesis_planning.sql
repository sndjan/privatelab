-- Bachelorarbeit: people (picked as chips in protocols, appointments and
-- to-dos), appointments and deadlines apart from the to-dos (an appointment
-- can be linked to its protocol), general infos for the overview, and
-- priority and person on to-dos for the quick entry ("!1 @Sandra …").

create table public.thesis_people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- kind: 'appointment' (Termin, e.g. a meeting) or 'deadline' (e.g. Anmeldung,
-- Abgabe). time is optional. protocol_id: the protocol written for it.
create table public.thesis_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null default 'appointment' check (kind in ('appointment', 'deadline')),
  title text not null check (char_length(title) between 1 and 200),
  date date not null,
  time time,
  location text not null default '' check (char_length(location) <= 200),
  note text not null default '' check (char_length(note) <= 2000),
  person_ids uuid[] not null default '{}' check (cardinality(person_ids) <= 30),
  protocol_id uuid references public.thesis_protocols (id) on delete set null,
  created_at timestamptz not null default now()
);

create index thesis_events_user_id_idx on public.thesis_events (user_id, date);
create index thesis_events_protocol_id_idx on public.thesis_events (protocol_id);

-- Short facts for the overview, e.g. "Kolloquium spätestens 4 Wochen nach Abgabe".
create table public.thesis_infos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);

create index thesis_infos_user_id_idx on public.thesis_infos (user_id, created_at);

-- Participants as people; the old free text stays for what isn't a person.
alter table public.thesis_protocols
  add column person_ids uuid[] not null default '{}' check (cardinality(person_ids) <= 30);

-- priority: 1 (highest) to 3, null for none.
alter table public.thesis_todos
  add column priority smallint check (priority between 1 and 3),
  add column person_id uuid references public.thesis_people (id) on delete set null;

create index thesis_todos_person_id_idx on public.thesis_todos (person_id);

alter table public.thesis_people enable row level security;
alter table public.thesis_events enable row level security;
alter table public.thesis_infos enable row level security;

grant select, insert, update, delete on public.thesis_people, public.thesis_events, public.thesis_infos to authenticated;

create or replace function private.owns_thesis_person(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target is null or exists (
    select 1 from public.thesis_people p where p.id = target and p.user_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_thesis_person(uuid) from public;
grant execute on function private.owns_thesis_person(uuid) to authenticated;

create policy "thesis_people: own rows" on public.thesis_people
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('thesis')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('thesis')));

create policy "thesis_events: own rows" on public.thesis_events
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('thesis')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('thesis'))
    and private.owns_thesis_protocol(protocol_id)
  );

create policy "thesis_infos: own rows" on public.thesis_infos
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('thesis')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('thesis')));

-- To-dos may only point at the user's own person.
drop policy "thesis_todos: own rows" on public.thesis_todos;
create policy "thesis_todos: own rows" on public.thesis_todos
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('thesis')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('thesis'))
    and private.owns_thesis_phase(phase_id)
    and private.owns_thesis_protocol(protocol_id)
    and private.owns_thesis_person(person_id)
  );

-- Existing participants ("Sandra, Prof. Weber") become people and chips.
insert into public.thesis_people (user_id, name)
select distinct p.user_id, left(trim(part.name), 80)
from public.thesis_protocols p, regexp_split_to_table(p.participants, '\s*(,|;|\sund\s)\s*') as part (name)
where trim(part.name) <> ''
on conflict (user_id, name) do nothing;

update public.thesis_protocols p
set person_ids = coalesce((
      select array_agg(distinct person.id)
      from regexp_split_to_table(p.participants, '\s*(,|;|\sund\s)\s*') as part (name)
      join public.thesis_people person on person.user_id = p.user_id and person.name = left(trim(part.name), 80)
    ), '{}'),
    participants = ''
where p.participants <> '';
