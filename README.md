# Private Lab

A personal sandbox that hosts small apps ("modules") in one Next.js app with one Supabase project.

- **Invite-only auth:** Supabase magic links. Public sign-up is off; an admin adds email addresses on `/admin`.
- **Per-user module access:** the admin decides which user may open which module (e.g. friend A gets FIRE, friend B does not). Enforced by row level security in the database, not just the UI.
- **Public or private modules:** a module can be made public so anyone can view it without signing in.

Modules:
- 🔥 **FIRE**: net worth overview with progress to your FIRE number, net worth chart, accounts with allocation, a "what if" savings slider, monthly balances and plan settings. Visitors of a public FIRE module get the calculator only.
- 🧳 **Packliste**: packing lists used like a note with checkboxes, e.g. "Nach Stuttgart" and "Nach Bellenberg". Tick items while packing (open items stay on top of each section) and reset the list for the next trip, with undo. Starred lists are big tiles on the start page. In edit mode: own sections, notes per item, drag and drop sorting and per-list chips (e.g. Gym, Regen) that hide their items when switched off. A separate inventory per place records what is already there. An empty module offers starter lists for Bellenberg ↔ Stuttgart.
- ⏱️ **Arbeitszeit-Tracker**: overtime balance from an opening value, a month calendar with vacation and holidays where every workday counts as the standard day (e.g. 7:30–16:30 with 1 h break) unless changed in the editor above it with a 15-minute slider, sick days and days off from overtime, work time models that change hours per weekday and vacation days per month from a date on, Baden-Württemberg or Bayern holidays, and vacation per year (taken, planned, left, carried over) with an "im Kalender eingetragen" checkbox per block. The migration seeds starting data for admins.
- 🎾 **Tennistraining**: plan a kids' tennis session in a few minutes. "Stunde planen" suggests a session for a group (warm-up, technique blocks, game, finish, e.g. 10 + 15 + 15 + 15 + 5 for 60 minutes), weighted towards the group's favorite exercises and away from what it played in its last two sessions; roll the dice per exercise or for everything, swap, reorder and change minutes. The session page shows every exercise with time, court sketch, steps and cues to call out, highlights the one that is running right now with the minutes left, prints as a sheet for the court and keeps notes. Exercises have a drag-and-drop court sketch (trainer, kids, cones, targets, basket, balls, running paths and ball paths). An empty module offers a starter collection of 38 drills and games; "Mit KI erstellen" copies a prompt for any free AI chat that explains the JSON and court coordinates (documented in `src/modules/tennis/data.ts`), and imports the pasted answer with sketches.
- ⭐ **Wunsch-Liste**: several wishlists per user (e.g. "Geburtstag 2026"). A wish is added on its own page: paste a shop link and the server reads the page (Open Graph, JSON-LD) and lets Claude Haiku fill in title, price, image and a short note to check before saving; the field also takes the whole text an app shares (the Amazon app shares "<title> https://amzn.eu/d/…"), and Amazon links are resolved and cleaned to `amazon.de/dp/<ASIN>`. Amazon refuses pages to servers, so from Amazon the title comes from the shared text and the image from Amazon's image-by-ASIN URL where it exists. "Aus Screenshot ausfüllen" sends a scaled-down screenshot (e.g. from the Amazon app or Instagram) to Claude Haiku, which reads title, price and shop and marks the product photo; the cropper opens on that spot, and "Aus dem Screenshot" picks another part later. On Android, the installed app is a share target (`share_target` in `src/app/manifest.ts`): "Teilen" → Private Lab asks for the list and fills in the wish. With `AMAZON_PARTNER_TAG` set, guests' Amazon links get the partner tag (stored links stay clean, the owner's own links are untagged) and the share page shows the Amazon partner disclosure. Instead of the shop's picture you can upload your own and crop it square (stored in the public `wishlist-images` bucket under the user's id; replaced or deleted images are removed). Wishes have a quantity, a note and can be a Herzenswunsch (heart badge; shown first on the share page under "Darüber freue ich mich besonders"). Each list has a short public link `/w/<token>` (10 characters, e.g. `/w/k7qm2xpa9z`; header "⭐ Wunschliste"): guests reserve a wish without an account ("Ich schenke das", name optional) and undo it from the same browser (a cookie). Guests see each other's names so nothing is given twice; the owner never sees whether a wish is reserved, only who gave it after marking it "Erhalten", which archives it. Reservations are only reachable with the secret key (no table grants), see `supabase/migrations/20261103000000_wishlist.sql`. A new link can be generated in the list settings, which invalidates the old one.
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

Signed-in users can send feedback (Fehler / Idee / Sonstiges) from the header (needs the `20261028000000_feedback.sql` migration); the page they were on is saved with it. Admins see it at the bottom of `/admin`. To pull it from Supabase, e.g. in the SQL editor:

```sql
select f.created_at, p.email, f.kind, f.page, f.message
from public.feedback f left join public.profiles p on p.id = f.user_id
where f.status = 'new'
order by f.created_at;
```

## UI

Components come from [shadcn/ui](https://ui.shadcn.com) (new-york style) and live in `src/components/ui/`. Dialogs open at the top of the screen on phones, so the keyboard never covers them. Add more with `npx shadcn@latest add <component>`. The theme is in `src/app/globals.css`: the standard shadcn tokens plus `brand` (deep green) and a few FIRE-specific colors. Dark mode follows the system unless the user picks Hell or Dunkel on `/profile`; the choice is stored per device in localStorage and applied before the first paint by the inline script from `src/lib/theme.ts` (it sets `data-theme` on `<html>` and the `theme-color` meta).

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
