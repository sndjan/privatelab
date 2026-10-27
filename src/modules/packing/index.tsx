import { ChevronLeftIcon, ChevronRightIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/server";
import type { ModulePageProps } from "@/modules/registry";
import {
  addInventoryItem,
  addPlace,
  createList,
  deleteInventoryItem,
  deletePlace,
  loadStarter,
} from "./actions";
import { progress, type Chip, type Item, type Section } from "./data";
import { ListScreen } from "./list-screen";
import { QuantityStepper } from "./quantity-stepper";

const PATH = "/m/packing";

type Place = { id: string; name: string };
type List = { id: string; name: string; starred: boolean };

export default async function PackingModule({ user, hasAccess, searchParams }: ModulePageProps) {
  if (!user || !hasAccess) notFound();

  const params = await searchParams;
  const param = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);

  const listId = param("list");
  if (listId) return <ListView listId={listId} startInEditMode={param("edit") === "1"} />;
  const placeId = param("place");
  if (placeId) return <PlaceView placeId={placeId} />;
  return <Overview />;
}

type ItemRow = {
  id: string;
  list_id: string;
  section_id: string;
  chip_id: string | null;
  name: string;
  note: string | null;
  done: boolean;
};

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    sectionId: row.section_id,
    chipId: row.chip_id,
    name: row.name,
    note: row.note,
    done: row.done,
  };
}

// --- Overview ---------------------------------------------------------------

async function Overview() {
  const supabase = await createClient();
  const [{ data: listRows }, { data: itemRows }, { data: chipRows }, { data: placeRows }, { data: inventoryRows }] =
    await Promise.all([
      supabase.from("packing_lists").select("id, name, starred").order("created_at"),
      supabase.from("packing_items").select("id, list_id, section_id, chip_id, name, note, done"),
      supabase.from("packing_chips").select("id, list_id, name, active"),
      supabase.from("packing_places").select("id, name").order("created_at"),
      supabase.from("packing_inventory").select("place_id"),
    ]);
  const lists = (listRows ?? []) as List[];
  const places = (placeRows ?? []) as Place[];
  const items = (itemRows ?? []) as ItemRow[];
  const chips = (chipRows ?? []) as (Chip & { list_id: string })[];

  const listProgress = (id: string) =>
    progress(
      items.filter((row) => row.list_id === id).map(toItem),
      chips.filter((chip) => chip.list_id === id),
    );

  if (lists.length === 0) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Noch keine Packlisten</h2>
          </CardTitle>
          <CardDescription>
            Starte mit den Listen „Nach Stuttgart“ und „Nach Bellenberg“, sortiert in Abschnitte, mit Chips für Winter,
            Gym und Regen. Alles lässt sich danach ändern.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <form action={loadStarter}>
            <SubmitButton size="lg">Startlisten laden</SubmitButton>
          </form>
          <NewListForm />
        </CardContent>
      </Card>
    );
  }

  const starred = lists.filter((list) => list.starred);
  const others = lists.filter((list) => !list.starred);

  return (
    <div className="space-y-6">
      {starred.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {starred.map((list) => {
            const { done, total } = listProgress(list.id);
            return (
              <li key={list.id}>
                <Link
                  href={`${PATH}?list=${list.id}`}
                  className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm hover:border-brand"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex-1 text-xl font-semibold">{list.name}</span>
                    <ChevronRightIcon className="size-5 text-muted-foreground" />
                  </span>
                  <span className="space-y-1.5">
                    <span className="block text-sm text-muted-foreground">
                      {total === 0
                        ? "Leer"
                        : done === 0
                          ? `${total} Einträge`
                          : done === total
                            ? "Alles dabei"
                            : `${done} von ${total} erledigt`}
                    </span>
                    <Progress
                      value={total ? (done / total) * 100 : 0}
                      aria-hidden="true"
                      className="h-1.5 bg-muted"
                      indicatorClassName="bg-brand"
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>{starred.length > 0 ? "Weitere Listen" : "Listen"}</h2>
          </CardTitle>
          <CardDescription>Für Urlaub und andere Reisen. Mit dem Stern erscheint eine Liste groß oben.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {others.length > 0 && (
            <ul className="divide-y">
              {others.map((list) => {
                const { done, total } = listProgress(list.id);
                return (
                  <li key={list.id}>
                    <Link href={`${PATH}?list=${list.id}`} className="flex items-center gap-3 py-3 hover:text-brand">
                      <span className="flex-1 font-medium">{list.name}</span>
                      <span className="font-mono text-sm text-muted-foreground">
                        {done}/{total}
                      </span>
                      <ChevronRightIcon className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <NewListForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Inventar</h2>
          </CardTitle>
          <CardDescription>Was an welchem Ort schon da ist.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {places.length > 0 && (
            <ul className="divide-y">
              {places.map((place) => (
                <li key={place.id}>
                  <Link href={`${PATH}?place=${place.id}`} className="flex items-center gap-3 py-3 hover:text-brand">
                    <span className="flex flex-1 flex-col">
                      <span className="font-medium">{place.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(inventoryRows ?? []).filter((row) => row.place_id === place.id).length} Sachen im Inventar
                      </span>
                    </span>
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
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
  );
}

function NewListForm() {
  return (
    <form action={createList} className="flex flex-1 gap-2">
      <Label htmlFor="new-list" className="sr-only">
        Neue Liste
      </Label>
      <Input id="new-list" name="name" required maxLength={80} placeholder="Neue Liste, z. B. Urlaub" className="h-11" />
      <SubmitButton variant="outline" size="lg">
        Anlegen
      </SubmitButton>
    </form>
  );
}

// --- One list ---------------------------------------------------------------

async function ListView({ listId, startInEditMode }: { listId: string; startInEditMode: boolean }) {
  const supabase = await createClient();
  const { data: list } = await supabase
    .from("packing_lists")
    .select("id, name, starred")
    .eq("id", listId)
    .maybeSingle<List>();
  if (!list) notFound();

  const [{ data: sectionRows }, { data: itemRows }, { data: chipRows }] = await Promise.all([
    supabase.from("packing_sections").select("id, name").eq("list_id", list.id).order("sort").order("created_at"),
    supabase
      .from("packing_items")
      .select("id, list_id, section_id, chip_id, name, note, done")
      .eq("list_id", list.id)
      .order("sort")
      .order("created_at"),
    supabase.from("packing_chips").select("id, name, active").eq("list_id", list.id).order("sort").order("created_at"),
  ]);

  return (
    <div className="space-y-4">
      <BackLink />
      <ListScreen
        list={list}
        sections={(sectionRows ?? []) as Section[]}
        items={((itemRows ?? []) as ItemRow[]).map(toItem)}
        chips={(chipRows ?? []) as Chip[]}
        startInEditMode={startInEditMode}
      />
    </div>
  );
}

// --- One place and its inventory --------------------------------------------

async function PlaceView({ placeId }: { placeId: string }) {
  const supabase = await createClient();
  const { data: place } = await supabase
    .from("packing_places")
    .select("id, name")
    .eq("id", placeId)
    .maybeSingle<Place>();
  if (!place) notFound();
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
          <CardDescription>Was schon in {place.name} ist. Bei 0 ist gerade nichts davon dort.</CardDescription>
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
