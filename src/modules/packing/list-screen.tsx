"use client";

import { CheckIcon, PencilIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checklist } from "./checklist";
import type { Chip, Item, Section } from "./data";
import { Editor } from "./editor";

// One list: tick mode by default, edit mode behind the pencil.
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

  function toggle() {
    // A new list opens with ?edit=1; drop it so a reload shows the checklist.
    if (editing) window.history.replaceState(null, "", `?list=${list.id}`);
    setEditing(!editing);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-2xl font-semibold tracking-tight">{list.name}</h2>
        <Button variant={editing ? "brand" : "outline"} onClick={toggle}>
          {editing ? <CheckIcon /> : <PencilIcon />}
          {editing ? "Fertig" : "Bearbeiten"}
        </Button>
      </div>
      {editing ? (
        <Editor list={list} sections={sections} items={items} chips={chips} />
      ) : (
        <Checklist listId={list.id} sections={sections} items={items} chips={chips} />
      )}
    </div>
  );
}
