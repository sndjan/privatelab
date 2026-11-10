"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeftIcon, PencilIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { dataQuery, type LoaderResult } from "@/lib/query/data";
import { ViewLink as Link } from "@/lib/query/view-link";
import { addOnceItem, addStock, removeOnceItem, resetList, restoreOnceItems, setChipActive, setStock, tickItems } from "./actions";
import { Checklist } from "./checklist";
import type { Chip, Item, Section, Stock } from "./data";
import { Editor } from "./editor";

const PATH = "/m/packing";

type ListData = LoaderResult<"packing", "list">;

// One list: tick mode by default, edit mode behind the pencil.
//
// Ticks and chip switches go straight into the browser cache and are saved
// in the background, so tapping through the list never waits for the
// network. They survive switching to edit mode and leaving the list.
export function ListScreen({
  list,
  sections,
  items,
  chips,
  places,
  place,
  inventory,
  startInEditMode,
}: {
  list: { id: string; name: string; starred: boolean; placeId: string | null };
  sections: Section[];
  items: Item[];
  chips: Chip[];
  places: { id: string; name: string }[];
  place: { id: string; name: string } | null;
  inventory: Stock[];
  startInEditMode: boolean;
}) {
  const [editing, setEditing] = useState(startInEditMode);
  const queryClient = useQueryClient();
  const listKey = dataQuery("packing", "list", { id: list.id }).queryKey;

  // Changes the cached list at once and saves in the background. If saving
  // fails (e.g. no signal), the list is loaded again from the server.
  function change(patch: (data: ListData) => Partial<ListData>, action: () => Promise<unknown>) {
    void queryClient.cancelQueries({ queryKey: listKey });
    queryClient.setQueryData(listKey, (data) => (data ? { ...data, ...patch(data) } : data));
    // Not in a transition: a pending save would hold back switching views.
    action()
      .catch(() => queryClient.invalidateQueries({ queryKey: listKey }))
      // The overview's progress.
      .finally(() => queryClient.invalidateQueries({ queryKey: ["packing", "overview"] }));
  }

  function tick(ids: string[], value: boolean) {
    change(
      (data) => ({ items: data.items.map((item) => (ids.includes(item.id) ? { ...item, done: value } : item)) }),
      () => tickItems(ids, value),
    );
  }

  // Ticked one-off items go, everything else is unticked.
  function reset() {
    change(
      (data) => ({
        items: data.items.filter((item) => !(item.once && item.done)).map((item) => ({ ...item, done: false })),
      }),
      () => resetList(list.id),
    );
  }

  // Undo of a reset: ticks again what was ticked and brings back the deleted one-off items.
  function restore(ticked: Item[]) {
    const kept = ticked.filter((item) => !item.once).map((item) => item.id);
    const gone = ticked.filter((item) => item.once);
    change(
      (data) => ({
        items: [
          ...data.items.map((item) => (kept.includes(item.id) ? { ...item, done: true } : item)),
          ...gone.map((item) => ({ ...item, listId: list.id, id: `tmp-${item.id}` })),
        ],
      }),
      async () => {
        await Promise.all([tickItems(kept, true), restoreOnceItems(list.id, gone)]);
        // The restored one-off items have new ids.
        if (gone.length > 0) await queryClient.invalidateQueries({ queryKey: listKey });
      },
    );
  }

  function addOnce(name: string) {
    const sectionId = sections[0]?.id;
    if (!sectionId) return;
    const temp = `tmp-${Math.random().toString(36).slice(2)}`;
    change(
      (data) => ({
        items: [...data.items, { id: temp, listId: list.id, sectionId, chipId: null, name, note: null, done: false, once: true }],
      }),
      async () => {
        const id = await addOnceItem(list.id, sectionId, name);
        queryClient.setQueryData(listKey, (data) =>
          data && id ? { ...data, items: data.items.map((item) => (item.id === temp ? { ...item, id } : item)) } : data,
        );
      },
    );
  }

  function removeOnce(id: string) {
    change((data) => ({ items: data.items.filter((item) => item.id !== id) }), () => removeOnceItem(id));
  }

  // The destination's inventory, changed from inside the list.
  function changeStock(id: string, quantity: number) {
    change(
      (data) => ({ inventory: data.inventory.map((entry) => (entry.id === id ? { ...entry, quantity } : entry)) }),
      () => setStock(id, quantity).finally(() => queryClient.invalidateQueries({ queryKey: ["packing", "place"] })),
    );
  }

  function newStock(name: string) {
    if (!place) return;
    const existing = inventory.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
    if (existing) return changeStock(existing.id, Math.max(existing.quantity, 1));
    change(
      (data) => ({
        inventory: [...data.inventory, { id: `tmp-${name}`, name, quantity: 1 }].sort((a, b) => a.name.localeCompare(b.name, "de")),
      }),
      async () => {
        await addStock(place.id, name, 1);
        await queryClient.invalidateQueries({ queryKey: listKey });
        void queryClient.invalidateQueries({ queryKey: ["packing", "place"] });
      },
    );
  }

  function toggleChip(chip: Chip) {
    change(
      (data) => ({ chips: data.chips.map((entry) => (entry.id === chip.id ? { ...entry, active: !chip.active } : entry)) }),
      () => setChipActive(chip.id, !chip.active),
    );
  }

  function toggleMode() {
    // A new list opens with ?edit=1; drop it so a reload shows the checklist.
    if (editing) window.history.replaceState(null, "", `?list=${list.id}`);
    setEditing(!editing);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {editing ? (
        <Editor
          list={list}
          sections={sections}
          items={items.filter((item) => !item.once)}
          chips={chips}
          places={places}
          onDone={toggleMode}
        />
      ) : (
        <>
          <div className="-ml-2 flex items-center gap-1">
            <Button asChild variant="ghost" size="icon" className="size-10 text-muted-foreground">
              <Link href={PATH} aria-label="Zur Übersicht">
                <ChevronLeftIcon className="size-5" />
              </Link>
            </Button>
            <h2 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">{list.name}</h2>
            <Button variant="ghost" size="icon" className="size-10" aria-label="Liste bearbeiten" onClick={toggleMode}>
              <PencilIcon />
            </Button>
          </div>
          <Checklist
            sections={sections}
            items={items}
            chips={chips}
            onTick={tick}
            onReset={reset}
            onRestore={restore}
            onChip={toggleChip}
            onEdit={toggleMode}
            onAddOnce={addOnce}
            onRemoveOnce={removeOnce}
            place={place}
            inventory={inventory}
            onStock={changeStock}
            onAddStock={newStock}
          />
        </>
      )}
    </div>
  );
}
