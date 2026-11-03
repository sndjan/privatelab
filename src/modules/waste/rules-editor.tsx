"use client";

import { ChevronLeftIcon, Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveRules } from "./actions";
import { BinIcon } from "./bin-icon";
import { baseBins, binIds, containers, type Container, type LocalBin, type LocalRules } from "./bins";
import { useRefresh } from "./hooks";
import type { Place } from "./loaders";

const containerNames: Record<Container, string> = {
  tonne: "Tonne",
  sack: "Sack",
  container: "Container",
  hof: "Wertstoffhof",
  mobil: "Schadstoffmobil",
  laden: "Handel",
};

const lines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const emptyBin = (id: LocalBin["id"]): LocalBin => ({
  id,
  available: true,
  localName: "",
  container: "",
  extraYes: [],
  extraNo: [],
  note: "",
});

// For admins: correct what the AI found, e.g. after checking the authority's
// website. Fields left empty mean "like the national baseline".
export function RulesEditor({
  rulesKey,
  place,
  rules,
  onDone,
}: {
  rulesKey: string;
  place: Place;
  rules: LocalRules | null;
  onDone: () => void;
}) {
  const refresh = useRefresh();
  const [pending, startTransition] = useTransition();
  const [authority, setAuthority] = useState(rules?.authority ?? "");
  const [authorityUrl, setAuthorityUrl] = useState(rules?.authorityUrl ?? "");
  const [summary, setSummary] = useState(rules?.summary ?? "");
  const [notes, setNotes] = useState((rules?.notes ?? []).join("\n"));
  const [bins, setBins] = useState(() =>
    binIds.map((id) => {
      const bin = rules?.bins.find((entry) => entry.id === id) ?? emptyBin(id);
      return { ...bin, extraYesText: bin.extraYes.join("\n"), extraNoText: bin.extraNo.join("\n") };
    }),
  );
  const update = (id: string, change: Partial<(typeof bins)[number]>) =>
    setBins((current) => current.map((bin) => (bin.id === id ? { ...bin, ...change } : bin)));

  function save(event: React.FormEvent) {
    event.preventDefault();
    const next: LocalRules = {
      authority,
      authorityUrl: authorityUrl.trim() || null,
      summary,
      notes: lines(notes),
      bins: bins
        .map(({ extraYesText, extraNoText, ...bin }) => ({ ...bin, extraYes: lines(extraYesText), extraNo: lines(extraNoText) }))
        // Only what differs from the baseline is stored.
        .filter((bin) => !bin.available || bin.localName || bin.container || bin.extraYes.length || bin.extraNo.length || bin.note),
    };
    startTransition(async () => {
      const result = await saveRules(rulesKey, next).catch(() => ({ error: "Speichern hat nicht geklappt." }));
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Gespeichert");
      await refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-2xl space-y-6">
      <div className="-ml-2 flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon" className="size-10 text-muted-foreground" onClick={onDone} aria-label="Abbrechen">
          <ChevronLeftIcon className="size-5" />
        </Button>
        <h2 className="truncate text-xl font-semibold tracking-tight">Regeln für {place.name} bearbeiten</h2>
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="authority">Zuständiger Abfallbetrieb</Label>
          <Input id="authority" value={authority} onChange={(event) => setAuthority(event.target.value)} maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="authority-url">Website</Label>
          <Input id="authority-url" type="url" value={authorityUrl} onChange={(event) => setAuthorityUrl(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="summary">Zusammenfassung</Label>
          <Textarea id="summary" value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={600} rows={3} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Gut zu wissen (eine Zeile pro Hinweis)</Label>
          <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
        </div>
      </div>

      <p className="px-1 text-sm text-muted-foreground">
        Pro Tonne nur eintragen, was vor Ort anders ist. Leere Felder = wie in den allgemeinen Regeln.
      </p>

      {bins.map((bin) => {
        const base = baseBins[bin.id];
        return (
          <fieldset key={bin.id} className="space-y-3 rounded-xl border bg-card p-4">
            <legend className="sr-only">{base.name}</legend>
            <div className="flex items-center gap-3">
              <BinIcon color={base.color} container={bin.container || base.container} className="size-10" />
              <p className="flex-1 font-semibold">{base.name}</p>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={bin.available} onCheckedChange={(checked) => update(bin.id, { available: checked === true })} />
                Gibt es hier
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${bin.id}-name`}>Name vor Ort</Label>
                <Input
                  id={`${bin.id}-name`}
                  value={bin.localName}
                  onChange={(event) => update(bin.id, { localName: event.target.value })}
                  placeholder={base.name}
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${bin.id}-container`}>Sammlung</Label>
                <select
                  id={`${bin.id}-container`}
                  value={bin.container}
                  onChange={(event) => update(bin.id, { container: event.target.value as Container | "" })}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                >
                  <option value="">Wie allgemein ({containerNames[base.container]})</option>
                  {containers.map((container) => (
                    <option key={container} value={container}>
                      {containerNames[container]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${bin.id}-yes`}>Zusätzlich erlaubt</Label>
                <Textarea
                  id={`${bin.id}-yes`}
                  value={bin.extraYesText}
                  onChange={(event) => update(bin.id, { extraYesText: event.target.value })}
                  rows={3}
                  placeholder="Eine Zeile pro Eintrag"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${bin.id}-no`}>Hier nicht erlaubt</Label>
                <Textarea
                  id={`${bin.id}-no`}
                  value={bin.extraNoText}
                  onChange={(event) => update(bin.id, { extraNoText: event.target.value })}
                  rows={3}
                  placeholder="Eine Zeile pro Eintrag"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${bin.id}-note`}>Hinweis</Label>
              <Input id={`${bin.id}-note`} value={bin.note} onChange={(event) => update(bin.id, { note: event.target.value })} maxLength={300} />
            </div>
          </fieldset>
        );
      })}

      <div className="sticky bottom-4 flex gap-2">
        <Button type="submit" size="lg" className="h-12 flex-1" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />} Speichern
        </Button>
        <Button type="button" variant="outline" size="lg" className="h-12 bg-background" onClick={onDone} disabled={pending}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
