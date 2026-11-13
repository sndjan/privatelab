-- Partial vacation: scope 'full' (whole days), 'half' (half of each day's
-- target) or 'hours' (day_minutes per day). The rest of the day is work.

alter table public.worktime_vacations
  add column scope text not null default 'full' check (scope in ('full', 'half', 'hours')),
  add column day_minutes integer check (day_minutes between 1 and 960),
  add check (scope <> 'hours' or day_minutes is not null);
