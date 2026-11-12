-- TV Bellenberg: prototype of a new website for the tennis club, shown at
-- /m/tvb without the app's header. Teams, board and sponsors live in the code
-- (src/modules/tvb/data.ts); the news are the one thing the admin edits.
--
-- tvb_news: club news. Everyone who may open the module reads the published
-- ones (anyone, if the module is made public). Users with access to the
-- module are the site's admins: they read drafts too and write. show_banner
-- puts a news item into the strip above the header; only one at a time.

insert into public.modules (id, name) values ('tvb', 'TV Bellenberg')
on conflict (id) do nothing;

create table public.tvb_news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  category text not null default 'Verein' check (category in ('Verein', 'Anlage', 'Jugend', 'Spielbetrieb')),
  published_on date not null default current_date,
  teaser text not null default '' check (char_length(teaser) <= 400),
  body text not null default '' check (char_length(body) <= 20000),
  image text check (image is null or image ~ '^[a-z0-9-]+$'),
  published boolean not null default true,
  show_banner boolean not null default false,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tvb_news_published_on_idx on public.tvb_news (published_on desc, created_at desc);
create unique index tvb_news_one_banner_idx on public.tvb_news (show_banner) where show_banner;

alter table public.tvb_news enable row level security;

grant select on public.tvb_news to anon, authenticated;
grant insert, update, delete on public.tvb_news to authenticated;

create or replace function private.tvb_is_public()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.modules m where m.id = 'tvb' and m.visibility = 'public');
$$;

revoke all on function private.tvb_is_public() from public;
grant execute on function private.tvb_is_public() to anon, authenticated;

create policy "tvb_news: read published" on public.tvb_news
  for select to anon, authenticated
  using (published and (select private.tvb_is_public()));

create policy "tvb_news: admins read all" on public.tvb_news
  for select to authenticated
  using ((select private.has_module_access('tvb')));

create policy "tvb_news: admins insert" on public.tvb_news
  for insert to authenticated
  with check ((select private.has_module_access('tvb')));

create policy "tvb_news: admins update" on public.tvb_news
  for update to authenticated
  using ((select private.has_module_access('tvb')))
  with check ((select private.has_module_access('tvb')));

create policy "tvb_news: admins delete" on public.tvb_news
  for delete to authenticated
  using ((select private.has_module_access('tvb')));

-- The current news of the club's old site, so the prototype starts with real content.
insert into public.tvb_news (title, category, published_on, teaser, body, image, show_banner) values
  ('Saisonende: Die Tennisanlage ist ab sofort geschlossen', 'Anlage', '2026-11-07',
   'Die Sommersaison ist vorbei, die Anlage ist ab sofort geschlossen.',
   E'Die Sommersaison ist vorbei: Die Tennisanlage ist ab sofort geschlossen.\n\nVielen Dank für das gemeinsame Jahr 2026, eure Unterstützung und den tollen Zusammenhalt! Wir wünschen euch besinnliche Feiertage und alles Gute für 2027.',
   'winter', true),
  ('Herzlich willkommen: unsere neuen Mitglieder', 'Verein', '2026-10-26',
   '2026 sind bisher 20 neue Mitglieder zum TVB gekommen, viele davon als Schnuppermitglieder.',
   E'Auch in diesem Jahr ist der TV Bellenberg gewachsen: Seit April 2026 sind 20 neue Mitglieder dazugekommen, die meisten über die Schnuppermitgliedschaft.\n\nHerzlich willkommen im Verein! Wir freuen uns auf viele gemeinsame Stunden auf und neben dem Platz.',
   'sommerfest', false),
  ('Winter 2026/27: der Spielplan ist da', 'Spielbetrieb', '2026-10-18',
   'Herren, Herren 30 und Herren 40 spielen in der Winterrunde. Alle Termine im Spielplan.',
   E'In der Winterrunde 2026/27 treten drei Mannschaften an: Herren (Südliga 3), Herren 30 (Landesliga 2) und Herren 40 (Südliga 1).\n\nAlle Spieltermine stehen im TVB-Spielplan, Tabellen und Ergebnisse beim BTV.',
   'u18', false),
  ('Jugendtraining im Winter', 'Jugend', '2026-10-14',
   'Gruppen und Zeiten für das Jugendtraining in der Wintersaison 2026/27.',
   E'Der Trainingsplan für das Jugendtraining im Winter 2026/27 ist online. Gruppen und Zeiten stehen im Plan zum Download.\n\nFragen beantwortet Jugendwartin Lisa Prestele (jugendwart@tv-bellenberg.de).',
   'jugend1', false),
  ('Saison-Rundschreiben 2026', 'Verein', '2026-04-16',
   'Alles Wichtige zur Sommersaison 2026 im Rundschreiben des Vorstands.',
   E'Das Saison-Rundschreiben 2026 ist erschienen. Darin: alles Wichtige zur Sommersaison, Termine und Infos des Vorstands.',
   'clubhaus', false),
  ('Verabschiedung der Kassenprüfer', 'Verein', '2026-03-27',
   'Nach 20 Jahren Kassenprüfung hören Gustl Mair und Klaus Bürzle auf.',
   E'Vorstand Steven Potrykus überreichte den scheidenden Kassenprüfern Gustl Mair und Klaus Bürzle ein kleines Präsent für 20 Jahre Kassenprüfung.\n\nVielen Dank für den langen Einsatz!',
   null, false),
  ('Mitgliederversammlung 2026: Ehrungen', 'Verein', '2026-03-26',
   'Goldene Ehrennadel für Steven Potrykus und Gustl Mair.',
   E'In der Mitgliederversammlung am 20.03.2026 überreichte der 2. Vorstand Arnold Eck für langjährige Mitgliedschaft die Goldene Ehrennadel an Vorstand Steven Potrykus und Gustl Mair.',
   null, false);
