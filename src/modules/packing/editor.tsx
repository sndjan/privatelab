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
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckIcon, GripVerticalIcon, PlusIcon, StarIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useOptimistic, useState, useTransition } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  renameChip,
  renameSection,
  reorderItems,
  reorderSections,
  updateItem,
  updateList,
} from "./actions";
import type { Chip, Item, Section } from "./data";

type State = { sections: Section[]; items: Item[]; chips: Chip[]; starred: boolean };
type Change =
  | { type: "sections"; ids: string[] }
  | { type: "items"; sectionId: string; ids: string[] }
  | { type: "addSection"; section: Section }
  | { type: "deleteSection"; id: string }
  | { type: "addItem"; item: Item }
  | { type: "updateItem"; item: Item }
  | { type: "deleteItem"; id: string }
  | { type: "addChip"; chip: Chip }
  | { type: "deleteChip"; id: string }
  | { type: "star"; starred: boolean };

function reduce(state: State, change: Change): State {
  switch (change.type) {
    case "sections":
      return { ...state, sections: change.ids.map((id) => state.sections.find((s) => s.id === id)!).filter(Boolean) };
    case "items": {
      const moved = change.ids.map((id) => state.items.find((item) => item.id === id)!).filter(Boolean);
      return { ...state, items: [...state.items.filter((item) => item.sectionId !== change.sectionId), ...moved] };
    }
    case "addSection":
      return { ...state, sections: [...state.sections, change.section] };
    case "deleteSection":
      return {
        ...state,
        sections: state.sections.filter((section) => section.id !== change.id),
        items: state.items.filter((item) => item.sectionId !== change.id),
      };
    case "addItem":
      return { ...state, items: [...state.items, change.item] };
    case "updateItem": {
      const before = state.items.find((item) => item.id === change.item.id);
      // A changed section puts the item at the end, as the server does.
      return before?.sectionId === change.item.sectionId
        ? { ...state, items: state.items.map((item) => (item.id === change.item.id ? change.item : item)) }
        : { ...state, items: [...state.items.filter((item) => item.id !== change.item.id), change.item] };
    }
    case "deleteItem":
      return { ...state, items: state.items.filter((item) => item.id !== change.id) };
    case "addChip":
      return { ...state, chips: [...state.chips, change.chip] };
    case "deleteChip":
      return {
        ...state,
        chips: state.chips.filter((chip) => chip.id !== change.id),
        items: state.items.map((item) => (item.chipId === change.id ? { ...item, chipId: null } : item)),
      };
    case "star":
      return { ...state, starred: change.starred };
  }
}

// Rows added here exist only on the client until the server answers.
const tempId = () => `tmp-${Math.random().toString(36).slice(2)}`;
const isTemp = (id: string) => id.startsWith("tmp-");

function useDragSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

