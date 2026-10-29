-- Bachelorarbeit: the citation style, free days (breaks) and milestones.
--
-- citation_style: how the reference list and the LaTeX export cite
-- ('apa' APA 7 DGPs, 'harvard' Autor-Jahr, 'deutsch' Fußnoten, 'ieee' numerisch).
-- Breaks are days off ("Weihnachten"), during which the module shows a
-- "Pause" notice instead of the to-dos. Milestones are dates to reach,
-- e.g. "Erster Entwurf", shown on the timeline and in the calendar.

alter table public.thesis_settings
  add column citation_style text not null default 'apa' check (citation_style in ('apa', 'harvard', 'deutsch', 'ieee'));

create table public.thesis_breaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index thesis_breaks_user_id_idx on public.thesis_breaks (user_id, start_date);

create table public.thesis_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  date date not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index thesis_milestones_user_id_idx on public.thesis_milestones (user_id, date);

alter table public.thesis_breaks enable row level security;
alter table public.thesis_milestones enable row level security;

grant select, insert, update, delete on public.thesis_breaks, public.thesis_milestones to authenticated;

create policy "thesis_breaks: own rows" on public.thesis_breaks
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('thesis')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('thesis')));

create policy "thesis_milestones: own rows" on public.thesis_milestones
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('thesis')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('thesis')));
