-- FIRE module: an optional, user-set FIRE number. When null, the FIRE number
-- is yearly expenses divided by the withdrawal rate.

alter table public.fire_settings
  add column target numeric(14, 2) check (target is null or target > 0);
