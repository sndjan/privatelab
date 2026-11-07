-- Gewicht-Challenge: a weight challenge between friends, shared by everyone
-- with access to the 'weight' module.
--
-- Unlike the other modules, rows are not per user: everyone with access sees
-- every participant and may enter or fix measurements for anyone. Only admins
-- change the setup (challenge, participants, measuring points).
--
-- weight_settings: the one challenge (title, start, end).
-- weight_participants: who competes, with start and goal weight (a goal above
--   the start weight means gaining) and an optional linked account, so the
--   entry form preselects the person.
-- weight_sites: the circumference measuring points. Sided points (Wade) take
--   a left and a right value, stored as "<key>.l" and "<key>.r".
-- weight_entries: one weighing per participant and day, with optional body
--   fat (%), muscle mass and fat-free mass (kg).
-- weight_circumferences: one set of circumferences per participant and day,
--   as {"<site key>": cm}.
--
-- The seed data is the challenge from the former static page (daten.js).

insert into public.modules (id, name) values ('weight', 'Gewicht-Challenge')
on conflict (id) do nothing;

create table public.weight_settings (
  id smallint primary key default 1 check (id = 1),
  title text not null default 'Challenge' check (char_length(title) between 1 and 60),
  start_date date not null,
  end_date date not null,
  constraint weight_settings_dates check (end_date > start_date)
);

create table public.weight_participants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 30),
  color text not null default 'blue'
    check (color in ('red', 'orange', 'yellow', 'green', 'teal', 'blue', 'violet', 'pink', 'gray')),
  start_weight numeric(5, 2) not null check (start_weight between 20 and 400),
  goal_weight numeric(5, 2) not null check (goal_weight between 20 and 400),
  user_id uuid unique references public.profiles (id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.weight_sites (
  key text primary key check (key ~ '^[a-z0-9_-]{1,30}$'),
  label text not null check (char_length(label) between 1 and 30),
  sided boolean not null default false,
  active boolean not null default true,
  position integer not null default 0
);

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.weight_participants (id) on delete cascade,
  date date not null,
  weight numeric(5, 2) not null check (weight between 20 and 400),
  body_fat numeric(4, 1) check (body_fat between 1 and 80),
  muscle_mass numeric(5, 2) check (muscle_mass between 5 and 300),
  fat_free_mass numeric(5, 2) check (fat_free_mass between 5 and 300),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, date)
);

create table public.weight_circumferences (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.weight_participants (id) on delete cascade,
  date date not null,
  "values" jsonb not null default '{}' check (jsonb_typeof("values") = 'object'),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, date)
);

create index weight_entries_date_idx on public.weight_entries (date desc);
create index weight_circumferences_date_idx on public.weight_circumferences (date desc);
create index weight_entries_created_by_idx on public.weight_entries (created_by);
create index weight_entries_updated_by_idx on public.weight_entries (updated_by);
create index weight_circumferences_created_by_idx on public.weight_circumferences (created_by);
create index weight_circumferences_updated_by_idx on public.weight_circumferences (updated_by);

alter table public.weight_settings enable row level security;
alter table public.weight_participants enable row level security;
alter table public.weight_sites enable row level security;
alter table public.weight_entries enable row level security;
alter table public.weight_circumferences enable row level security;

grant select, insert, update, delete on public.weight_settings to authenticated;
grant select, insert, update, delete on public.weight_participants to authenticated;
grant select, insert, update, delete on public.weight_sites to authenticated;
grant select, insert, update, delete on public.weight_entries to authenticated;
grant select, insert, update, delete on public.weight_circumferences to authenticated;

-- Setup: everyone with access reads it, only admins change it.
create policy "weight_settings: read with access" on public.weight_settings
  for select to authenticated using ((select private.has_module_access('weight')));
create policy "weight_settings: admins write" on public.weight_settings
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "weight_participants: read with access" on public.weight_participants
  for select to authenticated using ((select private.has_module_access('weight')));
create policy "weight_participants: admins write" on public.weight_participants
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "weight_sites: read with access" on public.weight_sites
  for select to authenticated using ((select private.has_module_access('weight')));
create policy "weight_sites: admins write" on public.weight_sites
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Measurements: everyone with access reads and writes all of them.
create policy "weight_entries: everyone with access" on public.weight_entries
  for all to authenticated
  using ((select private.has_module_access('weight')))
  with check ((select private.has_module_access('weight')));

create policy "weight_circumferences: everyone with access" on public.weight_circumferences
  for all to authenticated
  using ((select private.has_module_access('weight')))
  with check ((select private.has_module_access('weight')));

-- Who changed a measurement last is set by the database, not the browser.
create or replace function private.weight_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  else
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger weight_entries_touch before insert or update on public.weight_entries
  for each row execute function private.weight_touch();
