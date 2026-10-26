# Private Lab

A personal sandbox that hosts small apps ("modules") in one Next.js app with one Supabase project.

- **Invite-only auth:** Supabase magic links. Public sign-up is off; an admin adds email addresses on `/admin`.
- **Per-user module access:** the admin decides which user may open which module (e.g. friend A gets FIRE, friend B does not). Enforced by row level security in the database, not just the UI.
- **Public or private modules:** a module can be made public so anyone can view it without signing in.

Modules:
- 🔥 **FIRE**: net worth overview with progress to your FIRE number, net worth chart, accounts with allocation, a "what if" savings slider, monthly balances and plan settings. Visitors of a public FIRE module get the calculator only.
- 📚 **Books**: placeholder.

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

1. Create `src/modules/<id>/index.tsx` with a default-exported component.
2. Register it in `src/modules/registry.ts`.
3. Add a migration that inserts the row into `public.modules` and creates the module's tables with RLS enabled.

The module is then served at `/m/<id>` and appears on the dashboard and admin page.

## Project layout

```
src/
  app/            routes: /, /login, /auth/*, /dashboard, /admin, /m/[module]
  lib/            Supabase clients and auth helpers
  modules/        one folder per module + registry.ts
  proxy.ts        refreshes the session, redirects signed-out users
supabase/migrations/
```
