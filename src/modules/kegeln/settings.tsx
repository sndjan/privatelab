"use client";

import { Loader2Icon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSettings } from "./actions";
import { centsToInput, columns, nameKey, parseEuro, type Rates } from "./data";
import { useKegelnData, useRefresh } from "./store";

// Team name, threshold, amounts and short names. Amounts only apply to games
// read from now on; saved games keep theirs.
export function SettingsView() {
  const { settings, games } = useKegelnData();
  const refresh = useRefresh();
  const [team, setTeam] = useState(settings.team);
  const [threshold, setThreshold] = useState(String(settings.threshold));
  const [rates, setRates] = useState<Record<keyof Rates, string>>(
    () => Object.fromEntries(columns.map((column) => [column.id, centsToInput(settings.rates[column.id])])) as Record<keyof Rates, string>,
  );
  const [nicknames, setNicknames] = useState(settings.nicknames);
  const [saving, startSaving] = useTransition();

  // Everyone who appears in a saved game, once.
  const players = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const game of games) for (const line of game.lines) if (!byKey.has(nameKey(line.name))) byKey.set(nameKey(line.name), line.name);
    return [...byKey.entries()].sort((a, b) => a[1].localeCompare(b[1], "de"));
  }, [games]);

  const parsed = Object.fromEntries(columns.map((column) => [column.id, parseEuro(rates[column.id])])) as Record<keyof Rates, number | null>;
  const thresholdValue = Number(threshold);
  const valid =
    team.trim() && Number.isInteger(thresholdValue) && thresholdValue > 0 && Object.values(parsed).every((value) => value !== null);

  function save() {
    if (!valid) return;
    startSaving(async () => {
      const result = await saveSettings({
        team: team.trim(),
        threshold: thresholdValue,
        rates: parsed as Rates,
        nicknames,
      }).catch(() => ({ error: "Nicht gespeichert." }));
      if (result.error !== undefined) {
        toast.error(result.error);
        return;
      }
      await refresh();
      toast.success("Gespeichert");
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mannschaft und Beträge</CardTitle>
          <CardDescription>Neue Beträge gelten für Spiele, die du ab jetzt einliest. Gespeicherte Spiele behalten ihre.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label className="flex flex-col items-stretch gap-1.5">
            Unsere Mannschaft heißt (Teil des Namens genügt)
            <Input value={team} maxLength={80} onChange={(event) => setTeam(event.target.value)} />
          </Label>
          <Label className="flex flex-col items-stretch gap-1.5">
            Kostet extra, wenn jemand weniger Kegel hat als
            <Input type="number" inputMode="numeric" min={1} max={1199} value={threshold} onChange={(event) => setThreshold(event.target.value)} />
          </Label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {columns.map((column) => (
              <Label key={column.id} className="flex flex-col items-stretch gap-1.5 text-sm">
                {column.id === "under" ? `unter ${threshold || "…"}` : column.id === "error" ? "pro Fehler" : column.id === "two" ? "pro 2er" : column.id === "golden" ? "pro Goldenem" : column.id === "conduct" ? "Unsportlich" : column.id === "late" ? "Zu spät" : column.label}
                <div className="relative">
                  <Input
                    inputMode="decimal"
                    value={rates[column.id]}
                    aria-invalid={parsed[column.id] === null}
                    className="pr-7 tabular-nums"
                    onChange={(event) => setRates({ ...rates, [column.id]: event.target.value })}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                </div>
              </Label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">0 € blendet die Spalte in der Tabelle aus.</p>
        </CardContent>
      </Card>

      {players.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Spitznamen</CardTitle>
            <CardDescription>So stehen die Spieler in der Tabelle, z. B. „Benni“ statt „Amon, Benjamin“.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {players.map(([key, name]) => (
              <Label key={key} className="grid grid-cols-[1fr_1fr] items-center gap-3 font-normal">
                <span className="truncate">{name}</span>
                <Input
                  value={nicknames[key] ?? ""}
                  maxLength={40}
                  placeholder="Spitzname"
                  onChange={(event) => setNicknames({ ...nicknames, [key]: event.target.value })}
                />
              </Label>
            ))}
          </CardContent>
        </Card>
      )}

      <Button onClick={save} disabled={!valid || saving}>
        {saving && <Loader2Icon className="animate-spin" />} Einstellungen speichern
      </Button>
    </div>
  );
}
