-- Thesis module ("Bachelorarbeit"): topic and time frame, phases, to-dos,
-- a work log with hours, sources with the fields APA 7 needs, and meeting
-- protocols. It only stores what the user enters (no AI). Every user only
-- sees their own rows, and only with access to the 'thesis' module.

insert into public.modules (id, name) values ('thesis', 'Bachelorarbeit')
on conflict (id) do nothing;

-- One row per user. start_date and end_date stay empty until the user sets them.
create table public.thesis_settings (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 300),
  research_question text not null default '' check (char_length(research_question) <= 2000),
  supervisors text not null default '' check (char_length(supervisors) <= 300),
  university text not null default '' check (char_length(university) <= 200),
  company text not null default '' check (char_length(company) <= 200),
  start_date date,
  end_date date,
  updated_at timestamptz not null default now(),
  check (start_date is null or end_date is null or end_date >= start_date)
);

create table public.thesis_phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index thesis_phases_user_id_idx on public.thesis_phases (user_id, start_date);

create table public.thesis_protocols (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  date date not null,
  title text not null check (char_length(title) between 1 and 120),
  participants text not null default '' check (char_length(participants) <= 300),
  -- Markdown.
  body text not null default '' check (char_length(body) <= 50000),
  created_at timestamptz not null default now()
);

create index thesis_protocols_user_id_idx on public.thesis_protocols (user_id, date desc);

-- protocol_id: the meeting the to-do came from. done_on: when it was ticked off.
create table public.thesis_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  note text not null default '' check (char_length(note) <= 2000),
  deadline date,
  phase_id uuid references public.thesis_phases (id) on delete set null,
  protocol_id uuid references public.thesis_protocols (id) on delete set null,
  done_on date,
  created_at timestamptz not null default now()
);

create index thesis_todos_user_id_idx on public.thesis_todos (user_id);
create index thesis_todos_phase_id_idx on public.thesis_todos (phase_id);
create index thesis_todos_protocol_id_idx on public.thesis_todos (protocol_id);

create table public.thesis_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null,
  hours numeric(4, 2) not null check (hours > 0 and hours <= 24),
  text text not null check (char_length(text) between 1 and 2000),
  phase_id uuid references public.thesis_phases (id) on delete set null,
  created_at timestamptz not null default now()
);

create index thesis_log_user_id_idx on public.thesis_log (user_id, day desc);
create index thesis_log_phase_id_idx on public.thesis_log (phase_id);

-- Formatted as APA 7 (German) and BibLaTeX (biblatex-apa) in
-- src/modules/thesis/cite.ts. authors and editors: one entry each, persons as
-- "Nachname, Vorname", organizations without a comma. container: site name
-- (web), journal (article), book title (chapter). publisher: publisher (book,
-- chapter) or publisher / organization (software).
create table public.thesis_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('web', 'article', 'book', 'chapter', 'software')),
  citation_key text not null check (citation_key ~ '^[A-Za-z0-9_:.-]{1,60}$'),
  status text not null default 'found' check (status in ('found', 'read', 'cited')),
  authors text[] not null default '{}' check (cardinality(authors) <= 50),
  editors text[] not null default '{}' check (cardinality(editors) <= 20),
  year integer check (year between 1000 and 2200),
  month integer check (month between 1 and 12),
  day integer check (day between 1 and 31),
  title text not null check (char_length(title) between 1 and 500),
  container text not null default '' check (char_length(container) <= 300),
  volume text not null default '' check (char_length(volume) <= 20),
  issue text not null default '' check (char_length(issue) <= 20),
  pages text not null default '' check (char_length(pages) <= 30),
  edition text not null default '' check (char_length(edition) <= 20),
  version text not null default '' check (char_length(version) <= 40),
  publisher text not null default '' check (char_length(publisher) <= 200),
  doi text not null default '' check (char_length(doi) <= 200),
  url text not null default '' check (char_length(url) <= 2000),
  accessed date,
  notes text not null default '' check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  unique (user_id, citation_key)
);

alter table public.thesis_settings enable row level security;
alter table public.thesis_phases enable row level security;
alter table public.thesis_protocols enable row level security;
alter table public.thesis_todos enable row level security;
alter table public.thesis_log enable row level security;
alter table public.thesis_sources enable row level security;

grant select, insert, update, delete on
  public.thesis_settings,
  public.thesis_phases,
  public.thesis_protocols,
  public.thesis_todos,
  public.thesis_log,
  public.thesis_sources
to authenticated;

-- Rows that point at another row must point at the same user's row.

create or replace function private.owns_thesis_phase(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target is null or exists (
    select 1 from public.thesis_phases p where p.id = target and p.user_id = (select auth.uid())
  );
$$;

create or replace function private.owns_thesis_protocol(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target is null or exists (
    select 1 from public.thesis_protocols p where p.id = target and p.user_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_thesis_phase(uuid) from public;
revoke all on function private.owns_thesis_protocol(uuid) from public;
grant execute on function private.owns_thesis_phase(uuid) to authenticated;
grant execute on function private.owns_thesis_protocol(uuid) to authenticated;

create policy "thesis_settings: own row" on public.thesis_settings
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('thesis')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('thesis')));

create policy "thesis_phases: own rows" on public.thesis_phases
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('thesis')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('thesis')));

create policy "thesis_protocols: own rows" on public.thesis_protocols
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('thesis')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('thesis')));

create policy "thesis_todos: own rows" on public.thesis_todos
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('thesis')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('thesis'))
    and private.owns_thesis_phase(phase_id)
    and private.owns_thesis_protocol(protocol_id)
  );

create policy "thesis_log: own rows" on public.thesis_log
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('thesis')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('thesis'))
    and private.owns_thesis_phase(phase_id)
  );

create policy "thesis_sources: own rows" on public.thesis_sources
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('thesis')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('thesis')));
