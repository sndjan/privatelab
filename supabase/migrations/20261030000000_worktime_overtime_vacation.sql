-- Vacation blocks can be paid with overtime instead of vacation days.

alter table public.worktime_vacations
  add column from_overtime boolean not null default false;
