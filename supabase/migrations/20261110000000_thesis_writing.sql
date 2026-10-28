-- Bachelorarbeit: the thesis itself as an outline of sections with plain
-- text, written in the app and exported to LaTeX later. The outline is a flat
-- list in order (position) with a depth (0 = chapter, 1 = section, …), so
-- moving a section is a change of position and depth.

create table public.thesis_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  position integer not null default 0,
  depth smallint not null default 0 check (depth between 0 and 3),
  title text not null default '' check (char_length(title) <= 300),
  -- Plain text: blank lines separate paragraphs, [@key] cites a source,
  -- ![Caption](doc:<document id>) places an image from the documents.
  body text not null default '' check (char_length(body) <= 200000),
  status text not null default 'open' check (status in ('open', 'draft', 'done')),
  target_words integer check (target_words between 1 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index thesis_sections_user_id_idx on public.thesis_sections (user_id, position);

alter table public.thesis_sections enable row level security;

grant select, insert, update, delete on public.thesis_sections to authenticated;

create policy "thesis_sections: own rows" on public.thesis_sections
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.has_module_access('thesis')))
  with check ((select auth.uid()) = user_id and (select private.has_module_access('thesis')));
