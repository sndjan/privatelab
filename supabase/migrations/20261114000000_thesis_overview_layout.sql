-- Bachelorarbeit: the Überblick as the user arranged it, e.g.
-- { "top": ["timeframe", "stats"], "left": ["todos"], "right": ["topic"], "hidden": ["log"] }.
-- null is the default layout; unknown or missing cards are sorted out in the app.
alter table public.thesis_settings
  add column overview_layout jsonb
    check (overview_layout is null or (jsonb_typeof(overview_layout) = 'object' and pg_column_size(overview_layout) <= 4000));
