-- Mülltrenn-Hilfe: what each AI request cost (estimate from the token usage
-- the API reports, in US dollars, see costOf in src/modules/waste/ai.ts).
-- waste_scans.cost_usd adds up a scan and its corrections; waste_rules.cost_usd
-- is the last lookup (null: entered by hand, no AI cost).

alter table public.waste_scans add column cost_usd numeric(10, 5) check (cost_usd >= 0);
alter table public.waste_rules add column cost_usd numeric(10, 5) check (cost_usd >= 0);
