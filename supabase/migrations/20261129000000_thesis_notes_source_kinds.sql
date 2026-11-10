-- Bachelorarbeit: free notes and more kinds of sources.
--
-- thesis_notes: Markdown notes outside the thesis text, e.g. the
-- Zielvereinbarung or ideas, without outline or formal rules. Saved as typed.
--
-- thesis_sources.kind gets 'standard' (Norm, e.g. DIN EN ISO 9241-110:2020),
-- 'video' (e.g. YouTube), 'report' (Bericht, Whitepaper, graue Literatur) and
-- 'thesis' (Bachelor-, Masterarbeit, Dissertation). They reuse the existing
-- columns: version holds the standard's number or the kind of thesis, issue
-- the report number, publisher the institution or university, container the
-- platform (video) or the archive (thesis). See sourceKinds in
-- src/modules/thesis/cite.ts.

create table if not exists public.thesis_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 200000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists thesis_notes_user_id_idx on public.thesis_notes (user_id, updated_at desc);

alter table public.thesis_notes enable row level security;

grant select, insert, update, delete on public.thesis_notes to authenticated;

drop policy if exists "thesis_notes: own rows" on public.thesis_notes;
create policy "thesis_notes: own rows" on public.thesis_notes
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('thesis')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('thesis')));

alter table public.thesis_sources drop constraint if exists thesis_sources_kind_check;
alter table public.thesis_sources add constraint thesis_sources_kind_check
  check (kind in ('web', 'article', 'book', 'chapter', 'software', 'standard', 'video', 'report', 'thesis'));
