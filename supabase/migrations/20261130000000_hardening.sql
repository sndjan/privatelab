-- Hardening after a security review. The app's server actions already clean
-- what they write, but every table can also be written straight through the
-- Data API by its owner, past those checks. These constraints close that gap.
--
-- "not valid": new and changed rows are checked right away, existing rows are
-- left alone, so the migration can't fail on old data.

-- Wunsch-Liste: guests open a wish's link and load its image on the public
-- share page, so both must be plain web addresses (no javascript:, data: …).
alter table public.wishlist_items
  add constraint wishlist_items_url_http check (url is null or url ~* '^https?://') not valid,
  add constraint wishlist_items_image_url_http check (image_url is null or image_url ~* '^https?://') not valid;

-- JSON columns without a size limit: keep a client from storing megabytes.
alter table public.kegel_settings
  add constraint kegel_settings_json_size check (pg_column_size(rates) <= 2000 and pg_column_size(nicknames) <= 20000) not valid;

alter table public.kegel_games
  add constraint kegel_games_json_size check (pg_column_size(rates) <= 2000 and pg_column_size(lines) <= 100000) not valid;

alter table public.waste_scans
  add constraint waste_scans_result_size check (pg_column_size(result) <= 20000) not valid;

alter table public.weight_circumferences
  add constraint weight_circumferences_values_size check (pg_column_size("values") <= 8000) not valid;
