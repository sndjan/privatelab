-- Bachelorarbeit: a page target for the progress estimate, a short
-- description per source (shown when citing) and comments on sections.

-- target_pages: the required length; words_per_page turns words into pages
-- for the estimate (about 300 for 12pt on A4 with 1.5 line spacing).
alter table public.thesis_settings
  add column target_pages integer check (target_pages between 1 and 1000),
  add column words_per_page integer not null default 300 check (words_per_page between 50 and 1000);

-- What the source is about, in a few words, for finding it again.
alter table public.thesis_sources
  add column summary text not null default '' check (char_length(summary) <= 300);

-- Comments on a section: [{ "id": "…", "text": "…", "createdAt": "…", "resolved": false }].
-- Saved with the section like its text, so they follow its access rules.
alter table public.thesis_sections
  add column comments jsonb not null default '[]'
    check (jsonb_typeof(comments) = 'array' and jsonb_array_length(comments) <= 200 and pg_column_size(comments) <= 200000);
