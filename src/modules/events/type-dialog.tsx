"use client";

import { CheckIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { confirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { createType, deleteType, updateType } from "./actions";
import {
  cleanTypeInput,
  colors,
  periodNames,
  unitName,
  type ColorId,
  type EventType,
  type GoalKind,
  type GoalPeriod,
  type Kind,
} from "./data";
import { tempId, useChange } from "./store";

// Creates a type, or edits / deletes one. Rendered with a key per type, so
// its fields start fresh each time it opens.
export function TypeDialog({
  type,
  entryCount,
  nextPosition,
  onClose,
}: {
  type?: EventType;
  // Entries of the type: once there are some, moment/span is fixed.
  entryCount: number;
  nextPosition: number;
  onClose: () => void;
}) {
  const change = useChange();
  const [name, setName] = useState(type?.name ?? "");
  const [emoji, setEmoji] = useState(type?.emoji ?? "📌");
  const [color, setColor] = useState<ColorId>(type?.color ?? "blue");
  const [kind, setKind] = useState<Kind>(type?.kind ?? "moment");
  const [trackAmount, setTrackAmount] = useState(type?.trackAmount ?? false);
  const [amountUnit, setAmountUnit] = useState(type?.amountUnit ?? "");
  const [trackRating, setTrackRating] = useState(type?.trackRating ?? false);
  const [goalKind, setGoalKind] = useState<GoalKind | "none">(type?.goal?.kind ?? "none");
  const [goalCount, setGoalCount] = useState(String(type?.goal?.count ?? 2));
  const [goalPeriod, setGoalPeriod] = useState<GoalPeriod>(type?.goal?.period ?? "week");
  const kindLocked = entryCount > 0;

  function save() {
    const input = cleanTypeInput({
      name,
      emoji,
      color,
      kind,
      trackAmount,
      amountUnit,
      trackRating,
      goal: goalKind === "none" ? null : { kind: goalKind, count: Number(goalCount), period: goalPeriod },
    });
    if (type) {
      void change(
        (data) => ({ types: data.types.map((other) => (other.id === type.id ? { ...other, ...input } : other)) }),
        () => updateType(type.id, input),
      );
    } else {
      const optimistic: EventType = { ...input, id: tempId(), position: nextPosition };
      void change((data) => ({ types: [...data.types, optimistic] }), () => createType(input));
    }
    onClose();
  }

  async function remove() {
    if (!type) return;
    const ok = await confirmDialog({
      title: `„${type.name}“ löschen?`,
      description:
        entryCount > 0
          ? `Auch ${entryCount === 1 ? "sein Eintrag wird" : `seine ${entryCount} Einträge werden`} endgültig gelöscht.`
          : undefined,
    });
    if (!ok) return;
    void change(
      (data) => ({
        types: data.types.filter((other) => other.id !== type.id),
        entries: data.entries.filter((entry) => entry.typeId !== type.id),
      }),
      () => deleteType(type.id),
    );
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <DialogHeader>
            <DialogTitle>{type ? "Typ bearbeiten" : "Neuer Typ"}</DialogTitle>
            <DialogDescription>Was du festhalten willst, z. B. „Krank“ oder „Fleisch gegessen“.</DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <div className="w-16 space-y-2">
              <Label htmlFor="type-emoji">Emoji</Label>
              <Input
                id="type-emoji"
                value={emoji}
                maxLength={16}
                className="text-center text-lg"
                onChange={(event) => setEmoji(event.target.value)}
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="type-name">Name</Label>
              <Input
                id="type-name"
                required
                autoFocus={!type}
                maxLength={40}
                placeholder="z. B. Krank"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium" id="type-color">
              Farbe
            </span>
            <div role="radiogroup" aria-labelledby="type-color" className="flex flex-wrap gap-2">
              {colors.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={color === option.id}
                  aria-label={option.name}
                  onClick={() => setColor(option.id)}
                  className="flex size-8 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-background aria-checked:ring-2 aria-checked:ring-foreground"
                  style={{ backgroundColor: option.hex }}
                >
                  {color === option.id && <CheckIcon className="size-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium" id="type-kind">
              Art
            </span>
            <ToggleGroup
              type="single"
              variant="outline"
              aria-labelledby="type-kind"
              className="w-full"
              value={kind}
              disabled={kindLocked}
              onValueChange={(value) => value && setKind(value as Kind)}
            >
              <ToggleGroupItem value="moment" className="flex-1">
                Einzelner Moment
              </ToggleGroupItem>
              <ToggleGroupItem value="span" className="flex-1">
                Zeitraum
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-sm text-muted-foreground">
              {kind === "moment"
                ? "Ein Tipp trägt heute ein, z. B. „Fleisch gegessen“. Mehrmals am Tag geht auch."
                : "Läuft von einem Tag bis zu einem anderen, z. B. „Krank“. Ein Tipp startet ihn, „Beendet“ schließt ihn ab."}
              {kindLocked && " Lässt sich nicht mehr ändern, weil es schon Einträge gibt."}
            </p>
          </div>

          <div className="space-y-3">
            <span className="text-sm font-medium">Zusätzlich erfassen</span>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={trackAmount} onCheckedChange={(checked) => setTrackAmount(checked === true)} />
              Menge
            </label>
            {trackAmount && (
              <Input
                aria-label="Einheit"
                maxLength={16}
                placeholder="Einheit, z. B. °C oder Portionen"
                value={amountUnit}
                onChange={(event) => setAmountUnit(event.target.value)}
              />
            )}
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={trackRating} onCheckedChange={(checked) => setTrackRating(checked === true)} />
              Bewertung 1–5 (z. B. wie schlimm)
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type-goal">Ziel oder Grenze</Label>
            <Select value={goalKind} onValueChange={(value) => setGoalKind(value as GoalKind | "none")}>
              <SelectTrigger id="type-goal" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Ziel</SelectItem>
                <SelectItem value="max">Höchstens …</SelectItem>
                <SelectItem value="min">Mindestens …</SelectItem>
              </SelectContent>
            </Select>
            {goalKind !== "none" && (
              <div className="flex items-center gap-2">
                <Input
                  aria-label="Anzahl"
                  type="number"
                  min={0}
                  max={1000}
                  required
                  className="w-20"
                  value={goalCount}
                  onChange={(event) => setGoalCount(event.target.value)}
                />
                <span className="text-sm">{unitName(kind, Number(goalCount))}</span>
                <Select value={goalPeriod} onValueChange={(value) => setGoalPeriod(value as GoalPeriod)}>
                  <SelectTrigger aria-label="Zeitraum" className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(periodNames) as GoalPeriod[]).map((period) => (
                      <SelectItem key={period} value={period}>
                        {periodNames[period].per}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="flex-row items-center justify-between gap-2">
            {type ? (
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={remove}>
                <Trash2Icon /> Löschen
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" variant="brand" disabled={!name.trim()}>
              {type ? "Speichern" : "Anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
