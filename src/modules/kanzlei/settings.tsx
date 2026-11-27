"use client";

import { DownloadIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { confirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  deleteAbsence,
  deleteRecurring,
  deleteType,
  exportAll,
  saveAbsence,
  saveRecurring,
  saveSettings,
  saveType,
} from "./actions";
import {
  colorHex,
  colors,
  formatDate,
  formatMinutes,
  parseMinutes,
  rhythms,
  type Recurring,
  type RecurringInput,
  type Settings,
  type TypeDef,
} from "./data";
import { useKanzleiData, useRun } from "./store";

const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const card = "space-y-4 rounded-xl border bg-card p-4";

export function SettingsView() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Einstellungen</h1>
      <WorkTime />
      <Types />
      <RecurringList />
      <Absences />
      <Backup />
    </div>
  );
}

function WorkTime() {
  const { settings } = useKanzleiData();
  const run = useRun();
  const [form, setForm] = useState<Settings>(settings);
  const [hours, setHours] = useState(settings.dayMinutes.map((minutes) => String(minutes / 60).replace(".", ",")));
  const sum = form.shareOrders + form.shareDaily + form.shareBuffer;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <section className={card}>
      <h2 className="font-semibold">Arbeitszeit und Aufteilung</h2>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => (
          <div key={day} className="space-y-1.5">
            <Label htmlFor={`day-${index}`}>{day}</Label>
            <Input
              id={`day-${index}`}
              inputMode="decimal"
              value={hours[index]}
              onChange={(event) => {
                const next = [...hours];
                next[index] = event.target.value;
                setHours(next);
                const value = Number(event.target.value.replace(",", "."));
                if (Number.isFinite(value)) {
                  const minutes = [...form.dayMinutes];
                  minutes[index] = Math.round(value * 60);
                  set("dayMinutes", minutes);
                }
              }}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Netto-Stunden je Tag, ohne Pause.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField id="share-orders" label="Mandantenaufträge %" value={form.shareOrders} onChange={(value) => set("shareOrders", value)} />
        <NumberField id="share-daily" label="Tagesgeschäft %" value={form.shareDaily} onChange={(value) => set("shareDaily", value)} />
        <NumberField id="share-buffer" label="Puffer %" value={form.shareBuffer} onChange={(value) => set("shareBuffer", value)} />
      </div>
      {sum !== 100 && <p className="text-xs text-amber-700 dark:text-amber-400">Zusammen {sum} %. Die Anteile werden auf 100 % umgerechnet.</p>}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="start-time">Arbeitsbeginn</Label>
          <Input id="start-time" type="time" value={form.startTime} onChange={(event) => set("startTime", event.target.value)} />
        </div>
        <NumberField id="break" label="Pause (min)" value={form.breakMinutes} onChange={(value) => set("breakMinutes", value)} />
        <NumberField id="followup" label="Wiedervorlage nach (Arbeitstage)" value={form.followupWorkdays} onChange={(value) => set("followupWorkdays", value)} />
        <NumberField id="task-minutes" label="Kleine Aufgabe (min)" value={form.taskMinutes} onChange={(value) => set("taskMinutes", value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="holidays">Feiertage</Label>
        <Select value={form.holidayState} onValueChange={(value) => set("holidayState", value as "BW" | "BY")}>
          <SelectTrigger id="holidays" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BW">Baden-Württemberg</SelectItem>
            <SelectItem value="BY">Bayern</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button variant="brand" onClick={() => run(() => saveSettings(form), "Gespeichert")}>
        Speichern
      </Button>
    </section>
  );
}

function NumberField({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" min={0} value={value} onChange={(event) => onChange(Math.max(0, Math.round(Number(event.target.value) || 0)))} />
    </div>
  );
}

function Types() {
  const { types } = useKanzleiData();
  return (
    <section className={card}>
      <div>
        <h2 className="font-semibold">Arten</h2>
        <p className="text-sm text-muted-foreground">Frei erweiterbar. Der Standardaufwand wird bei neuen Einträgen vorgeschlagen.</p>
      </div>
      {(["auftrag", "aufgabe"] as const).map((kind) => (
        <div key={kind} className="space-y-2">
          <h3 className="text-sm font-medium">{kind === "auftrag" ? "Aufträge" : "Aufgaben"}</h3>
          <ul className="space-y-2">
            {types
              .filter((type) => type.kind === kind)
              .map((type) => (
                <TypeRow key={type.id} type={type} />
              ))}
            <TypeRow key={`new-${kind}-${types.length}`} kind={kind} />
          </ul>
        </div>
      ))}
    </section>
  );
}

function TypeRow({ type, kind }: { type?: TypeDef; kind?: "auftrag" | "aufgabe" }) {
  const run = useRun();
  const [name, setName] = useState(type?.name ?? "");
  const [minutes, setMinutes] = useState(type ? `${type.defaultMinutes} min` : "");
  const [color, setColor] = useState(type?.color ?? "gray");
  const parsed = parseMinutes(minutes) ?? 0;
  const changed = !type || name !== type.name || parsed !== type.defaultMinutes || color !== type.color;

  return (
    <li className="flex flex-wrap items-center gap-2">
      <Select value={color} onValueChange={setColor}>
        <SelectTrigger aria-label="Farbe" className="w-16">
          <span className="size-3 rounded-full" style={{ background: colorHex(color) }} />
        </SelectTrigger>
        <SelectContent>
          {colors.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              <span className="size-3 rounded-full" style={{ background: option.hex }} /> {option.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input aria-label="Name" className="w-56" placeholder={type ? "" : "Neue Art"} value={name} onChange={(event) => setName(event.target.value)} />
      <Input aria-label="Standardaufwand" className="w-28" placeholder="Aufwand" value={minutes} onChange={(event) => setMinutes(event.target.value)} />
      <span className="w-16 text-xs text-muted-foreground">{formatMinutes(parsed)}</span>
      {changed && name.trim() && (
        <Button
          size="sm"
          variant={type ? "outline" : "brand"}
          onClick={async () => {
            await run(() => saveType(type?.id ?? null, { name, kind: type?.kind ?? kind, defaultMinutes: parsed, color }), type ? "Gespeichert" : "Angelegt");
            if (!type) {
              setName("");
              setMinutes("");
            }
          }}
        >
          {type ? "Speichern" : <><PlusIcon /> Hinzufügen</>}
        </Button>
      )}
      {type && (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`${type.name} löschen`}
          onClick={async () => {
            if (await confirmDialog({ title: `„${type.name}“ löschen?`, description: "Einträge dieser Art bleiben, nur ohne Art." }))
              await run(() => deleteType(type.id));
          }}
        >
          <Trash2Icon />
        </Button>
      )}
    </li>
  );
}

function RecurringList() {
  const { recurring, types } = useKanzleiData();
  const [editing, setEditing] = useState<Recurring | "new" | null>(null);
  return (
    <section className={card}>
      <div>
        <h2 className="font-semibold">Wiederkehrende Aufträge</h2>
        <p className="text-sm text-muted-foreground">
          Legt zu Beginn jedes Zeitraums einen Auftrag an (Status „Warte auf Unterlagen“). Fristen als Tage nach Ende des Zeitraums, z. B. 10 für
          die UStVA.
        </p>
      </div>
      <ul className="divide-y rounded-lg border">
        {recurring.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Noch keine.</li>}
        {recurring.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1">
              <b>{[types.find((type) => type.id === entry.typeId)?.name, entry.client, entry.title].filter(Boolean).join(" · ") || "Ohne Titel"}</b>
              <span className="block text-xs text-muted-foreground">
                {rhythms.find((rhythm) => rhythm.id === entry.rhythm)?.label} · {formatMinutes(entry.estimate)} · nächster Zeitraum ab {formatDate(entry.nextPeriod, true)}
                {entry.active ? "" : " · pausiert"}
              </span>
            </span>
            <Button size="sm" variant="outline" onClick={() => setEditing(entry)}>
              Bearbeiten
            </Button>
          </li>
        ))}
      </ul>
      {editing ? (
        <RecurringForm key={editing === "new" ? "new" : editing.id} entry={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />
      ) : (
        <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
          <PlusIcon /> Wiederkehrender Auftrag
        </Button>
      )}
    </section>
  );
}

function RecurringForm({ entry, onClose }: { entry?: Recurring; onClose: () => void }) {
  const { types, today } = useKanzleiData();
  const run = useRun();
  const orderTypes = types.filter((type) => type.kind === "auftrag");
  const [form, setForm] = useState<RecurringInput>(
    entry ?? {
      client: "",
      typeId: orderTypes[0]?.id ?? null,
      title: "",
      rhythm: "monthly",
      estimate: orderTypes[0]?.defaultMinutes ?? 60,
      internalOffsetDays: 5,
      legalOffsetDays: 10,
      nextPeriod: `${today.slice(0, 8)}01`,
      active: true,
    },
  );
  const [estimate, setEstimate] = useState(`${form.estimate} min`);
  const set = <K extends keyof RecurringInput>(key: K, value: RecurringInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const offset = (value: string) => (value.trim() === "" ? null : Math.round(Number(value)) || 0);

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="rec-type">Art</Label>
          <Select value={form.typeId ?? ""} onValueChange={(value) => set("typeId", value)}>
            <SelectTrigger id="rec-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {orderTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rec-client">Mandant</Label>
          <Input id="rec-client" inputMode="numeric" value={form.client} onChange={(event) => set("client", event.target.value.replace(/\D/g, "").slice(0, 5))} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="rec-title">Titel (optional)</Label>
          <Input id="rec-title" value={form.title} onChange={(event) => set("title", event.target.value)} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        <div className="space-y-1.5">
          <Label htmlFor="rec-rhythm">Rhythmus</Label>
          <Select value={form.rhythm} onValueChange={(value) => set("rhythm", value as RecurringInput["rhythm"])}>
            <SelectTrigger id="rec-rhythm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rhythms.map((rhythm) => (
                <SelectItem key={rhythm.id} value={rhythm.id}>
                  {rhythm.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rec-estimate">Aufwand</Label>
          <Input id="rec-estimate" value={estimate} onChange={(event) => setEstimate(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rec-internal">Frist intern (+Tage)</Label>
          <Input
            id="rec-internal"
            inputMode="numeric"
            value={form.internalOffsetDays ?? ""}
            onChange={(event) => set("internalOffsetDays", offset(event.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rec-legal">Frist gesetzl. (+Tage)</Label>
          <Input id="rec-legal" inputMode="numeric" value={form.legalOffsetDays ?? ""} onChange={(event) => set("legalOffsetDays", offset(event.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rec-next">Nächster Zeitraum ab</Label>
          <Input id="rec-next" type="date" value={form.nextPeriod} onChange={(event) => set("nextPeriod", event.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={form.active} onCheckedChange={(checked) => set("active", checked === true)} /> Aktiv
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="brand"
          onClick={async () => {
            await run(() => saveRecurring(entry?.id ?? null, { ...form, estimate: parseMinutes(estimate) ?? form.estimate }), "Gespeichert");
            onClose();
          }}
        >
          Speichern
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Abbrechen
        </Button>
        {entry && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-destructive"
            onClick={async () => {
              if (!(await confirmDialog({ title: "Wiederkehrenden Auftrag löschen?", description: "Schon angelegte Aufträge bleiben." }))) return;
              await run(() => deleteRecurring(entry.id));
              onClose();
            }}
          >
            <Trash2Icon /> Löschen
          </Button>
        )}
      </div>
    </div>
  );
}

function Absences() {
  const { absences, today } = useKanzleiData();
  const run = useRun();
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [label, setLabel] = useState("Urlaub");
  return (
    <section className={card}>
      <h2 className="font-semibold">Abwesenheiten</h2>
      <p className="text-sm text-muted-foreground">Urlaub, Fortbildung, Krankheit. Feiertage kommen automatisch dazu.</p>
      <ul className="space-y-1 text-sm">
        {absences.map((absence) => (
          <li key={absence.id} className="flex items-center gap-2">
            <span className="flex-1">
              {absence.label}: {formatDate(absence.startDate, true)}
              {absence.endDate !== absence.startDate && ` – ${formatDate(absence.endDate, true)}`}
            </span>
            <Button size="icon-sm" variant="ghost" aria-label="Löschen" onClick={() => run(() => deleteAbsence(absence.id))}>
              <Trash2Icon />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="abs-label">Was</Label>
          <Input id="abs-label" className="w-40" value={label} onChange={(event) => setLabel(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="abs-start">Von</Label>
          <Input id="abs-start" type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="abs-end">Bis</Label>
          <Input id="abs-end" type="date" value={end} min={start} onChange={(event) => setEnd(event.target.value)} />
        </div>
        <Button variant="outline" onClick={() => run(() => saveAbsence(null, { startDate: start, endDate: end, label }), "Eingetragen")}>
          <PlusIcon /> Eintragen
        </Button>
      </div>
    </section>
  );
}

function Backup() {
  const [busy, setBusy] = useState(false);
  return (
    <section className={card}>
      <h2 className="font-semibold">Datensicherung</h2>
      <p className="text-sm text-muted-foreground">Alle Daten als JSON-Datei: Aufträge, Aufgaben, Einstellungen, Verlauf.</p>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const json = await exportAll();
            const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = `kanzlei-planer-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(url);
          } finally {
            setBusy(false);
          }
        }}
      >
        <DownloadIcon /> Export herunterladen
      </Button>
    </section>
  );
}
