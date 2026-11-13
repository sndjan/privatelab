-- Vacation in hours instead of days. Each work time model earns vacation per
-- month, either by the rule max(contract, law) / 12 with
--   contract = vacation_contract_days × hours per workday
--   law      = 4 weeks × weekly hours (BUrlG minimum)
-- or as a fixed number of hours per month (vacation_hours_per_month, null =
-- use the rule). A vacation day uses the target hours of that day.
-- carryover_expires: unused vacation from the previous year expires after
-- 31.03. (otherwise it stays, e.g. without a notice from the employer).
-- vacation_days_per_month is no longer used.

alter table public.worktime_periods
  add column vacation_contract_days numeric(5, 2) not null default 12 check (vacation_contract_days between 0 and 60),
  add column vacation_hours_per_month numeric(6, 2) check (vacation_hours_per_month between 0 and 100);

alter table public.worktime_settings
  add column carryover_expires boolean not null default false;
