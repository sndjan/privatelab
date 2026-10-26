"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { saveTemplateItem } from "./actions";
import { conditions, type ItemKind } from "./data";

type Item = { id: string; name: string; note: string | null; kind: ItemKind; conditions: string[] };

// Adds an item to a template, or edits one when `item` is given.
export function ItemDialog({
  templateId,
  item,
  defaultKind = "pack",
}: {
  templateId: string;
  item?: Item;
  defaultKind?: ItemKind;
}) {
  const [open, setOpen] = useState(false);

  async function save(formData: FormData) {
    await saveTemplateItem(formData);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item ? (
          <Button variant="ghost" size="icon" aria-label={`${item.name} bearbeiten`} className="text-muted-foreground">
            <PencilIcon />
          </Button>
        ) : (
          <Button variant="outline">
            <PlusIcon /> Hinzufügen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{item ? "Eintrag bearbeiten" : "Eintrag hinzufügen"}</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="templateId" value={templateId} />
          {item && <input type="hidden" name="itemId" value={item.id} />}
          <div className="space-y-2">
            <Label htmlFor="item-name">Name</Label>
            <Input id="item-name" name="name" required maxLength={80} defaultValue={item?.name} placeholder="z. B. Ladekabel" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-note">Notiz</Label>
            <Input
              id="item-note"
              name="note"
              maxLength={200}
              defaultValue={item?.note ?? ""}
              placeholder="z. B. was alles dazugehört"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-kind">Art</Label>
            <Select name="kind" defaultValue={item?.kind ?? defaultKind}>
              <SelectTrigger id="item-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pack">Einpacken</SelectItem>
                <SelectItem value="task">Erledigen</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Nur wenn</legend>
            <p className="text-xs text-muted-foreground">Leer lassen, wenn der Eintrag immer dabei sein soll.</p>
            <div className="grid grid-cols-2 gap-2">
              {conditions.map((condition) => (
                <div key={condition.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`item-condition-${condition.value}`}
                    name="conditions"
                    value={condition.value}
                    defaultChecked={item?.conditions.includes(condition.value)}
                  />
                  <Label htmlFor={`item-condition-${condition.value}`} className="font-normal">
                    {condition.label}
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Abbrechen
              </Button>
            </DialogClose>
            <Button>Speichern</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
