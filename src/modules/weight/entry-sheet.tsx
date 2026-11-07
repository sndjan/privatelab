"use client";

import { CalendarIcon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { deleteCircumferences, deleteWeighing, saveCircumferences, saveWeighing } from "./actions";
import { addDays, circumferencesOf, formatDate, formatNumber, formatShortDate, formatSigned, lastValueBefore, toField, weighingsOf } from "./calc";
import {
  BODY_FAT_RANGE,
  CM_RANGE,
  MASS_RANGE,
  WEIGHT_RANGE,
  isDate,
  parseNumber,
  siteValueKeys,
  type Circumference,
  type Weighing,
} from "./data";
import { useChange, useWeightData, type SheetRequest, type WeightData } from "./store";
import { BottomSheet, Dot, Segmented } from "./ui";

const LAST_PERSON = "weight:last-person";

function rememberedPerson() {
  try {
    return window.localStorage.getItem(LAST_PERSON);
  } catch {
    return null;
  }
}

// "Neue Messung": a weighing (weight, optional KFA, muscles, FFM) or a set of
// circumferences for one person and day. A person has at most one of each
// per day, so picking a day that already has values edits them.
export function EntrySheet({ request, today, onClose }: { request: SheetRequest; today: string; onClose: () => void }) {
  const data = useWeightData();
  const { participants, weighings, circumferences, sites, me } = data;
  const change = useChange();
  const editing = request.edit;

  const [kind, setKind] = useState(request.kind);
  const initialPerson =
    editing?.participantId ??
    participants.find((participant) => participant.userId === me.id)?.id ??
    participants.find((participant) => participant.id === rememberedPerson())?.id ??
    participants[0].id;
  const [personId, setPersonId] = useState(initialPerson);
  const [date, setDate] = useState(editing?.date ?? today);

  const weighingAt = (id: string, day: string) => weighings.find((weighing) => weighing.participantId === id && weighing.date === day);
  const setAt = (id: string, day: string) => circumferences.find((set) => set.participantId === id && set.date === day);
  const previousWeighing = (id: string, day: string) => weighingsOf(weighings, id).filter((weighing) => weighing.date < day).pop();

  // Fields for a person and day: what is saved there, or else the last
  // weight as a starting point (extras stay empty).
  function weightFields(id: string, day: string) {
    const existing = weighingAt(id, day);
    const start = existing?.weight ?? previousWeighing(id, day)?.weight ?? participants.find((p) => p.id === id)?.startWeight ?? 70;
    return {
      weight: toField(start),
      bodyFat: toField(existing?.bodyFat),
      muscleMass: toField(existing?.muscleMass, 2),
      fatFreeMass: toField(existing?.fatFreeMass, 2),
    };
  }
  function measureFields(id: string, day: string) {
    const existing = setAt(id, day);
    return Object.fromEntries(Object.entries(existing?.values ?? {}).map(([key, value]) => [key, toField(value)]));
  }

  const [fields, setFields] = useState(() => weightFields(personId, date));
  const [extras, setExtras] = useState(() => ({
    bodyFat: fields.bodyFat !== "",
    muscleMass: fields.muscleMass !== "",
    fatFreeMass: fields.fatFreeMass !== "",
  }));
  const [measures, setMeasures] = useState<Record<string, string>>(() => measureFields(personId, date));

  function choose(id: string, day: string) {
    setPersonId(id);
    setDate(day);
    const next = weightFields(id, day);
    setFields(next);
    setExtras((shown) => ({
      bodyFat: shown.bodyFat || next.bodyFat !== "",
      muscleMass: shown.muscleMass || next.muscleMass !== "",
      fatFreeMass: shown.fatFreeMass || next.fatFreeMass !== "",
    }));
    setMeasures(measureFields(id, day));
  }

  const weight = parseNumber(fields.weight, ...WEIGHT_RANGE);
  const previous = previousWeighing(personId, date);
  const invalidExtra =
    (fields.bodyFat !== "" && parseNumber(fields.bodyFat, ...BODY_FAT_RANGE) === null) ||
    (fields.muscleMass !== "" && parseNumber(fields.muscleMass, ...MASS_RANGE) === null) ||
    (fields.fatFreeMass !== "" && parseNumber(fields.fatFreeMass, ...MASS_RANGE) === null);
  const invalidMeasure = Object.values(measures).some((value) => value.trim() !== "" && parseNumber(value, ...CM_RANGE) === null);
  const valid = isDate(date) && (kind === "weight" ? weight !== null && !invalidExtra : !invalidMeasure);
  const existsHere = kind === "weight" ? weighingAt(personId, date) : setAt(personId, date);
  const step = (delta: number) =>
    setFields((current) => ({ ...current, weight: toField(Math.round(((parseNumber(current.weight, 0, 1000) ?? 0) + delta) * 10) / 10) }));

  // --- Saving with undo ---------------------------------------------------------

  // Puts the given weighings / sets into the cache and the database, replacing
  // what is there for their person and day (null removes it).
  function applyWeighings(changes: { participantId: string; date: string; next: Weighing | null }[]) {
    const same = (weighing: Weighing, key: { participantId: string; date: string }) =>
      weighing.participantId === key.participantId && weighing.date === key.date;
    return change(
      (current: WeightData) => ({
        weighings: [
          ...current.weighings.filter((weighing) => !changes.some((entry) => same(weighing, entry))),
          ...changes.flatMap((entry) => (entry.next ? [entry.next] : [])),
        ].sort((a, b) => b.date.localeCompare(a.date)),
      }),
      async () => {
        for (const entry of changes) {
          if (entry.next) await saveWeighing(entry.next);
          else await deleteWeighing(entry.participantId, entry.date);
        }
      },
    );
  }
  function applySets(changes: { participantId: string; date: string; next: Circumference | null }[]) {
    const same = (set: Circumference, key: { participantId: string; date: string }) =>
      set.participantId === key.participantId && set.date === key.date;
    return change(
      (current: WeightData) => ({
        circumferences: [
          ...current.circumferences.filter((set) => !changes.some((entry) => same(set, entry))),
          ...changes.flatMap((entry) => (entry.next && Object.keys(entry.next.values).length > 0 ? [entry.next] : [])),
        ].sort((a, b) => b.date.localeCompare(a.date)),
      }),
      async () => {
        for (const entry of changes) {
          if (entry.next && Object.keys(entry.next.values).length > 0) await saveCircumferences(entry.next);
          else await deleteCircumferences(entry.participantId, entry.date);
        }
      },
    );
  }

  function save() {
    if (!valid) return;
    try {
      window.localStorage.setItem(LAST_PERSON, personId);
    } catch {}
    const target = { participantId: personId, date };
    const moved = editing && (editing.participantId !== personId || editing.date !== date) ? editing : null;

    if (kind === "weight") {
      const next: Weighing = {
        ...target,
        weight: weight!,
        bodyFat: extras.bodyFat ? parseNumber(fields.bodyFat, ...BODY_FAT_RANGE, 1) : null,
        muscleMass: extras.muscleMass ? parseNumber(fields.muscleMass, ...MASS_RANGE) : null,
        fatFreeMass: extras.fatFreeMass ? parseNumber(fields.fatFreeMass, ...MASS_RANGE) : null,
        createdBy: weighingAt(personId, date)?.createdBy ?? me.id,
      };
      const undo = [
        { ...target, next: weighingAt(personId, date) ?? null },
        ...(moved ? [{ ...moved, next: weighingAt(moved.participantId, moved.date) ?? null }] : []),
      ];
      void applyWeighings([...(moved ? [{ ...moved, next: null }] : []), { ...target, next }]);
      toast.success("Gespeichert", { action: { label: "Rückgängig", onClick: () => void applyWeighings(undo) } });
    } else {
      const values: Record<string, number> = {};
      for (const [key, text] of Object.entries(measures)) {
        const cm = parseNumber(text, ...CM_RANGE, 1);
        if (cm !== null) values[key] = cm;
      }
      const next: Circumference = { ...target, values, createdBy: setAt(personId, date)?.createdBy ?? me.id };
      const undo = [
        { ...target, next: setAt(personId, date) ?? null },
        ...(moved ? [{ ...moved, next: setAt(moved.participantId, moved.date) ?? null }] : []),
      ];
      void applySets([...(moved ? [{ ...moved, next: null }] : []), { ...target, next }]);
      toast.success("Gespeichert", { action: { label: "Rückgängig", onClick: () => void applySets(undo) } });
    }
    onClose();
  }

  async function remove() {
    if (!editing) return;
    const name = participants.find((participant) => participant.id === editing.participantId)?.name ?? "";
    if (!(await confirmDialog({ title: `${kind === "weight" ? "Gewicht" : "Maße"} löschen?`, description: `${name}, ${formatDate(editing.date)}` }))) return;
    if (kind === "weight") {
      const old = weighingAt(editing.participantId, editing.date) ?? null;
      void applyWeighings([{ ...editing, next: null }]);
      toast.success("Gelöscht", { action: { label: "Rückgängig", onClick: () => void applyWeighings([{ ...editing, next: old }]) } });
    } else {
      const old = setAt(editing.participantId, editing.date) ?? null;
      void applySets([{ ...editing, next: null }]);
      toast.success("Gelöscht", { action: { label: "Rückgängig", onClick: () => void applySets([{ ...editing, next: old }]) } });
    }
    onClose();
  }

  // --- Layout ---------------------------------------------------------------------

  const person = participants.find((participant) => participant.id === personId)!;
  const ownSets = circumferencesOf(circumferences, personId);
  const yesterday = addDays(today, -1);

  return (
    <BottomSheet title={editing ? "Messung" : "Neue Messung"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        {!editing && (
          <Segmented
            label="Art"
            value={kind}
            onChange={setKind}
            options={[
              { id: "weight", label: "Gewicht" },
              { id: "measures", label: "Maße" },
            ]}
          />
        )}

        <div role="radiogroup" aria-label="Person" className="grid grid-cols-3 gap-1.5">
          {participants.map((participant) => (
            <button
              key={participant.id}
              type="button"
              role="radio"
              aria-checked={participant.id === personId}
              onClick={() => choose(participant.id, date)}
              className={cn(
                "flex h-11 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-1 text-sm",
                participant.id === personId ? "border-brand bg-good font-semibold text-good-foreground" : "bg-card",
              )}
            >
              <Dot color={participant.color} />
              <span className="truncate">{participant.name}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Datum">
          {[
            { day: today, label: "Heute" },
            { day: yesterday, label: "Gestern" },
          ].map((option) => (
            <button
              key={option.day}
              type="button"
              aria-pressed={date === option.day}
              onClick={() => choose(personId, option.day)}
              className={cn(
                "h-9 cursor-pointer rounded-full border px-3 text-sm",
                date === option.day ? "bg-muted font-semibold" : "bg-card",
              )}
            >
              {option.label}
            </button>
          ))}
          <label
            className={cn(
              "relative inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm tabular-nums",
              date !== today && date !== yesterday ? "bg-muted font-semibold" : "bg-card",
            )}
          >
            <CalendarIcon className="size-4" aria-hidden="true" />
            {date !== today && date !== yesterday ? formatDate(date) : <span className="sr-only">Datum wählen</span>}
            <input
              type="date"
              value={date}
              max={today}
              onChange={(event) => isDate(event.target.value) && choose(personId, event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Datum"
            />
          </label>
        </div>

        {kind === "weight" ? (
          <>
            <div className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2">
              <Button type="button" variant="secondary" className="size-12 rounded-xl" onClick={() => step(-0.1)} aria-label="0,1 kg weniger">
                <MinusIcon className="size-5" />
              </Button>
              <label className="flex items-baseline justify-center gap-1.5">
                <span className="sr-only">Gewicht in kg</span>
                <input
                  inputMode="decimal"
                  enterKeyHint="done"
                  value={fields.weight}
                  onChange={(event) => setFields({ ...fields, weight: event.target.value })}
                  onFocus={(event) => event.target.select()}
                  className="w-[5.5ch] bg-transparent text-center text-4xl font-bold tabular-nums outline-none focus-visible:underline"
                />
                <span className="text-base text-muted-foreground">kg</span>
              </label>
              <Button type="button" variant="secondary" className="size-12 rounded-xl" onClick={() => step(0.1)} aria-label="0,1 kg mehr">
                <PlusIcon className="size-5" />
              </Button>
            </div>
            <p className="-mt-2 text-center text-xs text-muted-foreground tabular-nums">
              {weight === null
                ? "Gewicht prüfen"
                : previous
                  ? `${formatSigned(weight - previous.weight)} seit ${formatShortDate(previous.date)}`
                  : `${formatSigned(weight - person.startWeight)} seit Start`}
              {existsHere && !editing && " · ersetzt Wert"}
            </p>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "bodyFat", label: "KFA", unit: "%" },
                  { id: "muscleMass", label: "Muskeln", unit: "kg" },
                  { id: "fatFreeMass", label: "FFM", unit: "kg" },
                ] as const
              ).map((extra) =>
                extras[extra.id] ? (
                  <label key={extra.id} className="space-y-1">
                    <span className="block text-xs font-medium">
                      {extra.label} <span className="text-muted-foreground">{extra.unit}</span>
                    </span>
                    <Input
                      inputMode="decimal"
                      value={fields[extra.id]}
                      onChange={(event) => setFields({ ...fields, [extra.id]: event.target.value })}
                      autoFocus={fields[extra.id] === ""}
                      className="text-right tabular-nums"
                    />
                  </label>
                ) : (
                  <button
                    key={extra.id}
                    type="button"
                    onClick={() => setExtras({ ...extras, [extra.id]: true })}
                    className="h-9 cursor-pointer self-end rounded-full border bg-card text-sm text-muted-foreground hover:text-foreground"
                  >
                    + {extra.label}
                  </button>
                ),
              )}
            </div>
          </>
        ) : (
          <div>
            <p className="pb-1 text-xs text-muted-foreground">cm · grau = zuletzt</p>
            {sites
              .filter((site) => site.active)
              .map((site) => (
                <div key={site.key} className="grid grid-cols-[1fr_auto] items-center gap-2 border-t py-1.5">
                  <span className="text-sm">{site.label}</span>
                  <span className={cn("grid gap-1.5", site.sided ? "grid-cols-2" : "grid-cols-1")}>
                    {siteValueKeys(site).map((key, index) => {
                      const last = lastValueBefore(ownSets, key, date);
                      return (
                        <label key={key} className="relative">
                          <span className="sr-only">
                            {site.label} {site.sided ? (index === 0 ? "links" : "rechts") : ""}
                          </span>
                          {site.sided && (
                            <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs text-muted-foreground">
                              {index === 0 ? "L" : "R"}
                            </span>
                          )}
                          <Input
                            inputMode="decimal"
                            enterKeyHint="next"
                            value={measures[key] ?? ""}
                            placeholder={last !== null ? formatNumber(last) : ""}
                            onChange={(event) => setMeasures({ ...measures, [key]: event.target.value })}
                            className="h-9 w-[5.5rem] text-right tabular-nums"
                          />
                        </label>
                      );
                    })}
                  </span>
                </div>
              ))}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {editing && (
            <Button type="button" variant="outline" size="icon" className="size-12 rounded-xl" onClick={remove} aria-label="Löschen">
              <Trash2Icon className="size-5" />
            </Button>
          )}
          <Button type="submit" disabled={!valid} className="h-12 flex-1 rounded-xl text-base">
            Speichern
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
