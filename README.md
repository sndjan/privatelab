# Private Lab

A personal sandbox that hosts small apps ("modules") in one Next.js app with one Supabase project.

- **Invite-only auth:** Supabase magic links. Public sign-up is off; an admin adds email addresses on `/admin`.
- **Per-user module access:** the admin decides which user may open which module (e.g. friend A gets FIRE, friend B does not). Enforced by row level security in the database, not just the UI.
- **Public or private modules:** a module can be made public so anyone can view it without signing in.

Modules:
- 🔥 **FIRE**: net worth overview with progress to your FIRE number, net worth chart, accounts with allocation, a "what if" savings slider, monthly balances and plan settings. Visitors of a public FIRE module get the calculator only.
- 🧳 **Packliste**: packing lists used like a note with checkboxes, e.g. "Nach Stuttgart" and "Nach Bellenberg". Tick items while packing (open items stay on top of each section) and reset the list for the next trip, with undo. Starred lists are big tiles on the start page. In edit mode: own sections, notes per item, drag and drop sorting and per-list chips (e.g. Gym, Regen) that hide their items when switched off. A separate inventory per place records what is already there. An empty module offers starter lists for Bellenberg ↔ Stuttgart.
- ⏱️ **Arbeitszeit-Tracker**: overtime balance from an opening value, a month calendar with vacation and holidays where every workday counts as the standard day (e.g. 7:30–16:30 with 1 h break) unless changed in the editor above it with a 15-minute slider, sick days and days off from overtime, work time models that change hours per weekday and vacation days per month from a date on, Baden-Württemberg or Bayern holidays, and vacation per year (taken, planned, left, carried over) with an "im Kalender eingetragen" checkbox per block. The migration seeds starting data for admins.
- 🎾 **Tennistraining**: plan a kids' tennis session in a few minutes. "Stunde planen" suggests a session for a group (warm-up, technique blocks, game, finish, e.g. 10 + 15 + 15 + 15 + 5 for 60 minutes), weighted towards the group's favorite exercises and away from what it played in its last two sessions; roll the dice per exercise or for everything, swap, reorder and change minutes. The session page shows every exercise with time, court sketch, steps and cues to call out, highlights the one that is running right now with the minutes left, prints on one A5 page in black and white (time, name, one sentence, cues and a small sketch per exercise, who's there, lines for notes; `src/modules/tennis/print-sheet.tsx`) and keeps notes. **Mit KI planen** at the top of the planner turns a sentence like "Vorhandfokus für die U10, zum Aufwärmen Tic Tac Toe und zwei Spiele" into a plan: Claude (`claude-opus-5-5`, structured output, `src/modules/tennis/ai-plan.ts`, needs `ANTHROPIC_API_KEY`) picks exercises from the collection with the group's size, favorites and last sessions in mind and creates missing ones with a sketch; the plan lands in the planner to check and save, with undo. Exercises have a drag-and-drop court sketch (trainer, kids, cones, targets, basket, balls, running paths and ball paths). Groups have a training weekday and their kids (name, Junge/Mädchen, entered one after the other). Holidays ("Ferien") are entered once; the overview lists the training days of the next week that aren't planned yet, skipping holidays, and the planner picks the group's next training day and warns about holidays. **Kurzfristig umplanen:** on a session's page, "Wer kommt?" lists the group's kids; tap the ones who cancelled, and "Passend umplanen" swaps every exercise that doesn't work for the kids who are left (exercises say for how many kids they work, `players_min`/`players_max`), "Alles neu würfeln" rolls everything again; during the training only the running exercise and later ones change, and a toast offers "Rückgängig". An empty module offers a starter collection of 39 drills and games (with player ranges); "Mit KI erstellen" copies a prompt for any free AI chat that explains the JSON and court coordinates (documented in `src/modules/tennis/data.ts`), and imports the pasted answer with sketches.
- ⭐ **Wunsch-Liste**: several wishlists per user (e.g. "Geburtstag 2026"). A wish is added on its own page: paste a shop link and the server reads the page (Open Graph, JSON-LD) and lets Claude Haiku fill in title, price, image and a short note to check before saving; the field also takes the whole text an app shares (the Amazon app shares "<title> https://amzn.eu/d/…"), and Amazon links are resolved and cleaned to `amazon.de/dp/<ASIN>`. Amazon refuses pages to servers, so from Amazon the title comes from the shared text and the image from Amazon's image-by-ASIN URL where it exists. "Aus Screenshot ausfüllen" sends a scaled-down screenshot (e.g. from the Amazon app or Instagram) to Claude Haiku, which reads title, price and shop and marks the product photo; the cropper opens on that spot, and "Aus dem Screenshot" picks another part later. On Android, the installed app is a share target (`share_target` in `src/app/manifest.ts`): "Teilen" → Private Lab asks for the list and fills in the wish. With `AMAZON_PARTNER_TAG` set, guests' Amazon links get the partner tag (only the admin sets it; partner tags users paste in, also inside amzn.to short links, are removed on save, and the owner's own view stays untagged) and the share page shows the Amazon partner disclosure. Instead of the shop's picture you can upload your own and crop it square (stored in the public `wishlist-images` bucket under the user's id; replaced or deleted images are removed). Wishes have a quantity, a note and can be a Herzenswunsch (heart badge; shown first on the share page under "Darüber freue ich mich besonders"). Each list has a short public link `/w/<token>` (10 characters, e.g. `/w/k7qm2xpa9z`; header "⭐ Wunschliste"): guests reserve a wish without an account ("Ich schenke das", name optional) and undo it from the same browser (a cookie). Guests see each other's names so nothing is given twice; the owner never sees whether a wish is reserved, only who gave it after marking it "Erhalten", which archives it. Reservations are only reachable with the secret key (no table grants), see `supabase/migrations/20261103000000_wishlist.sql`. A new link can be generated in the list settings, which invalidates the old one.
- 🎓 **Bachelorarbeit**: tracks a thesis as it happens and only shows what you entered (no AI, no suggestions). Tabs: **Überblick** with working title, research question, supervisors, university and company, the time frame you set (days left, elapsed-time bar), current phase, hours this week and in total, number of sources, the next open to-dos by deadline ("Nächste Schritte") and your own phases with date ranges and hours logged per phase. **To-dos** from one line: `Gliederung schicken !1 @Sandra #Exposé bis Fr` sets priority (!1–!3), person (new names are added), phase and deadline (heute, morgen, a weekday, 12.11.); chips below the field show what was understood, `@` and `#` suggest names, Enter saves and keeps the focus (`parseQuickTodo` in `src/modules/thesis/data.ts`). Open to-dos are sorted by priority, then deadline; ticked ones move to "Erledigt" with their date; the pencil edits everything incl. a note. **Termine**: appointments (time, place, people) and deadlines apart from the to-dos, next ones on the overview; after an appointment, "Protokoll schreiben" starts its protocol with date, title and people and links both. The overview also has **Allgemeine Infos** (short facts like "Kolloquium spätestens 4 Wochen nach Abgabe", tap to edit) and **Personen**, which protocols, appointments and to-dos pick as chips. **Arbeitslog**: date, hours, phase and what you did, grouped by calendar week with a total per week. **Quellen**: websites/documentation, papers, books, book chapters and software, each asking for the fields APA 7 needs; references are formatted in the German APA 7 adaptation (o. J., "Abgerufen am … von", with italics when copied) and as BibLaTeX entries for biblatex-apa (`@online` with `urldate`, `@article`, `@book`, `@incollection`, `@software`), with a citation key per source, a status (gefunden, gelesen, zitiert) and a `.bib` download of all or only the cited sources. The formatting is in `src/modules/thesis/cite.ts`. **Protokolle**: meeting notes with date, participants (people as chips; text entered before stays as "Weitere Teilnehmende") and Markdown text, searchable, with to-dos added from inside a protocol and linked back to it. **Dokumente**: any file up to 50 MB (the Supabase free plan maximum) with title, note and category (Literatur, Vorlage / Richtlinie, Entwurf, Sonstiges), optionally linked to a source or protocol and listed there too; a new version replaces the old file. The browser uploads straight into the private `thesis-documents` bucket (folder = user id), so Vercel's request size limit doesn't apply; files open through short-lived signed URLs. PDFs open in a built-in viewer (pdf.js via react-pdf: lazy pages, selectable text, links, zoom, full screen), images inline, everything else as a download.
- **Planned modules** (not implemented, listed in `src/modules/meta.ts` with `status: "planned"` and shown to admins on the dashboard): Bücherregal, Geschenke-Liste, Spielesammlung, Coding-Projekte, Gesundheit-Dashboard, Challenges, Visionboard, Digital Journal, Daily Images to Collage, Spiele-Olympiade, Escape Room Website, Enigma, Easy to Hard Game, Hitster mit Ländern, Guess the Fame, Coding Clicker, AI Anki Generator, History of City / Reisefakten.

## Setup

1. **Install:** `npm install`
2. **Supabase project:** create one (or reuse yours) and copy `.env.example` to `.env.local` with the project URL, publishable key and secret key (Project settings → API keys). For the Wunsch-Liste AI import, add an `ANTHROPIC_API_KEY` (without it, only the page's preview data is used).
3. **Database:** run the files in `supabase/migrations/` in order, either with `supabase db push` (CLI, linked project) or by pasting them into the SQL editor.
4. **Auth settings** (Dashboard → Authentication):
   - Turn off **Allow new users to sign up**.
   - Under URL configuration, set the Site URL and add `http://localhost:3000/auth/callback` (plus your production URL) to the redirect URLs.
   - Configure **custom SMTP** (e.g. Resend or Brevo). Supabase's built-in mailer only sends to your project's team members and is heavily rate-limited, so magic links to friends won't arrive without it.
5. **First admin:** create your own user under Authentication → Users → Add user, then run:
   ```sql
   update public.profiles set is_admin = true where email = 'you@example.com';
   ```
6. **Run:** `npm run dev` and sign in at http://localhost:3000/login.

## How access works

| Table | Purpose |
|---|---|
| `profiles` | One row per auth user (created by a trigger), with `is_admin`. |
| `modules` | One row per module, with `visibility` (`private` or `public`). |
| `module_access` | Which user may use which module (`role`: `user` or `viewer`). |

Policies use `private.has_module_access(module_id)`, which is true for admins and for users with a `module_access` row. New module tables should use it too, together with a `user_id` check so every user only sees their own data.

## Adding a module

1. Add it to `src/modules/meta.ts` (or switch a planned entry to `status: "live"`).
2. Create `src/modules/<id>/index.tsx` with a default-exported component and attach it in `src/modules/registry.ts`.
3. Add a migration that inserts the row into `public.modules` and creates the module's tables with RLS enabled.

The module is then served at `/m/<id>` and appears on the dashboard and admin page.

## Feedback

Signed-in users can send feedback (Fehler / Idee / Sonstiges) from the header (needs the `20261028000000_feedback.sql` migration); the page they were on is saved with it. On a desktop it opens as a panel in the bottom right that leaves the page usable; `F` (outside text fields) or `Alt+Shift+F` jumps into it, `Strg/⌘+Enter` sends and keeps the field focused for the next one, and `@Fehler`, `@Idee` or `@Sonstiges` in the text sets the kind (Tab completes it). On phones it stays a dialog. Admins see it at the bottom of `/admin`. To pull it from Supabase, e.g. in the SQL editor:

```sql
select f.created_at, p.email, f.kind, f.page, f.message
from public.feedback f left join public.profiles p on p.id = f.user_id
where f.status = 'new'
order by f.created_at;
```

## UI

Components come from [shadcn/ui](https://ui.shadcn.com) (new-york style) and live in `src/components/ui/`. Dialogs open at the top of the screen on phones, so the keyboard never covers them. Add more with `npx shadcn@latest add <component>`. The theme is in `src/app/globals.css`: the standard shadcn tokens plus `brand` (deep green) and a few FIRE-specific colors. Dark mode follows the system unless the user picks Hell or Dunkel on `/profile`; the choice is stored per device in localStorage and applied before the first paint by the inline script from `src/lib/theme.ts` (it sets `data-theme` on `<html>` and the `theme-color` meta).

Feedback on actions: a thin bar at the top runs from a click on a link until the next view is there (`src/components/navigation-progress.tsx`; module views switch by search params, which otherwise keep the old view on screen without any sign). `SubmitButton` shows a spinner while its server action runs and a check mark afterwards; with `done="Gespeichert"` it also shows a toast (sonner, `src/components/ui/sonner.tsx`). Forms sent with Enter show `FormPending`. A failing action lands on `src/app/error.tsx` with a retry button.

## PWA and language

The app is installable as a PWA: `src/app/manifest.ts`, icons in `public/` and `src/app/*-icon.png`, and `public/sw.js`, which only caches an offline page (`/offline`) so signed-in pages are always loaded fresh. The service worker registers in production builds only. All UI text is German (`lang="de"`, dates and money formatted with `de-DE`).

## Project layout

```
src/
  app/            routes: /, /login, /auth/*, /dashboard, /profile, /admin, /m/[module], /w/[token] (shared wishlist)
  components/ui/  shadcn/ui components
  lib/            Supabase clients, auth helpers, cn()
  modules/        one folder per module + registry.ts
  proxy.ts        refreshes the session, redirects signed-out users
supabase/migrations/
```
