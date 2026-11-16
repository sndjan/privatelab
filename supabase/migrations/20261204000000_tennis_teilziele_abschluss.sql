-- Tennistraining: one Teilziel per exercise instead of several cues, a
-- Stundenziel per session, and the checklist for the end of a session.
--
-- tennis_exercises.teilziel: the one point the coach watches and corrects in
-- this exercise (BTV: "Teilziel"), e.g. "Treffpunkt seitlich vor dem Körper".
-- A plan item may override it for one session ("goal" in the plan JSON, no
-- column needed). The old cues (tips) stay in the table but are no longer
-- shown; the first one becomes the Teilziel to start with.
-- tennis_sessions.goal: the Stundenziel (BTV: "Gesamtziel"), e.g. "Vorhand-Drive".
-- tennis_sessions.done: the checklist items ticked off after the session.
-- tennis_groups.after_session / day_end: what to do after each session of the
-- group, and additionally after the last session of the day.

alter table public.tennis_exercises
  add column teilziel text not null default '' check (char_length(teilziel) <= 120);

update public.tennis_exercises
set teilziel = left(regexp_replace(tips[1], '!+$', ''), 120)
where teilziel = '' and cardinality(tips) > 0;

alter table public.tennis_sessions
  add column goal text not null default '' check (char_length(goal) <= 80),
  add column done text[] not null default '{}' check (cardinality(done) <= 30);

alter table public.tennis_groups
  add column after_session text[] not null default '{"Platz abziehen","Linien kehren"}' check (cardinality(after_session) <= 10),
  add column day_end text[] not null default '{"Foto vom Plan schicken","Fehlende Kinder eintragen","Alles aufräumen"}' check (cardinality(day_end) <= 10);
