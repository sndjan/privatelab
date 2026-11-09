-- Tennistraining: plan Midcourt (Play+Stay Orange) groups properly.
--
-- tennis_exercises.stages: the Play+Stay stages an exercise is made for
-- ('red', 'orange', 'green', 'yellow'); '{}' = any. "Stunde planen" prefers
-- exercises made for the group's stage.
-- tennis_groups.serves: false while the kids don't serve yet; exercises with
-- the focus "Aufschlag" are left out when planning.
-- tennis_groups.games_between: short playful games between the technique
-- blocks instead of one game at the end.

alter table public.tennis_exercises
  add column stages text[] not null default '{}'
    check (stages <@ array['red', 'orange', 'green', 'yellow']::text[]);

alter table public.tennis_groups
  add column serves boolean not null default true,
  add column games_between boolean not null default false;
