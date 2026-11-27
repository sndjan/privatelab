"use client";

import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { confirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { deleteItem, saveItem } from "./actions";
import { cleanClient, formatMinutes, parseMinutes, priorities, statusesFor, type Item, type ItemInput, type Kind } from "./data";
import { isOpen, itemLabel } from "./plan";
import { useKanzleiData, useRun, type ItemDialogRequest } from "./store";

const NONE = "none";

// Adds or edits an order or a task. Rendered with a key per request, so its
// fields start fresh each time it opens.
export function ItemDialog({ request, onClose }: { request: ItemDialogRequest; onClose: () => void }) {
  const { types, items, settings } = useKanzleiData();
  const run = useRun();
  const existing = request.item;
  const [kind, setKind] = useState<Kind>(existing?.kind ?? request.kind ?? "auftrag");
  const kindTypes = types.filter((type) => type.kind === kind);
  const [typeId, setTypeId] = useState(existing?.typeId ?? kindTypes[0]?.id ?? "");
  const [client, setClient] = useState(existing?.client ?? request.client ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [period, setPeriod] = useState(existing?.period ?? "");
  const [status, setStatus] = useState<string>(existing?.status ?? (kind === "auftrag" ? "warte_unterlagen" : "offen"));
  const [priority, setPriority] = useState<1 | 2 | 3>(existing?.priority ?? 2);
  const [deadlineInternal, setDeadlineInternal] = useState(existing?.deadlineInternal ?? "");
  const [deadlineLegal, setDeadlineLegal] = useState(existing?.deadlineLegal ?? "");
  const defaultMinutes = (id: string) => types.find((type) => type.id === id)?.defaultMinutes ?? (kind === "aufgabe" ? settings.taskMinutes : 60);
  const [estimate, setEstimate] = useState(existing ? `${existing.estimate} min` : `${defaultMinutes(typeId)} min`);
  const [remaining, setRemaining] = useState(existing ? `${existing.remaining} min` : "");
  const [estimateTouched, setEstimateTouched] = useState(Boolean(existing));
  const [docsAt, setDocsAt] = useState(existing?.docsAt ?? "");
  const [followUp, setFollowUp] = useState(existing?.followUp ?? "");
  const [plannedFor, setPlannedFor] = useState(existing?.plannedFor ?? "");
  const [nextStep, setNextStep] = useState(existing?.nextStep ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [parentId, setParentId] = useState(existing?.parentId ?? request.parentId ?? "");
  const [dependsOn, setDependsOn] = useState(existing?.dependsOn ?? "");
  const [saving, setSaving] = useState(false);

  const estimateMinutes = parseMinutes(estimate);
  const remainingMinutes = remaining.trim() === "" ? estimateMinutes : parseMinutes(remaining);
  const clientValid = client.trim() === "" || /^\d{5}$/.test(client.trim());
  const valid = clientValid && estimateMinutes !== null && remainingMinutes !== null;
  const others = items.filter((item) => item.id !== existing?.id && (isOpen(item) || item.id === dependsOn || item.id === parentId));
  const orders = others.filter((item) => item.kind === "auftrag");

  function switchKind(next: Kind) {
    setKind(next);
    const first = types.find((type) => type.kind === next);
    setTypeId(first?.id ?? "");
    setStatus(next === "auftrag" ? "warte_unterlagen" : "offen");
    if (!estimateTouched) setEstimate(`${first?.defaultMinutes ?? (next === "aufgabe" ? settings.taskMinutes : 60)} min`);
  }

  async function save() {
    if (!valid) return;
    setSaving(true);
    const input: Partial<ItemInput> = {
      kind,
      typeId: typeId || null,
      client: cleanClient(client),
      title,
      period,
      status: status as ItemInput["status"],
      priority,
      deadlineInternal: deadlineInternal || null,
      deadlineLegal: deadlineLegal || null,
      estimate: estimateMinutes ?? 0,
      remaining: remainingMinutes ?? 0,
      docsAt: docsAt || null,
      followUp: followUp || null,
      plannedFor: plannedFor || null,
      nextStep,
      note,
      parentId: kind === "aufgabe" ? parentId || null : null,
      dependsOn: dependsOn || null,
    };
    const result = await run(() => saveItem(existing?.id ?? null, input), existing ? "Gespeichert" : "Angelegt");
    setSaving(false);
    if (result && !("error" in result && result.error)) onClose();
  }

  async function remove() {
    if (!existing) return;
    if (!(await confirmDialog({ title: "Eintrag löschen?", description: "Im Verlauf lässt sich das rückgängig machen." }))) return;
    await run(() => deleteItem(existing.id), "Gelöscht");
    onClose();
  }

  const field = "space-y-1.5";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <DialogHeader>
            <DialogTitle>{existing ? "Bearbeiten" : kind === "auftrag" ? "Neuer Auftrag" : "Neue Aufgabe"}</DialogTitle>
          </DialogHeader>

          {!existing && (
            <div role="radiogroup" aria-label="Art" className="flex gap-1 rounded-lg bg-muted p-1">
              {(["auftrag", "aufgabe"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={kind === option}
                  onClick={() => switchKind(option)}
                  className={cn(
                    "h-9 flex-1 cursor-pointer rounded-md text-sm",
                    kind === option ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {option === "auftrag" ? "Auftrag" : "Aufgabe"}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className={field}>
              <Label htmlFor="item-type">Art</Label>
              <Select
                value={typeId || NONE}
                onValueChange={(value) => {
                  const next = value === NONE ? "" : value;
                  setTypeId(next);
                  if (!estimateTouched) setEstimate(`${defaultMinutes(next)} min`);
                }}
              >
                <SelectTrigger id="item-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kindTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NONE}>Ohne Art</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={field}>
              <Label htmlFor="item-client">Mandant</Label>
              <Input
                id="item-client"
                inputMode="numeric"
                placeholder="5-stellig, optional"
                value={client}
                aria-invalid={!clientValid}
                onChange={(event) => setClient(event.target.value.replace(/\D/g, "").slice(0, 5))}
              />
            </div>
            <div className={field}>
              <Label htmlFor="item-period">Zeitraum</Label>
              <Input id="item-period" placeholder="z. B. 11/2026, 2025" value={period} onChange={(event) => setPeriod(event.target.value)} />
            </div>
          </div>

          <div className={field}>
            <Label htmlFor="item-title">Titel</Label>
            <Input id="item-title" placeholder="kurz, ohne Namen" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className={field}>
              <Label htmlFor="item-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="item-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusesFor(kind).map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={field}>
              <Label htmlFor="item-priority">Priorität</Label>
              <Select value={String(priority)} onValueChange={(value) => setPriority(Number(value) as 1 | 2 | 3)}>
                <SelectTrigger id="item-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((option) => (
                    <SelectItem key={option.id} value={String(option.id)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={field}>
              <Label htmlFor="item-planned">Fest geplant für</Label>
              <Input id="item-planned" type="date" value={plannedFor} onChange={(event) => setPlannedFor(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className={field}>
              <Label htmlFor="item-internal">Frist intern</Label>
              <Input id="item-internal" type="date" value={deadlineInternal} onChange={(event) => setDeadlineInternal(event.target.value)} />
            </div>
            <div className={field}>
              <Label htmlFor="item-legal">Frist gesetzlich</Label>
              <Input id="item-legal" type="date" value={deadlineLegal} onChange={(event) => setDeadlineLegal(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className={field}>
              <Label htmlFor="item-estimate">Aufwand geschätzt</Label>
              <Input
                id="item-estimate"
                value={estimate}
                aria-invalid={estimateMinutes === null}
                placeholder="z. B. 2 h oder 90"
                onChange={(event) => {
                  setEstimate(event.target.value);
                  setEstimateTouched(true);
                }}
              />
              {estimateMinutes !== null && <p className="text-xs text-muted-foreground">= {formatMinutes(estimateMinutes)}</p>}
            </div>
            <div className={field}>
              <Label htmlFor="item-remaining">Restaufwand</Label>
              <Input
                id="item-remaining"
                value={remaining}
                aria-invalid={remainingMinutes === null}
                placeholder="leer = wie geschätzt"
                onChange={(event) => setRemaining(event.target.value)}
              />
              {remainingMinutes !== null && remaining.trim() !== "" && <p className="text-xs text-muted-foreground">= {formatMinutes(remainingMinutes)}</p>}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className={field}>
              <Label htmlFor="item-docs">Unterlagen eingegangen am</Label>
              <Input id="item-docs" type="date" value={docsAt} onChange={(event) => setDocsAt(event.target.value)} />
            </div>
            <div className={field}>
              <Label htmlFor="item-followup">Wiedervorlage</Label>
              <Input id="item-followup" type="date" value={followUp} onChange={(event) => setFollowUp(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {kind === "aufgabe" && (
              <ItemSelect id="item-parent" label="Gehört zu Auftrag" value={parentId} onChange={setParentId} items={orders} />
            )}
            <ItemSelect id="item-depends" label="Erst wenn erledigt ist" value={dependsOn} onChange={setDependsOn} items={others} />
          </div>

          <div className={field}>
            <Label htmlFor="item-next">Nächster Schritt</Label>
            <Input id="item-next" value={nextStep} maxLength={300} onChange={(event) => setNextStep(event.target.value)} />
          </div>

          <div className={field}>
            <Label htmlFor="item-note">Notiz</Label>
            <Textarea id="item-note" rows={2} maxLength={4000} value={note} onChange={(event) => setNote(event.target.value)} />
            <p className="text-xs text-muted-foreground">Bleibt im Programm und geht nie an die KI. Titel und nächster Schritt sieht die KI.</p>
          </div>

          <DialogFooter className="flex-row items-center justify-between gap-2">
            {existing ? (
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={remove}>
                <Trash2Icon /> Löschen
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" variant="brand" disabled={!valid || saving}>
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ItemSelect({
  id,
  label,
  value,
  onChange,
  items,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: Item[];
}) {
  const { types } = useKanzleiData();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? "" : next)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>–</SelectItem>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {itemLabel(item, types)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
