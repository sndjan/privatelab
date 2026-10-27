"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, PencilIcon, PlusIcon, StarIcon, Trash2Icon, XIcon } from "lucide-react";
import { useId, useOptimistic, useState, useTransition } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  addChip,
  addItem,
  addSection,
  deleteChip,
  deleteItem,
  deleteList,
  deleteSection,
  renameSection,
  reorderItems,
  reorderSections,
  updateChip,
  updateItem,
  updateList,
} from "./actions";
import type { Chip, Item, Section } from "./data";

type Order = { sections: string[]; items: Record<string, string[]> };
type Reorder = { type: "sections"; ids: string[] } | { type: "items"; sectionId: string; ids: string[] };

// Edit mode: name, star, chips, sections and items. Sections and items are
// sorted by dragging their handle; the new order shows at once and saves in
// the background.
export function Editor({
  list,
  sections,
  items,
  chips,
}: {
  list: { id: string; name: string; starred: boolean };
  sections: Section[];
  items: Item[];
  chips: Chip[];
}) {
  const saved: Order = {
    sections: sections.map((section) => section.id),
    items: Object.fromEntries(
      sections.map((section) => [
        section.id,
        items.filter((item) => item.sectionId === section.id).map((item) => item.id),
      ]),
    ),
  };
  const [order, apply] = useOptimistic<Order, Reorder>(saved, (current, change) =>
    change.type === "sections"
      ? { ...current, sections: change.ids }
      : { ...current, items: { ...current.items, [change.sectionId]: change.ids } },
  );
  const [starred, setStarred] = useOptimistic(list.starred);
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const dndId = useId();

  function onSectionDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = arrayMove(order.sections, order.sections.indexOf(String(active.id)), order.sections.indexOf(String(over.id)));
    startTransition(async () => {
      apply({ type: "sections", ids });
      await reorderSections(ids);
    });
  }

  function onItemsReorder(sectionId: string, ids: string[]) {
    startTransition(async () => {
      apply({ type: "items", sectionId, ids });
      await reorderItems(ids);
    });
  }

  const byId = <T extends { id: string }>(rows: T[], id: string) => rows.find((row) => row.id === id);

  return (
    <div className="space-y-5">
      <Card className="gap-4">
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="list-name">Name der Liste</Label>
              <BlurInput
                id="list-name"
                value={list.name}
                maxLength={80}
                onSave={(name) => startTransition(() => updateList(list.id, { name }))}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-pressed={starred}
              aria-label={starred ? "Nicht mehr groß auf der Übersicht" : "Groß auf der Übersicht zeigen"}
              title="Favorit: groß auf der Übersicht"
              onClick={() =>
                startTransition(async () => {
                  setStarred(!starred);
                  await updateList(list.id, { starred: !starred });
                })
              }
            >
              <StarIcon className={cn(starred && "fill-current text-brand")} />
            </Button>
          </div>
          <ChipEditor listId={list.id} chips={chips} />
        </CardContent>
      </Card>

      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd}>
        <SortableContext items={order.sections} strategy={verticalListSortingStrategy}>
          {order.sections.map((sectionId) => {
            const section = byId(sections, sectionId);
            if (!section) return null;
            const sectionItems = (order.items[sectionId] ?? [])
              .map((id) => byId(items, id))
              .filter((item): item is Item => Boolean(item));
            return (
              <SortableSection
                key={section.id}
                listId={list.id}
                section={section}
                items={sectionItems}
                sections={sections}
                chips={chips}
                onReorder={(ids) => onItemsReorder(section.id, ids)}
              />
            );
          })}
        </SortableContext>
      </DndContext>

      <AddForm
        label="Neuer Abschnitt"
        placeholder="z. B. Technik"
        maxLength={60}
        onAdd={(name) => addSection(list.id, name, sections.length)}
      />

      <form action={deleteList} className="pt-4">
        <input type="hidden" name="listId" value={list.id} />
        <SubmitButton
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={(event) => {
            if (!confirm(`„${list.name}“ mit allen Einträgen löschen?`)) event.preventDefault();
          }}
        >
          Liste löschen
        </SubmitButton>
      </form>
    </div>
  );
}

// --- Chips ------------------------------------------------------------------

function ChipEditor({ listId, chips }: { listId: string; chips: Chip[] }) {
  const [, startTransition] = useTransition();
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">Chips</p>
        <p className="text-xs text-muted-foreground">
          Schalter über der Liste, z. B. Gym oder Regen. Einträge mit ausgeschaltetem Chip werden ausgeblendet.
        </p>
      </div>
      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.id} className="flex items-center gap-1 rounded-full border py-0.5 pr-0.5 pl-1">
              <BlurInput
                aria-label="Chip umbenennen"
                value={chip.name}
                maxLength={40}
                className="h-8 w-28 rounded-full border-0 shadow-none"
                onSave={(name) => startTransition(() => updateChip(chip.id, { name }))}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-muted-foreground hover:text-destructive"
                aria-label={`Chip ${chip.name} löschen`}
                onClick={() => {
                  if (confirm(`Chip „${chip.name}“ löschen? Die Einträge bleiben, aber immer sichtbar.`)) {
                    startTransition(() => deleteChip(chip.id));
                  }
                }}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <AddForm label="Neuer Chip" placeholder="z. B. Gym" maxLength={40} onAdd={(name) => addChip(listId, name, chips.length)} />
    </div>
  );
}

// --- Sections and items -----------------------------------------------------

