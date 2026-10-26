"use client";

import { PencilIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveTarget } from "./actions";
import { formatMoney } from "./calc";

type Props = {
  // The hand-set FIRE number, or null when it's calculated.
  target: number | null;
  calculated: number;
};

// Lets the user set their own FIRE number instead of the calculated one.
export function TargetDialog({ target, calculated }: Props) {
  const [open, setOpen] = useState(false);

  async function save(formData: FormData) {
    await saveTarget(formData);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="FIRE-Zahl ändern"
          className="-mt-1 -mr-2 text-muted-foreground"
        >
          <PencilIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form action={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>FIRE-Zahl</DialogTitle>
            <DialogDescription>
              Berechnet aus deinen Ausgaben und der Entnahmerate wären es {formatMoney(calculated)}. Leer lassen, um
              diesen Wert zu nutzen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="fire-target">Eigene FIRE-Zahl (€)</Label>
            <Input
              id="fire-target"
              name="target"
              type="number"
              min={1}
              step={1}
              defaultValue={target ?? ""}
              placeholder={String(Math.round(calculated))}
              className="h-11 font-mono"
            />
          </div>
          <DialogFooter>
            {target !== null && (
              <Button
                type="submit"
                variant="ghost"
                onClick={(event) => {
                  const input = event.currentTarget.form?.elements.namedItem("target") as HTMLInputElement | null;
                  if (input) input.value = "";
                }}
              >
                Automatisch berechnen
              </Button>
            )}
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