create trigger weight_circumferences_touch before insert or update on public.weight_circumferences
  for each row execute function private.weight_touch();

-- ---------------------------------------------------------------------------
-- Seed: the challenge from daten.js. Benjamin's weighing dated 2026-08-13
-- (between 06.09. and 17.09.) is taken as 2026-09-13.
-- ---------------------------------------------------------------------------

insert into public.weight_sites (key, label, sided, position) values
  ('brust', 'Brust', false, 0),
  ('schulter', 'Schulter', false, 1),
  ('bauch', 'Bauch', false, 2),
  ('taille', 'Taille', false, 3),
  ('oberschenkel', 'Oberschenkel', true, 4),
  ('wade', 'Wade', true, 5),
  ('bizeps', 'Bizeps', true, 6),
  ('unterarm', 'Unterarm', true, 7);

insert into public.weight_settings (id, title, start_date, end_date) values (1, 'Weight Challenge', '2026-07-13', '2027-01-01');

insert into public.weight_participants (id, name, color, start_weight, goal_weight, position)
values ('00000000-0000-4000-8000-000000000001', 'Waleria', 'orange', 73.7, 65, 0);
insert into public.weight_entries (participant_id, date, weight, body_fat, muscle_mass, fat_free_mass) values
  ('00000000-0000-4000-8000-000000000001', '2026-09-19', 73.7, 28.9, 49.2, 52.4),
  ('00000000-0000-4000-8000-000000000001', '2026-09-27', 73.5, null, null, null),
  ('00000000-0000-4000-8000-000000000001', '2026-10-11', 74, null, null, null),
  ('00000000-0000-4000-8000-000000000001', '2026-10-18', 73.8, 28.9, 49.3, 52.5);
insert into public.weight_circumferences (participant_id, date, "values") values
  ('00000000-0000-4000-8000-000000000001', '2026-09-19', '{"schulter":107,"bauch":92.3,"taille":86.8,"oberschenkel.l":55,"oberschenkel.r":54.9,"wade.l":38.6,"wade.r":38.9,"bizeps.l":30.1,"bizeps.r":31.3,"unterarm.l":25.8,"unterarm.r":26}'),
  ('00000000-0000-4000-8000-000000000001', '2026-10-18', '{"schulter":107.3,"bauch":92.7,"taille":87.1,"oberschenkel.l":55.8,"oberschenkel.r":54.2,"wade.l":39.1,"wade.r":39,"bizeps.l":30.8,"bizeps.r":30.7,"unterarm.l":25.6,"unterarm.r":25.6}');

insert into public.weight_participants (id, name, color, start_weight, goal_weight, position)
values ('00000000-0000-4000-8000-000000000002', 'Benjamin', 'green', 115.8, 105, 1);
insert into public.weight_entries (participant_id, date, weight, body_fat, muscle_mass, fat_free_mass) values
  ('00000000-0000-4000-8000-000000000002', '2026-07-13', 115.8, 32.5, 73.23, 78.17),
  ('00000000-0000-4000-8000-000000000002', '2026-07-26', 113.9, null, null, null),
  ('00000000-0000-4000-8000-000000000002', '2026-08-03', 114.6, null, null, null),
  ('00000000-0000-4000-8000-000000000002', '2026-08-09', 113.8, null, null, null),
  ('00000000-0000-4000-8000-000000000002', '2026-08-18', 113.4, 31.9, 73.37, 77.23),
  ('00000000-0000-4000-8000-000000000002', '2026-08-23', 114.5, null, null, null),
  ('00000000-0000-4000-8000-000000000002', '2026-08-30', 113.5, null, null, null),
  ('00000000-0000-4000-8000-000000000002', '2026-09-06', 112.3, null, null, null),
  ('00000000-0000-4000-8000-000000000002', '2026-09-13', 112, null, null, null),
  ('00000000-0000-4000-8000-000000000002', '2026-09-17', 112.2, 31.6, 72.93, 76.74),
  ('00000000-0000-4000-8000-000000000002', '2026-09-20', 111.1, null, null, null),
  ('00000000-0000-4000-8000-000000000002', '2026-09-27', 110.6, null, null, null),
  ('00000000-0000-4000-8000-000000000002', '2026-10-03', 111, null, null, null),
  ('00000000-0000-4000-8000-000000000002', '2026-10-11', 108.7, null, null, null),
  ('00000000-0000-4000-8000-000000000002', '2026-10-18', 108.1, 30.4, 71.45, 75.24);
