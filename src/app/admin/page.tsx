import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { modules } from "@/modules/registry";
import { inviteUser, removeUser, setModuleAccess, setModuleVisibility } from "./actions";

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="opacity-70">Loading…</p>}>
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  const currentUser = await requireAdmin();
  const supabase = await createClient();

  const [{ data: profiles }, { data: access }, { data: moduleRows }] = await Promise.all([
    supabase.from("profiles").select("id, email, is_admin").order("created_at"),
    supabase.from("module_access").select("user_id, module_id"),
    supabase.from("modules").select("id, visibility"),
  ]);

  const hasAccess = new Set((access ?? []).map((row) => `${row.user_id}:${row.module_id}`));
  const visibility = new Map((moduleRows ?? []).map((row) => [row.id, row.visibility]));

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Invite someone</h2>
        <form action={inviteUser} className="space-y-3 rounded-lg border border-foreground/10 p-4">
          <input
            name="email"
            type="email"
            required
            placeholder="friend@example.com"
            className="w-full rounded border border-foreground/20 bg-transparent px-3 py-2"
          />
          <div className="flex flex-wrap gap-4 text-sm">
            {modules.map((module) => (
              <label key={module.id} className="flex items-center gap-2">
                <input type="checkbox" name="modules" value={module.id} />
                {module.icon} {module.name}
              </label>
            ))}
          </div>
          <button className="rounded bg-foreground px-3 py-2 text-sm text-background">
            Add user
          </button>
          <p className="text-xs opacity-60">
            They can then sign in on /login with a magic link.
          </p>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Users and access</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left opacity-70">
                <th className="py-2 pr-4 font-normal">Email</th>
                {modules.map((module) => (
                  <th key={module.id} className="py-2 pr-4 font-normal">
                    {module.icon} {module.name}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {(profiles ?? []).map((profile) => (
                <tr key={profile.id} className="border-t border-foreground/10">
                  <td className="py-2 pr-4">
                    {profile.email}
                    {profile.is_admin && <span className="ml-2 text-xs opacity-60">admin</span>}
                  </td>
                  {modules.map((module) => {
                    const enabled = profile.is_admin || hasAccess.has(`${profile.id}:${module.id}`);
                    return (
                      <td key={module.id} className="py-2 pr-4">
                        {profile.is_admin ? (
                          "✓"
                        ) : (
                          <form action={setModuleAccess}>
                            <input type="hidden" name="userId" value={profile.id} />
                            <input type="hidden" name="moduleId" value={module.id} />
                            <input type="hidden" name="enabled" value={String(!enabled)} />
                            <button className="rounded border border-foreground/20 px-2 py-0.5">
                              {enabled ? "✓ revoke" : "grant"}
                            </button>
                          </form>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2 text-right">
                    {profile.id !== currentUser.id && (
                      <form action={removeUser}>
                        <input type="hidden" name="userId" value={profile.id} />
                        <button className="text-red-600 opacity-70 hover:opacity-100">remove</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Module visibility</h2>
        <ul className="space-y-2 text-sm">
          {modules.map((module) => {
            const isPublic = visibility.get(module.id) === "public";
            return (
              <li key={module.id} className="flex items-center gap-3">
                <span className="w-32">
                  {module.icon} {module.name}
                </span>
                <span className="w-16 opacity-70">{isPublic ? "public" : "private"}</span>
                <form action={setModuleVisibility}>
                  <input type="hidden" name="moduleId" value={module.id} />
                  <input type="hidden" name="visibility" value={isPublic ? "private" : "public"} />
                  <button className="rounded border border-foreground/20 px-2 py-0.5">
                    make {isPublic ? "private" : "public"}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
