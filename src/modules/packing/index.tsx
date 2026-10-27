import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/server";
import type { ModulePageProps } from "@/modules/registry";
import {
  addInventoryItem,
  addPlace,
  addRunItem,
  createTemplate,
  deleteInventoryItem,
  deletePlace,
  deleteRun,
  deleteTemplate,
  deleteTemplateItem,
  finishRun,
  loadStarter,
  reopenRun,
  updateTemplate,
} from "./actions";
import { conditionLabel, formatDate, type ItemKind } from "./data";
import { ItemDialog } from "./item-dialog";
import { QuantityStepper } from "./quantity-stepper";
import { RunChecklist, type RunItem } from "./run-checklist";
import { StartRun } from "./start-run";

const PATH = "/m/packing";

type Place = { id: string; name: string };
type Template = { id: string; name: string; from_place_id: string | null; to_place_id: string | null };
type Run = {
  id: string;
  title: string;
  trip_date: string;
  from_place_id: string | null;
  to_place_id: string | null;
  conditions: string[];
  finished_at: string | null;
};

export default async function PackingModule({ user, hasAccess, searchParams }: ModulePageProps) {
  if (!user || !hasAccess) notFound();

  const params = await searchParams;
  const param = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);

  const supabase = await createClient();
  const { data: placeRows } = await supabase.from("packing_places").select("id, name").order("created_at");
  const places = (placeRows ?? []) as Place[];

  const runId = param("run");
  if (runId) return <RunView runId={runId} places={places} />;
  const templateId = param("template");
  if (templateId) return <TemplateView templateId={templateId} places={places} />;
  const placeId = param("place");
  if (placeId) return <PlaceView place={places.find((place) => place.id === placeId)} />;
  return <Overview places={places} />;
}

function placeName(places: Place[], id: string | null) {
  return places.find((place) => place.id === id)?.name ?? null;
}

function route(places: Place[], from: string | null, to: string | null) {
  const a = placeName(places, from);
  const b = placeName(places, to);
  return a && b ? `${a} → ${b}` : (b ?? a);
}

// --- Overview ---------------------------------------------------------------