insert into public.weight_circumferences (participant_id, date, "values") values
  ('00000000-0000-4000-8000-000000000002', '2026-07-13', '{"brust":115,"schulter":129.6,"bauch":112.8,"taille":107.4,"oberschenkel.l":69.4,"oberschenkel.r":67.6,"wade.l":45.8,"wade.r":44.5,"bizeps.l":37,"bizeps.r":38.3,"unterarm.l":31.7,"unterarm.r":33.6}'),
  ('00000000-0000-4000-8000-000000000002', '2026-08-18', '{"brust":116.8,"schulter":128.5,"bauch":113.2,"taille":103,"oberschenkel.l":65.9,"oberschenkel.r":64.7,"wade.l":46.5,"wade.r":45,"bizeps.l":36.8,"bizeps.r":39.4,"unterarm.l":31.6,"unterarm.r":33.4}'),
  ('00000000-0000-4000-8000-000000000002', '2026-09-17', '{"brust":116.2,"schulter":127.8,"bauch":114.8,"taille":105.2,"oberschenkel.l":63.1,"oberschenkel.r":64.8,"wade.l":45.9,"wade.r":45.2,"bizeps.l":36.3,"bizeps.r":38.3,"unterarm.l":31.7,"unterarm.r":33.9}'),
  ('00000000-0000-4000-8000-000000000002', '2026-10-18', '{"brust":114.6,"schulter":130.5,"bauch":110.3,"taille":102.5,"oberschenkel.l":62.8,"oberschenkel.r":64.1,"wade.l":44.8,"wade.r":44,"bizeps.l":36,"bizeps.r":37.2,"unterarm.l":31.5,"unterarm.r":33.7}');

insert into public.weight_participants (id, name, color, start_weight, goal_weight, position)
values ('00000000-0000-4000-8000-000000000003', 'Jan', 'blue', 83.8, 90, 2);
insert into public.weight_entries (participant_id, date, weight, body_fat, muscle_mass, fat_free_mass) values
  ('00000000-0000-4000-8000-000000000003', '2026-07-13', 83.8, 22.1, 62.01, 65.28),
  ('00000000-0000-4000-8000-000000000003', '2026-07-26', 84.8, null, null, null),
  ('00000000-0000-4000-8000-000000000003', '2026-08-02', 85.9, null, null, null),
  ('00000000-0000-4000-8000-000000000003', '2026-08-10', 85, null, null, null),
  ('00000000-0000-4000-8000-000000000003', '2026-08-18', 86.4, 23.2, 63.07, 66.36),
  ('00000000-0000-4000-8000-000000000003', '2026-08-23', 86.9, null, null, null),
  ('00000000-0000-4000-8000-000000000003', '2026-08-31', 86.7, null, null, null),
  ('00000000-0000-4000-8000-000000000003', '2026-09-07', 86.8, null, null, null),
  ('00000000-0000-4000-8000-000000000003', '2026-09-13', 88.2, null, null, null),
  ('00000000-0000-4000-8000-000000000003', '2026-09-18', 89.1, 21.2, 63.94, 67.32),
  ('00000000-0000-4000-8000-000000000003', '2026-09-27', 87.4, null, null, null),
  ('00000000-0000-4000-8000-000000000003', '2026-10-11', 87.3, null, null, null),
  ('00000000-0000-4000-8000-000000000003', '2026-10-18', 87.3, 23.6, 63.42, 66.74);
insert into public.weight_circumferences (participant_id, date, "values") values
  ('00000000-0000-4000-8000-000000000003', '2026-07-13', '{"brust":96.5,"schulter":119,"bauch":85.4,"taille":82.1,"oberschenkel.l":53.2,"oberschenkel.r":52,"wade.l":38.6,"wade.r":37.4,"bizeps.l":31.8,"bizeps.r":32.7,"unterarm.l":28.4,"unterarm.r":29.1}'),
  ('00000000-0000-4000-8000-000000000003', '2026-08-18', '{"brust":99.6,"schulter":121.1,"bauch":89.4,"taille":84.3,"oberschenkel.l":55.2,"oberschenkel.r":54.2,"wade.l":39.6,"wade.r":38.3,"bizeps.l":33,"bizeps.r":33.1,"unterarm.l":29.1,"unterarm.r":29.8}'),
  ('00000000-0000-4000-8000-000000000003', '2026-09-17', '{"brust":103.9,"schulter":120.4,"bauch":91.5,"taille":86.3,"oberschenkel.l":55.1,"oberschenkel.r":56.8,"wade.l":40.5,"wade.r":39.4,"bizeps.l":32.2,"bizeps.r":32.6,"unterarm.l":29.1,"unterarm.r":29.8}'),
  ('00000000-0000-4000-8000-000000000003', '2026-10-18', '{"brust":103.1,"schulter":121,"bauch":90.4,"taille":83.7,"oberschenkel.l":57.8,"oberschenkel.r":56.9,"wade.l":39.9,"wade.r":38.3,"bizeps.l":32.2,"bizeps.r":32.9,"unterarm.l":28.9,"unterarm.r":29.8}');
