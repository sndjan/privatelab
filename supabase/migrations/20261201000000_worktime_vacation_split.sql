-- A vacation block can be paid partly with overtime: overtime_minutes of it
-- come from overtime (used up from the first day on), the rest from vacation.
-- from_overtime = true still means the whole block is paid with overtime.

alter table public.worktime_vacations
  add column overtime_minutes integer not null default 0 check (overtime_minutes between 0 and 120000);
