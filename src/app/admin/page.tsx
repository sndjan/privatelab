import { CheckIcon } from "lucide-react";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
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
import { deleteFeedback, setFeedbackStatus } from "../feedback/actions";
import { inviteUser, removeUser, setModuleAccess, setModuleVisibility } from "./actions";

const feedbackKinds: Record<string, string> = { bug: "Fehler", idea: "Idee", other: "Sonstiges" };

export default function AdminPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  const currentUser = await requireAdmin();
  const supabase = await createClient();

  const [{ data: profiles }, { data: access }, { data: moduleRows }, { data: feedbackRows }] = await Promise.all([
    supabase.from("profiles").select("id, email, is_admin").order("created_at"),
    supabase.from("module_access").select("user_id, module_id"),
    supabase.from("modules").select("id, visibility"),
    supabase
      .from("feedback")
      .select("id, user_id, kind, message, page, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const hasAccess = new Set((access ?? []).map((row) => `${row.user_id}:${row.module_id}`));
  const visibility = new Map((moduleRows ?? []).map((row) => [row.id, row.visibility]));
  const emails = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]));
  const feedback = [...(feedbackRows ?? [])].sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
  const openFeedback = feedback.filter((entry) => entry.status === "new").length;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Jemanden einladen</h2>
          </CardTitle>
          <CardDescription>Die Person kann sich danach auf /login mit einem Anmeldelink anmelden.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={inviteUser} className="space-y-4">
            <div className="max-w-sm space-y-2">
              <Label htmlFor="invite-email">E-Mail</Label>
              <Input id="invite-email" name="email" type="email" required placeholder="freundin@beispiel.de" />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Module</legend>
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
            <Button>Person hinzufügen</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Personen und Zugriff</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-Mail</TableHead>
                {modules.map((module) => (
                  <TableHead key={module.id}>
                    {module.icon} {module.name}
                  </TableHead>
                ))}
                <TableHead>
                  <span className="sr-only">Aktionen</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(profiles ?? []).map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      {profile.email}
                      {profile.is_admin && <Badge variant="secondary">Admin</Badge>}
                    </span>
                  </TableCell>
                  {modules.map((module) => {
                    const enabled = profile.is_admin || hasAccess.has(`${profile.id}:${module.id}`);
                    return (
                      <TableCell key={module.id}>
                        {profile.is_admin ? (
                          <CheckIcon aria-label="Hat Zugriff" className="size-4 text-brand" />
                        ) : (
                          <form action={setModuleAccess}>
                            <input type="hidden" name="userId" value={profile.id} />
                            <input type="hidden" name="moduleId" value={module.id} />
                            <input type="hidden" name="enabled" value={String(!enabled)} />
                            <Button size="sm" variant={enabled ? "secondary" : "outline"}>
                              {enabled ? (
                                <>
                                  <CheckIcon className="text-brand" /> Entziehen
                                </>
                              ) : (
                                "Freigeben"
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
                          Entfernen
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
            <h2>Sichtbarkeit der Module</h2>
          </CardTitle>
          <CardDescription>Öffentliche Module lassen sich ohne Anmeldung öffnen.</CardDescription>
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
                  <Badge variant={isPublic ? "default" : "outline"}>{isPublic ? "öffentlich" : "privat"}</Badge>
                  <form action={setModuleVisibility} className="ml-auto">
                    <input type="hidden" name="moduleId" value={module.id} />
                    <input type="hidden" name="visibility" value={isPublic ? "private" : "public"} />
                    <Button size="sm" variant="outline">
                      {isPublic ? "Privat machen" : "Öffentlich machen"}
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Feedback</h2>
          </CardTitle>
          <CardDescription>
            {openFeedback === 1 ? "1 offener Eintrag" : `${openFeedback} offene Einträge`}. Alles liegt auch in der
            Tabelle <code className="font-mono">public.feedback</code> in Supabase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {feedback.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch kein Feedback.</p>
          ) : (
            <ul className="divide-y">
              {feedback.map((entry) => {
                const done = entry.status === "done";
                return (
                  <li key={entry.id} className={`flex flex-col gap-2 py-3 sm:flex-row sm:items-start ${done ? "text-muted-foreground" : ""}`}>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant={entry.kind === "bug" ? "destructive" : "secondary"}>
                          {feedbackKinds[entry.kind] ?? entry.kind}
                        </Badge>
                        <span>{emails.get(entry.user_id) ?? "gelöschte Person"}</span>
                        {entry.page && <span className="font-mono">{entry.page}</span>}
                        <span>
                          {new Date(entry.created_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                      </div>
                      <p className={`whitespace-pre-wrap ${done ? "line-through" : ""}`}>{entry.message}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <form action={setFeedbackStatus}>
                        <input type="hidden" name="feedbackId" value={entry.id} />
                        <input type="hidden" name="status" value={done ? "new" : "done"} />
                        <Button size="sm" variant="outline">
                          {done ? "Wieder öffnen" : "Erledigt"}
                        </Button>
                      </form>
                      <form action={deleteFeedback}>
                        <input type="hidden" name="feedbackId" value={entry.id} />
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                          Löschen
                        </Button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
