"use client";

import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { confirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { addEntry, deleteEntry, updateEntry } from "./actions";
import { formatDays, spanDays } from "./calc";
import { cleanEntryInput, isDate, type Entry, type EventType } from "./data";
import { tempId, useChange, type EntryDialogRequest } from "./store";

// Adds an entry (with another date, a note, an amount or a rating than the
// quick button would) or edits / deletes one. Rendered with a key per
// request, so its fields start fresh each time it opens.
export function EntryDialog({
  request,
  types,
  today,
  onClose,
}: {
  request: EntryDialogRequest;
  types: EventType[];
  today: string;
  onClose: () => void;
}) {
  const { entry } = request;
  const change = useChange();
  const [typeId, setTypeId] = useState(entry?.typeId ?? request.typeId ?? types[0]?.id ?? "");
  const type = types.find((candidate) => candidate.id === typeId);
  const [startDate, setStartDate] = useState(entry?.startDate ?? request.date ?? today);
  const [running, setRunning] = useState(entry ? entry.endDate === null : !request.date || request.date === today);
  const [endDate, setEndDate] = useState(entry?.endDate ?? request.date ?? today);
  const [amount, setAmount] = useState(entry?.amount !== null && entry?.amount !== undefined ? String(entry.amount).replace(".", ",") : "");
  const [rating, setRating] = useState<number | null>(entry?.rating ?? null);
  const [note, setNote] = useState(entry?.note ?? "");

  if (!type) return null;
  const isSpan = type.kind === "span";
  const valid = isDate(startDate) && (!isSpan || running || (isDate(endDate) && endDate >= startDate));

  function save() {
    if (!type || !valid) return;
    const input = cleanEntryInput(
      { typeId, startDate, endDate: isSpan && !running ? endDate : null, amount, rating, note },
      type,
    );
    if (entry) {
      void change(
        (data) => ({ entries: data.entries.map((other) => (other.id === entry.id ? { ...input, id: entry.id } : other)) }),
        () => updateEntry(entry.id, input),
      );
    } else {
      const optimistic: Entry = { ...input, id: tempId() };
      void change((data) => ({ entries: [optimistic, ...data.entries] }), () => addEntry(input));
    }
    onClose();
  }

  async function remove() {
    if (!entry || !type) return;
    if (!(await confirmDialog({ title: `„${type.name}“ löschen?`, description: "Der Eintrag wird endgültig gelöscht." }))) return;
    void change((data) => ({ entries: data.entries.filter((other) => other.id !== entry.id) }), () => deleteEntry(entry.id));
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {entry ? "Eintrag bearbeiten" : "Eintragen"}
              {(entry || request.typeId) && `: ${type.emoji} ${type.name}`}
            </DialogTitle>
          </DialogHeader>

          {!entry && !request.typeId && (
            <div className="space-y-2">
              <Label htmlFor="entry-type">Was?</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger id="entry-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {types.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.emoji} {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isSpan ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="entry-start">Von</Label>
                  <Input
                    id="entry-start"
                    type="date"
                    required
                    value={startDate}
                    onChange={(event) => {
                      setStartDate(event.target.value);
                      if (event.target.value > endDate) setEndDate(event.target.value);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entry-end">Bis</Label>
                  <Input
                    id="entry-end"
                    type="date"
                    disabled={running}
                    required={!running}
                    min={startDate}
                    value={running ? "" : endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={running} onCheckedChange={(checked) => setRunning(checked === true)} />
                Läuft noch (ohne Ende)
              </label>
              {valid && (
                <p className="text-sm text-muted-foreground">
                  {running ? "Bis heute" : "Insgesamt"}{" "}
                  {formatDays(spanDays({ ...emptyEntry, startDate, endDate: running ? null : endDate }, today))}
                </p>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="entry-date">Datum</Label>
              <Input id="entry-date" type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
          )}

          {type.trackAmount && (
            <div className="space-y-2">
              <Label htmlFor="entry-amount">Menge{type.amountUnit && ` (${type.amountUnit})`}</Label>
              <Input
                id="entry-amount"
                inputMode="decimal"
                autoFocus={!entry}
                placeholder="z. B. 2"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d,.-]/g, ""))}
              />
            </div>
          )}

          {type.trackRating && (
            <div className="space-y-2">
              <span className="text-sm font-medium" id="entry-rating">
                Bewertung
              </span>
              <div role="radiogroup" aria-labelledby="entry-rating" className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={rating === value}
                    onClick={() => setRating(rating === value ? null : value)}
                    className={cn(
                      "flex size-10 cursor-pointer items-center justify-center rounded-md border text-sm font-medium transition-colors",
                      rating !== null && value <= rating ? "border-amber-500 bg-amber-500/15" : "hover:bg-muted",
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="entry-note">Notiz</Label>
            <Textarea
              id="entry-note"
              rows={2}
              maxLength={1000}
              placeholder="optional"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <DialogFooter className="flex-row items-center justify-between gap-2">
            {entry ? (
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={remove}>
                <Trash2Icon /> Löschen
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" variant="brand" disabled={!valid}>
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const emptyEntry: Entry = { id: "", typeId: "", startDate: "", endDate: null, note: "", amount: null, rating: null };