function SortableSection({
  listId,
  section,
  items,
  sections,
  chips,
  onReorder,
}: {
  listId: string;
  section: Section;
  items: Item[];
  sections: Section[];
  chips: Chip[];
  onReorder: (ids: string[]) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const dndId = useId();
  const ids = items.map((item) => item.id);

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("mb-5", isDragging && "relative z-10 opacity-80")}
    >
      <Card className="gap-3 py-4">
        <CardHeader className="px-3">
          <CardTitle className="flex items-center gap-1">
            <DragHandle label={`Abschnitt ${section.name} verschieben`} ref={setActivatorNodeRef} {...attributes} {...listeners} />
            <BlurInput
              aria-label="Abschnitt umbenennen"
              value={section.name}
              maxLength={60}
              className="h-9 flex-1 font-semibold"
              onSave={(name) => startTransition(() => renameSection(section.id, name))}
            />
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Abschnitt ${section.name} löschen`}
              disabled={sections.length === 1}
              onClick={() => {
                if (items.length === 0 || confirm(`Abschnitt „${section.name}“ mit ${items.length} Einträgen löschen?`)) {
                  startTransition(() => deleteSection(section.id));
                }
              }}
            >
              <Trash2Icon />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-3">
          {items.length > 0 && (
            <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <ul className="divide-y">
                  {items.map((item) => (
                    <SortableItem key={item.id} item={item} sections={sections} chips={chips} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
          <AddForm
            label="Neuer Eintrag"
            placeholder="Eintrag hinzufügen"
            maxLength={80}
            onAdd={(name) => addItem(listId, section.id, name, items.length)}
            compact
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SortableItem({ item, sections, chips }: { item: Item; sections: Section[]; chips: Chip[] }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const [, startTransition] = useTransition();
  const chip = chips.find((row) => row.id === item.chipId);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex items-center gap-1 bg-card py-1", isDragging && "relative z-10 shadow-md")}
    >
      <DragHandle label={`${item.name} verschieben`} ref={setActivatorNodeRef} {...attributes} {...listeners} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5">
          {item.name}
          {chip && <Badge variant="outline">{chip.name}</Badge>}
        </span>
        {item.note && <span className="text-xs text-muted-foreground">{item.note}</span>}
      </span>
      <ItemDialog item={item} sections={sections} chips={chips} />
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive"
        aria-label={`${item.name} löschen`}
        onClick={() => startTransition(() => deleteItem(item.id))}
      >
        <Trash2Icon />
      </Button>
    </li>
  );
}

function ItemDialog({ item, sections, chips }: { item: Item; sections: Section[]; chips: Chip[] }) {
  const [open, setOpen] = useState(false);

  async function save(formData: FormData) {
    await updateItem(formData);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`${item.name} bearbeiten`} className="text-muted-foreground">
          <PencilIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Eintrag bearbeiten</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="previousSectionId" value={item.sectionId} />
          <div className="space-y-2">
            <Label htmlFor={`item-name-${item.id}`}>Name</Label>
            <Input id={`item-name-${item.id}`} name="name" required maxLength={80} defaultValue={item.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`item-note-${item.id}`}>Notiz</Label>
            <Input
              id={`item-note-${item.id}`}
              name="note"
              maxLength={200}
              defaultValue={item.note ?? ""}
              placeholder="z. B. was alles dazugehört"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`item-section-${item.id}`}>Abschnitt</Label>
              <Select name="sectionId" defaultValue={item.sectionId}>
                <SelectTrigger id={`item-section-${item.id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`item-chip-${item.id}`}>Chip</Label>
              <Select name="chipId" defaultValue={item.chipId ?? "none"}>
                <SelectTrigger id={`item-chip-${item.id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Immer dabei</SelectItem>
                  {chips.map((chip) => (
                    <SelectItem key={chip.id} value={chip.id}>
                      Nur mit {chip.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Abbrechen
              </Button>
            </DialogClose>
            <SubmitButton>Speichern</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Shared bits --------------------------------------------------------------

function DragHandle({ label, ...props }: { label: string } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent active:cursor-grabbing"
      {...props}
    >
      <GripVerticalIcon className="size-4" />
    </button>
  );
}

// Saves when the field loses focus or Enter is pressed, if the value changed.
function BlurInput({
  value,
  onSave,
  ...props
}: { value: string; onSave: (value: string) => void } & Omit<React.ComponentProps<typeof Input>, "value" | "onBlur">) {
  return (
    <Input
      key={value}
      defaultValue={value}
      required
      onBlur={(event) => {
        const next = event.currentTarget.value.trim();
        if (!next) event.currentTarget.value = value;
        else if (next !== value) onSave(next);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          event.currentTarget.value = value;
          event.currentTarget.blur();
        }
      }}
      {...props}
    />
  );
}

// One-line form to add something; clears itself and keeps focus for the next entry.
function AddForm({
  label,
  placeholder,
  maxLength,
  onAdd,
  compact = false,
}: {
  label: string;
  placeholder: string;
  maxLength: number;
  onAdd: (name: string) => Promise<void>;
  compact?: boolean;
}) {
  const id = useId();
  return (
    <form
      action={async (formData) => {
        await onAdd(String(formData.get("name") ?? ""));
      }}
      className={cn("flex gap-2", !compact && "rounded-lg bg-muted p-3")}
    >
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Input id={id} name="name" required maxLength={maxLength} placeholder={placeholder} className="bg-card" />
      <SubmitButton variant="outline" size="icon" aria-label={label} className="shrink-0 bg-card">
        <PlusIcon />
      </SubmitButton>
    </form>
  );
}