async function Overview({ places }: { places: Place[] }) {
  const supabase = await createClient();
  const [{ data: templateRows }, { data: runRows }, { data: itemRows }, { data: inventoryRows }] = await Promise.all([
    supabase.from("packing_templates").select("id, name, from_place_id, to_place_id").order("created_at"),
    supabase
      .from("packing_runs")
      .select("id, title, trip_date, from_place_id, to_place_id, conditions, finished_at")
      .order("trip_date", { ascending: false })
      .limit(30),
    supabase.from("packing_template_items").select("template_id"),
    supabase.from("packing_inventory").select("place_id"),
  ]);
  const templates = (templateRows ?? []) as Template[];
  const runs = (runRows ?? []) as Run[];
  const openRuns = runs.filter((run) => !run.finished_at);
  const finishedRuns = runs.filter((run) => run.finished_at).slice(0, 10);

  const { data: progressRows } = openRuns.length
    ? await supabase
        .from("packing_run_items")
        .select("run_id, done")
        .in(
          "run_id",
          openRuns.map((run) => run.id),
        )
        .eq("at_destination", false)
    : { data: [] };
  const progress = (id: string) => {
    const rows = (progressRows ?? []).filter((row) => row.run_id === id);
    return { done: rows.filter((row) => row.done).length, total: rows.length };
  };
  const count = (rows: { [key: string]: string }[] | null, key: string, id: string) =>
    (rows ?? []).filter((row) => row[key] === id).length;

  if (places.length === 0 && templates.length === 0) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Noch keine Packlisten</h2>
          </CardTitle>
          <CardDescription>
            Starte mit den Vorlagen für Bellenberg ↔ Stuttgart: zwei Listen, Aufgaben vor der Abfahrt und das Inventar
            in Stuttgart. Alles lässt sich danach ändern.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <form action={loadStarter}>
            <SubmitButton size="lg">Startvorlagen laden</SubmitButton>
          </form>
          <form action={addPlace} className="flex gap-2">
            <Label htmlFor="first-place" className="sr-only">
              Ort
            </Label>
            <Input id="first-place" name="name" required maxLength={60} placeholder="Oder ersten Ort anlegen" className="h-11" />
            <SubmitButton variant="outline" size="lg">
              Anlegen
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {openRuns.length > 0 && (
        <section aria-labelledby="open-runs" className="space-y-3">
          <h2 id="open-runs" className="text-lg font-semibold">
            Laufende Listen
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {openRuns.map((run) => {
              const { done, total } = progress(run.id);
              return (
                <li key={run.id}>
                  <Link
                    href={`${PATH}?run=${run.id}`}
                    className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm hover:border-input"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="font-semibold">{run.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(run.trip_date)}
                        {route(places, run.from_place_id, run.to_place_id) &&
                          ` · ${route(places, run.from_place_id, run.to_place_id)}`}
                      </span>
                    </span>
                    <span className="font-mono text-sm">
                      {done}/{total}
                    </span>
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <StartRun
        today={today()}
        templates={templates.map((template) => ({
          id: template.id,
          name: template.name,
          route: route(places, template.from_place_id, template.to_place_id),
        }))}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <h2>Vorlagen</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="divide-y">
              {templates.map((template) => (
                <li key={template.id}>
                  <Link href={`${PATH}?template=${template.id}`} className="flex items-center gap-3 py-3 hover:text-brand">
                    <span className="flex flex-1 flex-col">
                      <span className="font-medium">{template.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {route(places, template.from_place_id, template.to_place_id) ?? "ohne Route"} ·{" "}
                        {count(itemRows, "template_id", template.id)} Einträge
                      </span>
                    </span>
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
            <form action={createTemplate} className="space-y-3 rounded-lg bg-muted p-3">
              <div className="space-y-2">
                <Label htmlFor="new-template">Neue Vorlage</Label>
                <Input id="new-template" name="name" required maxLength={80} placeholder="z. B. Nach Stuttgart" className="bg-card" />
              </div>
              <RouteFields places={places} />
              <SubmitButton variant="outline" className="bg-card">
                Vorlage anlegen
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <h2>Orte und Inventar</h2>
            </CardTitle>
            <CardDescription>Was schon am Zielort ist, musst du nicht einpacken.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="divide-y">
              {places.map((place) => (
                <li key={place.id}>
                  <Link href={`${PATH}?place=${place.id}`} className="flex items-center gap-3 py-3 hover:text-brand">
                    <span className="flex flex-1 flex-col">
                      <span className="font-medium">{place.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {count(inventoryRows, "place_id", place.id)} Sachen im Inventar
                      </span>
                    </span>
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
            <form action={addPlace} className="flex gap-2">
              <Label htmlFor="new-place" className="sr-only">
                Neuer Ort
              </Label>
              <Input id="new-place" name="name" required maxLength={60} placeholder="Neuer Ort" />
              <SubmitButton variant="outline">Anlegen</SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>

      {finishedRuns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <h2>Verlauf</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {finishedRuns.map((run) => (
                <li key={run.id}>
                  <Link href={`${PATH}?run=${run.id}`} className="flex items-center gap-3 py-2.5 hover:text-brand">
                    <span className="flex-1">{run.title}</span>
                    <span className="text-sm text-muted-foreground">{formatDate(run.trip_date)}</span>
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- One run ----------------------------------------------------------------

async function RunView({ runId, places }: { runId: string; places: Place[] }) {
  const supabase = await createClient();
  const { data: run } = await supabase
    .from("packing_runs")
    .select("id, title, trip_date, from_place_id, to_place_id, conditions, finished_at")
    .eq("id", runId)
    .maybeSingle<Run>();
  if (!run) notFound();

  const [{ data: itemRows }, { data: missingRows }] = await Promise.all([
    supabase
      .from("packing_run_items")
      .select("id, name, note, kind, done, forgotten, pinned, at_destination")
      .eq("run_id", run.id)
      .order("sort"),
    run.to_place_id
      ? supabase.from("packing_inventory").select("name").eq("place_id", run.to_place_id).eq("quantity", 0).order("name")
      : Promise.resolve({ data: [] }),
  ]);
  const items: RunItem[] = (itemRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    note: row.note,
    kind: row.kind,
    done: row.done,
    forgotten: row.forgotten,
    pinned: row.pinned,
    atDestination: row.at_destination,
  }));
  const destination = placeName(places, run.to_place_id);
  const missing = (missingRows ?? []) as { name: string }[];

  return (
    <div className="space-y-6">
      <BackLink />
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{run.title}</h2>
        <p className="text-muted-foreground">
          {formatDate(run.trip_date)}
          {route(places, run.from_place_id, run.to_place_id) && ` · ${route(places, run.from_place_id, run.to_place_id)}`}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {run.finished_at && <Badge>Abgeschlossen</Badge>}
          {run.conditions.map((condition) => (
            <Badge key={condition} variant="outline">
              {conditionLabel(condition)}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <RunChecklist items={items} destination={destination} />

        <div className="space-y-6">
          {missing.length > 0 && destination && (
            <Card className="gap-3">
              <CardHeader>
                <CardTitle>
                  <h2>Fehlt in {destination}</h2>
                </CardTitle>
                <CardDescription>Laut Inventar ist davon nichts mehr dort.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="flex flex-wrap gap-1.5">
                  {missing.map((entry) => (
                    <li key={entry.name}>
                      <Badge variant="secondary" className="text-sm">
                        {entry.name}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <Button asChild variant="link" className="h-auto px-0">
                  <Link href={`${PATH}?place=${run.to_place_id}`}>Inventar bearbeiten</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {!run.finished_at && (
            <Card className="gap-3">
              <CardHeader>
                <CardTitle>
                  <h2>Nur diesmal</h2>
                </CardTitle>
                <CardDescription>Ein Eintrag nur für diese Liste, die Vorlage bleibt gleich.</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={addRunItem} className="flex gap-2">
                  <input type="hidden" name="runId" value={run.id} />
                  <Label htmlFor="extra-item" className="sr-only">
                    Eintrag
                  </Label>
                  <Input id="extra-item" name="name" required maxLength={80} placeholder="z. B. Geschenk" />
                  <SubmitButton variant="outline">Hinzufügen</SubmitButton>
                </form>
              </CardContent>
            </Card>
          )}

          <Card className="gap-3">
            <CardHeader>
              <CardDescription>
                {run.finished_at
                  ? "Abgeschlossen. Markierte Sachen stehen nächstes Mal oben."
                  : "Markiere Vergessenes mit der Flagge und schließ die Liste nach der Reise ab."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <form action={run.finished_at ? reopenRun : finishRun}>
                <input type="hidden" name="runId" value={run.id} />
                <SubmitButton variant={run.finished_at ? "outline" : "brand"}>
                  {run.finished_at ? "Wieder öffnen" : "Reise abschließen"}
                </SubmitButton>
              </form>
              <form action={deleteRun}>
                <input type="hidden" name="runId" value={run.id} />
                <SubmitButton variant="ghost" className="text-destructive hover:text-destructive">
                  Löschen
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --- One template -----------------------------------------------------------

async function TemplateView({ templateId, places }: { templateId: string; places: Place[] }) {
  const supabase = await createClient();
  const { data: template } = await supabase
    .from("packing_templates")
    .select("id, name, from_place_id, to_place_id")
    .eq("id", templateId)
    .maybeSingle<Template>();
  if (!template) notFound();

  const { data: itemRows } = await supabase
    .from("packing_template_items")
    .select("id, name, note, kind, conditions, forgotten")
    .eq("template_id", template.id)
    .order("created_at");
  const items = (itemRows ?? []) as {
    id: string;
    name: string;
    note: string | null;
    kind: ItemKind;
    conditions: string[];
    forgotten: boolean;
  }[];

  return (
    <div className="space-y-6">
      <BackLink />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Vorlage</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateTemplate} className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input type="hidden" name="templateId" value={template.id} />
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="template-name">Name</Label>
                <Input id="template-name" name="name" required maxLength={80} defaultValue={template.name} />
              </div>
              <RouteFields places={places} from={template.from_place_id} to={template.to_place_id} />
            </div>
            <SubmitButton>Speichern</SubmitButton>
          </form>
        </CardContent>
      </Card>

      {(["pack", "task"] as const).map((kind) => {
        const list = items.filter((item) => item.kind === kind);
        return (
          <Card key={kind}>
            <CardHeader>
              <CardTitle className="text-lg">
                <h2>{kind === "pack" ? "Einpacken" : "Vor der Abfahrt erledigen"}</h2>
              </CardTitle>
              <CardDescription>{list.length} Einträge</CardDescription>
              <CardAction>
                <ItemDialog templateId={template.id} defaultKind={kind} />
              </CardAction>
            </CardHeader>
            <CardContent>
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch nichts.</p>
              ) : (
                <ul className="divide-y">
                  {list.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 py-1.5">
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          {item.name}
                          {item.conditions.map((condition) => (
                            <Badge key={condition} variant="outline">
                              {conditionLabel(condition)}
                            </Badge>
                          ))}
                          {item.forgotten && <Badge className="bg-bad text-bad-foreground">zuletzt vergessen</Badge>}
                        </span>
                        {item.note && <span className="text-xs text-muted-foreground">{item.note}</span>}
                      </span>
                      <ItemDialog templateId={template.id} item={item} />
                      <form action={deleteTemplateItem}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <SubmitButton
                          variant="ghost"
                          size="icon"
                          aria-label={`${item.name} löschen`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2Icon />
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}

      <form action={deleteTemplate}>
        <input type="hidden" name="templateId" value={template.id} />
        <SubmitButton variant="ghost" className="text-destructive hover:text-destructive">
          Vorlage löschen
        </SubmitButton>
      </form>
    </div>
  );
}

// --- One place and its inventory --------------------------------------------

async function PlaceView({ place }: { place: Place | undefined }) {
  if (!place) notFound();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("packing_inventory")
    .select("id, name, quantity")
    .eq("place_id", place.id)
    .order("name");
  const inventory = (rows ?? []) as { id: string; name: string; quantity: number }[];

  return (
    <div className="space-y-6">
      <BackLink />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Inventar in {place.name}</h2>
          </CardTitle>
          <CardDescription>
            Sachen mit mindestens einem Stück musst du auf dem Weg hierher nicht einpacken. Bei 0 erscheint die Sache in
            der Liste unter „Fehlt in {place.name}“.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {inventory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch nichts eingetragen.</p>
          ) : (
            <ul className="divide-y">
              {inventory.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-1.5">
                  <span className={`flex-1 ${entry.quantity === 0 ? "text-muted-foreground" : ""}`}>{entry.name}</span>
                  <QuantityStepper id={entry.id} name={entry.name} quantity={entry.quantity} />
                  <form action={deleteInventoryItem}>
                    <input type="hidden" name="itemId" value={entry.id} />
                    <SubmitButton
                      variant="ghost"
                      size="icon"
                      aria-label={`${entry.name} löschen`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2Icon />
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addInventoryItem} className="flex flex-wrap items-end gap-2 rounded-lg bg-muted p-3">
            <input type="hidden" name="placeId" value={place.id} />
            <div className="min-w-40 flex-1 space-y-2">
              <Label htmlFor="inventory-name">Sache</Label>
              <Input id="inventory-name" name="name" required maxLength={80} placeholder="z. B. Ladekabel" className="bg-card" />
            </div>
            <div className="w-24 space-y-2">
              <Label htmlFor="inventory-quantity">Anzahl</Label>
              <Input
                id="inventory-quantity"
                name="quantity"
                type="number"
                min={0}
                max={999}
                defaultValue={1}
                className="bg-card font-mono"
              />
            </div>
            <SubmitButton variant="outline" className="bg-card">
              Eintragen
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      <form action={deletePlace}>
        <input type="hidden" name="placeId" value={place.id} />
        <SubmitButton variant="ghost" className="text-destructive hover:text-destructive">
          Ort löschen
        </SubmitButton>
      </form>
    </div>
  );
}

// --- Shared bits --------------------------------------------------------------

function BackLink() {
  return (
    <Button asChild variant="ghost" className="-ml-3 text-muted-foreground">
      <Link href={PATH}>
        <ChevronLeftIcon /> Übersicht
      </Link>
    </Button>
  );
}

function RouteFields({ places, from, to }: { places: Place[]; from?: string | null; to?: string | null }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <PlaceSelect name="from" label="Von" places={places} value={from} />
      <ArrowRightIcon aria-hidden="true" className="mb-2.5 size-4 text-muted-foreground" />
      <PlaceSelect name="to" label="Nach" places={places} value={to} />
    </div>
  );
}

function PlaceSelect({
  name,
  label,
  places,
  value,
}: {
  name: string;
  label: string;
  places: Place[];
  value?: string | null;
}) {
  const id = `place-${name}-${value ?? "new"}`;
  return (
    <div className="min-w-36 flex-1 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select name={name} defaultValue={value ?? "none"}>
        <SelectTrigger id={id} className="w-full bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Kein Ort</SelectItem>
          {places.map((place) => (
            <SelectItem key={place.id} value={place.id}>
              {place.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
