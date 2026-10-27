-- Public holidays of Baden-Württemberg ('BW') or Bayern ('BY').

alter table public.worktime_settings
  add column holiday_state text not null default 'BW' check (holiday_state in ('BW', 'BY'));
