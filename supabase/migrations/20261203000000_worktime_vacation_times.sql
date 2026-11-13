-- Vacation from a date and time to a date and time: start_minute on
-- start_date, end_minute on end_date (minutes since midnight, null = the whole
-- day). Each day counts the part of its standard work time inside, without
-- the standard break, which starts at break_start_minute.
-- scope and day_minutes (20261202000000) are no longer used.

alter table public.worktime_vacations
  add column start_minute integer check (start_minute between 0 and 1439),
  add column end_minute integer check (end_minute between 1 and 1440);

alter table public.worktime_settings
  add column break_start_minute integer not null default 720 check (break_start_minute between 0 and 1439);
