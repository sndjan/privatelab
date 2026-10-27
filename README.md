# Private Lab

A personal sandbox that hosts small apps ("modules") in one Next.js app with one Supabase project.

- **Invite-only auth:** Supabase magic links. Public sign-up is off; an admin adds email addresses on `/admin`.
- **Per-user module access:** the admin decides which user may open which module (e.g. friend A gets FIRE, friend B does not). Enforced by row level security in the database, not just the UI.
- **Public or private modules:** a module can be made public so anyone can view it without signing in.

Modules:
- 🔥 **FIRE**: net worth overview with progress to your FIRE number, net worth chart, accounts with allocation, a "what if" savings slider, monthly balances and plan settings. Visitors of a public FIRE module get the calculator only.
- 🧳 **Packliste**: packing lists between places (e.g. home ↔ uni). Reusable templates start dated runs; items can depend on conditions (winter, gym, rain…); items flagged as forgotten are pinned to the top next time; an inventory per place hides what is already at the destination. An empty module offers starter templates for Bellenberg ↔ Stuttgart.
- ⏱️ **Arbeitszeit-Tracker**: overtime balance from an opening value, a month calendar with vacation and holidays where every workday counts as the standard day (e.g. 7:30–16:30 with 1 h break) unless changed in the editor above it with a 15-minute slider, sick days and days off from overtime, work time models that change hours per weekday and vacation days per month from a date on, Baden-Württemberg or Bayern holidays, and vacation per year (taken, planned, left, carried over) with an "im Kalender eingetragen" checkbox per block. The migration seeds starting data for admins.
- **Planned modules** (not implemented, listed in `src/modules/meta.ts` with `status: "planned"` and shown to admins on the dashboard): Bücherregal, Geschenke-Liste, Wunsch-Liste, Spielesammlung, Coding-Projekte, Gesundheit-Dashboard, Visionboard, Digital Journal, Daily Images to Collage, Spiele-Olympiade, Escape Room Website, Enigma, Easy to Hard Game, Hitster mit Ländern, Guess the Fame, Coding Clicker, AI Anki Generator, History of City / Reisefakten.

## Setup

1. **Install:** `npm install`
2. **Supabase project:** create one (or reuse yours) and copy `.env.example` to `.env.local` with the project URL, publishable key and secret key (Project settings → API keys).
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

Components come from [shadcn/ui](https://ui.shadcn.com) (new-york style) and live in `src/components/ui/`. Add more with `npx shadcn@latest add <component>`. The theme is in `src/app/globals.css`: the standard shadcn tokens plus `brand` (deep green) and a few FIRE-specific colors. Dark mode follows the system unless the user picks Hell or Dunkel on `/profile`; the choice is stored per device in localStorage and applied before the first paint by the inline script from `src/lib/theme.ts` (it sets `data-theme` on `<html>` and the `theme-color` meta).

## PWA and language

The app is installable as a PWA: `src/app/manifest.ts`, icons in `public/` and `src/app/*-icon.png`, and `public/sw.js`, which only caches an offline page (`/offline`) so signed-in pages are always loaded fresh. The service worker registers in production builds only. All UI text is German (`lang="de"`, dates and money formatted with `de-DE`).

## Project layout

```
src/
  app/            routes: /, /login, /auth/*, /dashboard, /profile, /admin, /m/[module]
  components/ui/  shadcn/ui components
  lib/            Supabase clients, auth helpers, cn()
  modules/        one folder per module + registry.ts
  proxy.ts        refreshes the session, redirects signed-out users
supabase/migrations/
```
