"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeftIcon, PencilIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { dataQuery, type LoaderResult } from "@/lib/query/data";
import { ViewLink as Link } from "@/lib/query/view-link";
import { resetList, setChipActive, tickItems } from "./actions";
import { Checklist } from "./checklist";
import type { Chip, Item, Section } from "./data";
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
  startInEditMode,
}: {
  list: { id: string; name: string; starred: boolean };
  sections: Section[];
  items: Item[];
  chips: Chip[];
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

  function reset() {
    change((data) => ({ items: data.items.map((item) => ({ ...item, done: false })) }), () => resetList(list.id));
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
        <Editor list={list} sections={sections} items={items} chips={chips} onDone={toggleMode} />
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
            onChip={toggleChip}
            onEdit={toggleMode}
          />
        </>
      )}
    </div>
  );
}
