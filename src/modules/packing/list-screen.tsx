"use client";

import { ChevronLeftIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resetList, setChipActive, tickItems } from "./actions";
import { Checklist } from "./checklist";
import type { Chip, Item, Section } from "./data";
import { Editor } from "./editor";

const PATH = "/m/packing";

// One list: tick mode by default, edit mode behind the pencil.
//
// Ticks and chip switches live here (on top of the server's data) and are
// saved in the background without re-rendering the page, so tapping through
// the list never waits for the network. They survive switching to edit mode.
export function ListScreen({
  list,
  sections,
  items: savedItems,
  chips: savedChips,
  startInEditMode,
}: {
  list: { id: string; name: string; starred: boolean };
  sections: Section[];
  items: Item[];
  chips: Chip[];
  startInEditMode: boolean;
}) {
  const [editing, setEditing] = useState(startInEditMode);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();
  const router = useRouter();

  // Saves in the background. If saving fails (e.g. no signal), reload the
  // list from the server instead of crashing the page.
  function save(action: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await action();
      } catch {
        setDone({});
        setActive({});
        router.refresh();
      }
    });
  }

  const items = savedItems.map((item) => (item.id in done ? { ...item, done: done[item.id] } : item));
  const chips = savedChips.map((chip) => (chip.id in active ? { ...chip, active: active[chip.id] } : chip));

  function tick(ids: string[], value: boolean) {
    setDone((current) => ({ ...current, ...Object.fromEntries(ids.map((id) => [id, value])) }));
    save(() => tickItems(ids, value));
  }

  function reset() {
    setDone((current) => ({ ...current, ...Object.fromEntries(savedItems.map((item) => [item.id, false])) }));
    save(() => resetList(list.id));
  }

  function toggleChip(chip: Chip) {
    setActive((current) => ({ ...current, [chip.id]: !chip.active }));
    save(() => setChipActive(chip.id, !chip.active));
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