// Edit mode. Every change shows at once and saves in the background.
export function Editor({
  list,
  sections,
  items,
  chips,
  onDone,
}: {
  list: { id: string; name: string; starred: boolean };
  sections: Section[];
  items: Item[];
  chips: Chip[];
  onDone: () => void;
}) {
  const [state, apply] = useOptimistic<State, Change>({ sections, items, chips, starred: list.starred }, reduce);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const [editing, setEditing] = useState<Item | null>(null);
  const sensors = useDragSensors();
  const dndId = useId();

  // Applies the change at once and runs the server action in the background.
  // If it fails, the optimistic change disappears and the server's state shows.
  function run(change: Change, action: () => Promise<unknown>) {
    startTransition(async () => {
      apply(change);
      await action().catch(() => router.refresh());
    });
  }

  function save(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action().catch(() => router.refresh());
    });
  }

  function onSectionDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = state.sections.map((section) => section.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    run({ type: "sections", ids: next }, () => reorderSections(next.filter((id) => !isTemp(id))));
  }

  return (
    <div className="space-y-5 pb-20">
      <div className="flex items-center gap-1">
        <BlurInput
          aria-label="Name der Liste"
          value={list.name}
          maxLength={80}
          className="h-10 flex-1 border-transparent px-2 text-xl font-semibold shadow-none hover:border-input md:text-xl"
          onSave={(name) => save(() => updateList(list.id, { name }))}
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-10"
          aria-pressed={state.starred}
          aria-label="Groß auf der Übersicht"
          onClick={() =>
            run({ type: "star", starred: !state.starred }, () => updateList(list.id, { starred: !state.starred }))
          }
        >
          <StarIcon className={cn("size-5", state.starred ? "fill-current text-brand" : "text-muted-foreground")} />
        </Button>
        <Button variant="brand" size="icon" className="size-10" aria-label="Fertig" onClick={onDone}>
          <CheckIcon className="size-5" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {state.chips.map((chip) => (
          <span key={chip.id} className="flex h-9 items-center rounded-full border pl-1">
            <BlurInput
              aria-label="Chip umbenennen"
              value={chip.name}
              maxLength={40}
              style={{ width: `calc(${Math.max(chip.name.length, 3) + 1}ch + 1rem)` }}
              className="h-8 rounded-full border-0 px-2 shadow-none focus-visible:ring-0"
              onSave={(name) => save(() => renameChip(chip.id, name))}
            />
            <button
              type="button"
              aria-label={`Chip ${chip.name} löschen`}
              disabled={isTemp(chip.id)}
              className="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:text-destructive"
              onClick={() => run({ type: "deleteChip", id: chip.id }, () => deleteChip(chip.id))}
            >
              <XIcon className="size-4" />
            </button>
          </span>
        ))}
        <QuickAdd
          label="Neuer Chip"
          placeholder="+ Chip"
          maxLength={40}
          className="h-9 w-28 rounded-full border-dashed"
          onAdd={(name) =>
            run({ type: "addChip", chip: { id: tempId(), name, active: true } }, () =>
              addChip(list.id, name, state.chips.length),
            )
          }
        />
      </div>

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={onSectionDragEnd}
      >
        <SortableContext items={state.sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-5">
            {state.sections.map((section) => (
              <SortableSection
                key={section.id}
                section={section}
                items={state.items.filter((item) => item.sectionId === section.id)}
                chips={state.chips}
                canDelete={state.sections.length > 1}
                onEdit={setEditing}
                onDelete={(count) => {
                  if (count === 0 || confirm(`„${section.name}“ mit ${count} Einträgen löschen?`)) {
                    run({ type: "deleteSection", id: section.id }, () => deleteSection(section.id));
                  }
                }}
                onReorder={(ids) =>
                  run({ type: "items", sectionId: section.id, ids }, () => reorderItems(ids.filter((id) => !isTemp(id))))
                }
                onAdd={(name, sort) =>
                  run(
                    {
                      type: "addItem",
                      item: { id: tempId(), sectionId: section.id, chipId: null, name, note: null, done: false },
                    },
                    () => addItem(list.id, section.id, name, sort),
                  )
                }
                onDeleteItem={(id) => run({ type: "deleteItem", id }, () => deleteItem(id))}
                onRename={(name) => save(() => renameSection(section.id, name))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <QuickAdd
        label="Neuer Abschnitt"
        placeholder="+ Abschnitt"
        maxLength={60}
        className="h-11 border-dashed"
        onAdd={(name) =>
          run({ type: "addSection", section: { id: tempId(), name } }, () =>
            addSection(list.id, name, state.sections.length),
          )
        }
      />

      <form action={deleteList}>
        <input type="hidden" name="listId" value={list.id} />
        <SubmitButton
          variant="ghost"
          className="-ml-3 text-muted-foreground hover:text-destructive"
          onClick={(event) => {
            if (!confirm(`„${list.name}“ löschen?`)) event.preventDefault();
          }}
        >
          <Trash2Icon /> Liste löschen
        </SubmitButton>
      </form>

      {editing && (
        <ItemDialog
          item={editing}
          sections={state.sections.filter((section) => !isTemp(section.id))}
          chips={state.chips.filter((chip) => !isTemp(chip.id))}
          onClose={() => setEditing(null)}
          onSave={(item) => {
            setEditing(null);
            run({ type: "updateItem", item }, () =>
              updateItem(item.id, {
                name: item.name,
                note: item.note ?? "",
                chipId: item.chipId,
                sectionId: item.sectionId,
                moved: item.sectionId !== editing.sectionId,
              }),
            );
          }}
        />
      )}
    </div>
  );
}

// --- Sections and items -----------------------------------------------------

function SortableSection({
  section,
  items,
  chips,
  canDelete,
  onEdit,
  onDelete,
  onReorder,
  onAdd,
  onDeleteItem,
  onRename,
}: {
  section: Section;
  items: Item[];
  chips: Chip[];
  canDelete: boolean;
  onEdit: (item: Item) => void;
  onDelete: (count: number) => void;
  onReorder: (ids: string[]) => void;
  onAdd: (name: string, sort: number) => void;
  onDeleteItem: (id: string) => void;
  onRename: (name: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: isTemp(section.id),
  });
  const sensors = useDragSensors();
  const dndId = useId();
  const ids = items.map((item) => item.id);

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("space-y-1.5", isDragging && "relative z-10 opacity-80")}
    >
      <div className="-ml-2 flex items-center">
        <DragHandle
          label={`Abschnitt ${section.name} verschieben`}
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
        />
        <BlurInput
          aria-label="Abschnitt umbenennen"
          value={section.name}
          maxLength={60}
          disabled={isTemp(section.id)}
          className="h-9 flex-1 border-transparent px-1 font-medium text-muted-foreground shadow-none hover:border-input"
          onSave={onRename}
        />
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Abschnitt ${section.name} löschen`}
            disabled={isTemp(section.id)}
            onClick={() => onDelete(items.length)}
          >
            <Trash2Icon />
          </Button>
        )}
      </div>
      <div className="divide-y overflow-hidden rounded-xl border bg-card">
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {items.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                chip={chips.find((chip) => chip.id === item.chipId)?.name}
                onEdit={() => onEdit(item)}
                onDelete={() => onDeleteItem(item.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
        {!isTemp(section.id) && (
          <QuickAdd
            label={`Neuer Eintrag in ${section.name}`}
            placeholder="+ Eintrag"
            maxLength={80}
            className="h-12 rounded-none border-0 px-4 shadow-none focus-visible:ring-0"
            onAdd={(name) => onAdd(name, items.length)}
          />
        )}
      </div>
    </section>
  );
}

function SortableItem({
  item,
  chip,
  onEdit,
  onDelete,
}: {
  item: Item;
  chip?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const temp = isTemp(item.id);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: temp,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex min-h-12 items-center bg-card pr-1", isDragging && "relative z-10 shadow-md")}
    >
      <DragHandle
        label={`${item.name} verschieben`}
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
      />
      <button
        type="button"
        disabled={temp}
        onClick={onEdit}
        className="flex min-h-12 min-w-0 flex-1 cursor-pointer flex-col justify-center py-1.5 text-left"
      >
        <span className={cn(temp && "text-muted-foreground")}>
          {item.name}
          {chip && <span className="ml-2 text-xs text-muted-foreground">{chip}</span>}
        </span>
        {item.note && <span className="truncate text-xs text-muted-foreground">{item.note}</span>}
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="size-10 text-muted-foreground hover:text-destructive"
        aria-label={`${item.name} löschen`}
        disabled={temp}
        onClick={onDelete}
      >
        <XIcon />
      </Button>
    </div>
  );
}

function ItemDialog({
  item,
  sections,
  chips,
  onClose,
  onSave,
}: {
  item: Item;
  sections: Section[];
  chips: Chip[];
  onClose: () => void;
  onSave: (item: Item) => void;
}) {
  const id = useId();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(event) => event.preventDefault()}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const name = String(data.get("name") ?? "").trim();
            if (!name) return;
            const chipId = String(data.get("chipId") ?? "none");
            onSave({
              ...item,
              name,
              note: String(data.get("note") ?? "").trim() || null,
              chipId: chipId === "none" ? null : chipId,
              sectionId: String(data.get("sectionId") ?? item.sectionId),
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Eintrag</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input id={`${id}-name`} name="name" required maxLength={80} defaultValue={item.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-note`}>Notiz</Label>
            <Input id={`${id}-note`} name="note" maxLength={200} defaultValue={item.note ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`${id}-section`}>Abschnitt</Label>
              <Select name="sectionId" defaultValue={item.sectionId}>
                <SelectTrigger id={`${id}-section`} className="w-full">
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
              <Label htmlFor={`${id}-chip`}>Chip</Label>
              <Select name="chipId" defaultValue={item.chipId ?? "none"}>
                <SelectTrigger id={`${id}-chip`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Immer</SelectItem>
                  {chips.map((chip) => (
                    <SelectItem key={chip.id} value={chip.id}>
                      {chip.name}
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
            <Button type="submit">Speichern</Button>
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
      className="inline-flex size-10 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground/60 active:cursor-grabbing"
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
      enterKeyHint="done"
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

// A single field: Enter adds, clears it at once and keeps the keyboard open
// for the next entry.
function QuickAdd({
  label,
  placeholder,
  maxLength,
  className,
  onAdd,
}: {
  label: string;
  placeholder: string;
  maxLength: number;
  className?: string;
  onAdd: (name: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        const name = value.trim();
        if (!name) return;
        setValue("");
        onAdd(name);
      }}
    >
      <Input
        aria-label={label}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        enterKeyHint="enter"
        className={cn("bg-card pr-10", className)}
      />
      {value.trim() && (
        <button
          type="submit"
          aria-label={label}
          className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-brand"
        >
          <PlusIcon className="size-5" />
        </button>
      )}
    </form>
  );
}
