import { ChevronLeftIcon, ChevronRightIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="mx-auto max-w-2xl space-y-3">
        <form action={loadStarter}>
          <SubmitButton size="lg" className="h-12 w-full">
            Nach Stuttgart & Nach Bellenberg anlegen
          </SubmitButton>
        </form>
        <div className="overflow-hidden rounded-xl border bg-card">
          <NewListForm />
        </div>
      </div>
    );
  }

  const starred = lists.filter((list) => list.starred);
  const others = lists.filter((list) => !list.starred);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {starred.length > 0 && (
        <ul className="grid grid-cols-2 gap-3">
          {starred.map((list) => {
            const { done, total } = listProgress(list.id);
            return (
              <li key={list.id}>
                <Link
                  href={`${PATH}?list=${list.id}`}
                  className="flex h-full min-h-28 flex-col justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm active:bg-accent"
                >
                  <span className="text-lg leading-tight font-semibold">{list.name}</span>
                  <span className="space-y-1.5">
                    <span className="block font-mono text-sm text-muted-foreground">
                      {done}/{total}
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

      <section aria-label="Listen" className="space-y-1.5">
        {starred.length > 0 && <h2 className="px-1 text-sm font-medium text-muted-foreground">Weitere Listen</h2>}
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {others.map((list) => {
            const { done, total } = listProgress(list.id);
            return (
              <li key={list.id}>
                <Link href={`${PATH}?list=${list.id}`} className="flex min-h-12 items-center gap-3 px-4 active:bg-accent">
                  <span className="flex-1">{list.name}</span>
                  <span className="font-mono text-sm text-muted-foreground">
                    {done}/{total}
                  </span>
                  <ChevronRightIcon className="size-4 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
          <li>
            <NewListForm />
          </li>
        </ul>
      </section>

      <section aria-label="Inventar" className="space-y-1.5">
        <h2 className="px-1 text-sm font-medium text-muted-foreground">Inventar</h2>
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {places.map((place) => (
            <li key={place.id}>
              <Link href={`${PATH}?place=${place.id}`} className="flex min-h-12 items-center gap-3 px-4 active:bg-accent">
                <span className="flex-1">{place.name}</span>
                <span className="font-mono text-sm text-muted-foreground">
                  {(inventoryRows ?? []).filter((row) => row.place_id === place.id).length}
                </span>
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
          <li>
            <form action={addPlace}>
              <Input
                name="name"
                required
                maxLength={60}
                aria-label="Neuer Ort"
                placeholder="+ Ort"
                enterKeyHint="enter"
                className="h-12 rounded-none border-0 px-4 shadow-none focus-visible:ring-0"
              />
            </form>
          </li>
        </ul>
      </section>
    </div>
  );
}

// Enter creates the list and opens it in edit mode.
function NewListForm() {
  return (
    <form action={createList}>
      <Input
        name="name"
        required
        maxLength={80}
        aria-label="Neue Liste"
        placeholder="+ Neue Liste, z. B. Urlaub"
        enterKeyHint="enter"
        className="h-12 rounded-none border-0 px-4 shadow-none focus-visible:ring-0"
      />
    </form>
  );
}

// --- One list ---------------------------------------------------------------

async function ListView({ listId, startInEditMode }: { listId: string; startInEditMode: boolean }) {
  const supabase = await createClient();
  const [{ data: list }, { data: sectionRows }, { data: itemRows }, { data: chipRows }] = await Promise.all([
    supabase.from("packing_lists").select("id, name, starred").eq("id", listId).maybeSingle<List>(),
    supabase.from("packing_sections").select("id, name").eq("list_id", listId).order("sort").order("created_at"),
    supabase
      .from("packing_items")
      .select("id, list_id, section_id, chip_id, name, note, done")
      .eq("list_id", listId)
      .order("sort")
      .order("created_at"),
    supabase.from("packing_chips").select("id, name, active").eq("list_id", listId).order("sort").order("created_at"),
  ]);
  if (!list) notFound();

  return (
    <ListScreen
      list={list}
      sections={(sectionRows ?? []) as Section[]}
      items={((itemRows ?? []) as ItemRow[]).map(toItem)}
      chips={(chipRows ?? []) as Chip[]}
      startInEditMode={startInEditMode}
    />
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
