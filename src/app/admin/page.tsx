import { CheckIcon } from "lucide-react";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { modules } from "@/modules/registry";
import { inviteUser, removeUser, setModuleAccess, setModuleVisibility } from "./actions";

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
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
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Invite someone</h2>
          </CardTitle>
          <CardDescription>They can then sign in on /login with a magic link.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={inviteUser} className="space-y-4">
            <div className="max-w-sm space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" name="email" type="email" required placeholder="friend@example.com" />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Modules</legend>
              <div className="flex flex-wrap gap-4">
                {modules.map((module) => (
                  <div key={module.id} className="flex items-center gap-2">
                    <Checkbox id={`invite-${module.id}`} name="modules" value={module.id} />
                    <Label htmlFor={`invite-${module.id}`} className="font-normal">
                      {module.icon} {module.name}
                    </Label>
                  </div>
                ))}
              </div>
            </fieldset>
            <Button>Add user</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Users and access</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                {modules.map((module) => (
                  <TableHead key={module.id}>
                    {module.icon} {module.name}
                  </TableHead>
                ))}
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(profiles ?? []).map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      {profile.email}
                      {profile.is_admin && <Badge variant="secondary">admin</Badge>}
                    </span>
                  </TableCell>
                  {modules.map((module) => {
                    const enabled = profile.is_admin || hasAccess.has(`${profile.id}:${module.id}`);
                    return (
                      <TableCell key={module.id}>
                        {profile.is_admin ? (
                          <CheckIcon aria-label="Has access" className="size-4 text-brand" />
                        ) : (
                          <form action={setModuleAccess}>
                            <input type="hidden" name="userId" value={profile.id} />
                            <input type="hidden" name="moduleId" value={module.id} />
                            <input type="hidden" name="enabled" value={String(!enabled)} />
                            <Button size="sm" variant={enabled ? "secondary" : "outline"}>
                              {enabled ? (
                                <>
                                  <CheckIcon className="text-brand" /> Revoke
                                </>
                              ) : (
                                "Grant"
                              )}
                            </Button>
                          </form>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right">
                    {profile.id !== currentUser.id && (
                      <form action={removeUser}>
                        <input type="hidden" name="userId" value={profile.id} />
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                          Remove
                        </Button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Module visibility</h2>
          </CardTitle>
          <CardDescription>Public modules can be opened without signing in.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {modules.map((module) => {
              const isPublic = visibility.get(module.id) === "public";
              return (
                <li key={module.id} className="flex items-center gap-3 py-2">
                  <span className="w-32">
                    {module.icon} {module.name}
                  </span>
                  <Badge variant={isPublic ? "default" : "outline"}>{isPublic ? "public" : "private"}</Badge>
                  <form action={setModuleVisibility} className="ml-auto">
                    <input type="hidden" name="moduleId" value={module.id} />
                    <input type="hidden" name="visibility" value={isPublic ? "private" : "public"} />
                    <Button size="sm" variant="outline">
                      Make {isPublic ? "private" : "public"}
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
