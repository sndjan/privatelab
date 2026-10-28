-- Tennistraining: players per group (name, gender), the weekday a group
-- trains on, holidays without training, who cancelled a session, and for how
-- many kids an exercise works, so a session can be re-planned at short notice.

alter table public.tennis_groups
  add column weekday smallint check (weekday between 1 and 7);

alter table public.tennis_exercises
  add column players_min smallint check (players_min between 1 and 30),
  add column players_max smallint check (players_max between 1 and 30),
  add constraint tennis_exercises_players_range check (players_min is null or players_max is null or players_min <= players_max);

-- Players of the group who cancelled this session.
alter table public.tennis_sessions
  add column absent uuid[] not null default '{}' check (cardinality(absent) <= 60);

-- gender: 'm' (Junge), 'f' (Mädchen) or null.
create table public.tennis_players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  group_id uuid not null references public.tennis_groups (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  gender text check (gender in ('m', 'f')),
  created_at timestamptz not null default now()
);

create index tennis_players_user_id_idx on public.tennis_players (user_id);
create index tennis_players_group_id_idx on public.tennis_players (group_id);

create table public.tennis_holidays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 60),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index tennis_holidays_user_id_idx on public.tennis_holidays (user_id, start_date);

alter table public.tennis_players enable row level security;
alter table public.tennis_holidays enable row level security;

grant select, insert, update, delete on public.tennis_players, public.tennis_holidays to authenticated;

create policy "tennis_players: own rows" on public.tennis_players
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('tennis')))
  with check (
    (select auth.uid()) = user_id
    and (select private.has_module_access('tennis'))
    and private.owns_tennis_group(group_id)
  );

create policy "tennis_holidays: own rows" on public.tennis_holidays
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('tennis')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('tennis')));

-- Exercises from the starter collection that are already loaded get the same
-- player ranges as new ones (src/modules/tennis/starter.ts), unless changed.
update public.tennis_exercises e
set players_min = v.players_min, players_max = v.players_max
from (values
  ('Linien-Alarm', 2, null),
  ('Eierlauf-Staffel', 4, null),
  ('Partner-Werfen übers Netz', 2, null),
  ('Linienfangen', 3, null),
  ('Spiegelbild', 2, null),
  ('Hütchen umdrehen', 4, null),
  ('Mini-Tennis einspielen', 2, null),
  ('Pendel: Vorhand – Rückhand', null, 6),
  ('Volley-Reihe', 2, 8),
  ('Rein, Schlag, Volley, Raus', null, 6),
  ('Hinter die T-Linie', 2, null),
  ('Stationen-Zirkel', 3, null),
  ('Cross-Duell', 4, null),
  ('Hütchen-Sprint mit Schlag', null, 8),
  ('Return-Schlange', null, 8),
  ('Rundlauf', 3, null),
  ('König des Platzes', 3, null),
  ('Ziel-Bingo', 4, null),
  ('Dosen abräumen', 4, null),
  ('Trainer-Doppel', 4, null),
  ('Bälle sammeln', 4, null),
  ('Volley-Duell', 4, null),
  ('Ballwechsel-Rekord', 2, null),
  ('Auf- und Absteiger', 4, null),
  ('Burg verteidigen', 2, null),
  ('Ballsammel-Rennen', 4, null)
) as v (name, players_min, players_max)
where e.name = v.name and e.players_min is null and e.players_max is null;
