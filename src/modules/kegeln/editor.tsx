"use client";

import { CameraIcon, FileUpIcon, ImageIcon, Loader2Icon, PlusIcon, TrashIcon, TriangleAlertIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useViewNavigate } from "@/lib/query/view-link";
import { saveGame, scanReport, scanThrowSheets } from "./actions";
import {
  analyzeSheet,
  displayName,
  emptyLine,
  feesOf,
  formatEuro,
  linesFromReport,
  matchLine,
  seasonOf,
  type Game,
  type Line,
} from "./data";
import { FeeTable } from "./fee-table";
import { prepareFile } from "./image";
import { PATH, useKegelnData, useRefresh } from "./store";

type Draft = Omit<Game, "id" | "createdAt"> & { id: string | null };

// Where the Zweier and Goldenen of a player were found, for checking them
// against the paper.
type SheetNote = { twoAt: string[]; goldenAt: string[]; warnings: string[] };

// A new game from the Spielbericht (and optionally the Wurfscheine), or an
// existing one to change. Everything read can be corrected before saving.
export function GameEditor({ game }: { game?: Game }) {
  const { settings } = useKegelnData();
  const navigate = useViewNavigate();
  const refresh = useRefresh();
  const [draft, setDraft] = useState<Draft>(() =>
    game
      ? { ...game, id: game.id }
      : {
          id: null,
          playedOn: null,
          matchday: null,
          season: seasonOf(null),
          opponent: "",
          home: null,
          threshold: settings.threshold,
          rates: settings.rates,
          lines: [],
          note: "",
        },
  );
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sheetNotes, setSheetNotes] = useState<Record<string, SheetNote>>({});
  const [busy, setBusy] = useState<null | "report" | "sheets">(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const hasLines = draft.lines.length > 0;

  const setLine = (index: number, patch: Partial<Line>) =>
    setDraft((current) => ({ ...current, lines: current.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)) }));

  async function readReport(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy("report");
    try {
      const prepared = await prepareFile(file);
      const data = new FormData();
      data.set("file", prepared.blob, prepared.name);
      const result = await scanReport(data).catch(() => ({ error: "Das Auslesen hat nicht geklappt. Bitte noch einmal versuchen." }));
      if (result.error !== undefined) {
        setError(result.error);
        return;
      }
      const { report } = result;
      const ours = report.ourSide;
      setDraft((current) => ({
        ...current,
        playedOn: report.date ?? current.playedOn,
        matchday: report.matchday ?? current.matchday,
        season: report.season || seasonOf(report.date),
        opponent: ours === "home" ? report.guest : ours === "guest" ? report.home : current.opponent,
        home: ours === "home" ? true : ours === "guest" ? false : current.home,
        lines: linesFromReport(report),
      }));
      setSheetNotes({});
      setWarnings(report.warnings);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Die Datei konnte nicht gelesen werden.");
    } finally {
      setBusy(null);
    }
  }

  // Several files may come at once (one photo per player); each is read on
  // its own and matched to the players by name.
  async function readSheets(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    setBusy("sheets");
    const problems: string[] = [];
    // Results by player name, applied at the end to whatever the lines are
    // then, so edits made while reading stay.
    const found: Record<string, { twos: number; golden: number }> = {};
    const notes = { ...sheetNotes };
    try {
      for (const file of files) {
        const prepared = await prepareFile(file);
        const data = new FormData();
        data.set("file", prepared.blob, prepared.name);
        const result = await scanThrowSheets(data).catch(() => ({ error: "Ein Wurfschein konnte nicht gelesen werden." }));
        if (result.error !== undefined) {
          problems.push(result.error);
          continue;
        }
        for (const sheet of result.sheets) {
          const index = matchLine(draft.lines, sheet.name);
          if (index < 0) {
            problems.push(`Der Wurfschein von „${sheet.name || "?"}“ passt zu keinem Spieler.`);
            continue;
          }
          const analysis = analyzeSheet(sheet.sets);
          const name = draft.lines[index].name;
          found[name] = { twos: analysis.twos, golden: analysis.golden };
          notes[name] = { twoAt: analysis.twoAt, goldenAt: analysis.goldenAt, warnings: analysis.warnings };
        }
      }
    } catch (problem) {
      problems.push(problem instanceof Error ? problem.message : "Eine Datei konnte nicht gelesen werden.");
    } finally {
      setDraft((current) => ({
        ...current,
        lines: current.lines.map((line) => (found[line.name] ? { ...line, ...found[line.name], sheet: true } : line)),
      }));
      setSheetNotes(notes);
      setBusy(null);
      if (problems.length > 0) setError(problems.join(" "));
    }
  }

  function save() {
    setError(null);
    startSaving(async () => {
      const result = await saveGame(draft).catch(() => ({ error: "Nicht gespeichert. Bitte noch einmal versuchen." }));
      if (result.error !== undefined) {
        setError(result.error);
        return;
      }
      await refresh();
      toast.success("Gespeichert");
      navigate(`${PATH}?view=game&id=${result.id}`, { replace: true });
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Spielbericht</CardTitle>
          <CardDescription>
            Foto oder PDF vom Spielbericht. Die KI liest für jeden Spieler von „{settings.team}“ die Fehler, die Kegel und den
            Mannschaftspunkt aus, und ein handschriftliches „M“ als Maß.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UploadButtons
            busy={busy === "report"}
            disabled={busy !== null}
            busyText="Liest den Spielbericht … das dauert etwa eine halbe Minute."
            onFiles={(files) => void readReport(files[0])}
            again={hasLines}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Wurfscheine (optional)</CardTitle>
          <CardDescription>
            Für die Zweier (auf das volle Bild) und die Goldenen. Ein Foto pro Spieler oder eine PDF mit allen. Ohne Wurfschein trägst du
            sie unten selbst ein.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasLines ? (
            <UploadButtons
              multiple
              busy={busy === "sheets"}
              disabled={busy !== null}
              busyText="Liest die Wurfscheine … pro Zettel etwa eine halbe Minute."
              onFiles={(files) => void readSheets(files)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Erst den Spielbericht einlesen oder unten Spieler eintragen.</p>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Das hat nicht ganz geklappt</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {warnings.length > 0 && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Bitte prüfen</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>3. Prüfen</CardTitle>
          <CardDescription>Vergleich kurz mit dem Zettel und korrigier, was falsch gelesen wurde.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Spieltag">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                value={draft.matchday ?? ""}
                onChange={(event) => setDraft({ ...draft, matchday: event.target.value ? Number(event.target.value) : null })}
              />
            </Field>
            <Field label="Datum">
              <Input
                type="date"
                value={draft.playedOn ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, playedOn: event.target.value || null, season: draft.season || seasonOf(event.target.value || null) })
                }
              />
            </Field>
            <Field label="Gegner" className="col-span-2">
              <Input value={draft.opponent} maxLength={120} onChange={(event) => setDraft({ ...draft, opponent: event.target.value })} />
            </Field>
            <Field label="Saison">
              <Input value={draft.season} maxLength={20} placeholder="2026-27" onChange={(event) => setDraft({ ...draft, season: event.target.value })} />
            </Field>
            <div className="col-span-2 flex items-end gap-1 sm:col-span-3">
              {[
                { value: true, label: "Heim" },
                { value: false, label: "Auswärts" },
              ].map((option) => (
                <Button
                  key={option.label}
                  type="button"
                  className="h-9 flex-1 sm:flex-none"
                  variant={draft.home === option.value ? "default" : "outline"}
                  onClick={() => setDraft({ ...draft, home: draft.home === option.value ? null : option.value })}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <ul className="space-y-3">
            {draft.lines.map((line, index) => (
              <PlayerRow
                key={index}
                line={line}
                draft={draft}
                nickname={displayName(line.name, settings.nicknames)}
                note={sheetNotes[line.name]}
                onChange={(patch) => setLine(index, patch)}
                onRemove={() => setDraft({ ...draft, lines: draft.lines.filter((_, i) => i !== index) })}
              />
            ))}
          </ul>
          <Button type="button" variant="outline" onClick={() => setDraft({ ...draft, lines: [...draft.lines, emptyLine()] })}>
            <PlusIcon /> Spieler hinzufügen
          </Button>
        </CardContent>
      </Card>

      {hasLines && (
        <Card>
          <CardHeader>
            <CardTitle>4. Kasse</CardTitle>
            <CardDescription>
              Mit den Beträgen aus den Einstellungen{draft.id ? " (wie beim Anlegen des Spiels)" : ""}; unter {draft.threshold} Kegel
              kostet extra.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FeeTable lines={draft.lines} rates={draft.rates} threshold={draft.threshold} nicknames={settings.nicknames} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={saving || busy !== null}>
                {saving && <Loader2Icon className="animate-spin" />} Speichern
              </Button>
              <Button variant="ghost" onClick={() => navigate(draft.id ? `${PATH}?view=game&id=${draft.id}` : PATH)}>
                Abbrechen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <Label className={`flex flex-col items-stretch gap-1.5 text-xs text-muted-foreground ${className ?? ""}`}>
      {label}
      {children}
    </Label>
  );
}

function UploadButtons({
  onFiles,
  busy,
  disabled,
  busyText,
  multiple = false,
  again = false,
}: {
  onFiles: (files: File[]) => void;
  busy: boolean;
  disabled: boolean;
  busyText: string;
  multiple?: boolean;
  again?: boolean;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const pdf = useRef<HTMLInputElement>(null);
  const take = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) onFiles(files);
  };
  if (busy) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" /> {busyText}
      </p>
    );
  }
  // Three inputs, because a picker that takes images and PDFs at once opens
  // the file manager on Android instead of the gallery.
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={take} />
      <input ref={gallery} type="file" accept="image/*" multiple={multiple} className="hidden" onChange={take} />
      <input ref={pdf} type="file" accept="application/pdf" multiple={multiple} className="hidden" onChange={take} />
      <Button size="lg" variant={again ? "outline" : "default"} disabled={disabled} onClick={() => camera.current?.click()}>
        <CameraIcon /> {again ? "Neu fotografieren" : "Foto aufnehmen"}
      </Button>
      <Button size="lg" variant="outline" disabled={disabled} onClick={() => gallery.current?.click()}>
        <ImageIcon /> Aus der Galerie
      </Button>
      <Button size="lg" variant="outline" disabled={disabled} onClick={() => pdf.current?.click()}>
        <FileUpIcon /> PDF wählen
      </Button>
    </div>
  );
}

const mpOptions = [
  { value: 1, label: "gewonnen" },
  { value: 0.5, label: "unentsch." },
  { value: 0, label: "verloren" },
] as const;

function PlayerRow({
  line,
  draft,
  nickname,
  note,
  onChange,
  onRemove,
}: {
  line: Line;
  draft: Draft;
  nickname: string;
  note?: SheetNote;
  onChange: (patch: Partial<Line>) => void;
  onRemove: () => void;
}) {
  const fees = feesOf(line, draft.rates, draft.threshold);
  const count = (value: string) => Math.max(0, Math.min(99, Math.round(Number(value) || 0)));
  return (
    <li className="space-y-3 rounded-lg border p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
        <Input
          value={line.name}
          maxLength={80}
          placeholder="Nachname, Vorname"
          aria-label="Name"
          className="h-9 font-medium"
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <Button type="button" size="icon" variant="ghost" aria-label="Spieler entfernen" onClick={onRemove}>
          <TrashIcon />
        </Button>
      </div>
      {nickname !== line.name && <p className="-mt-2 text-xs text-muted-foreground">In der Tabelle: {nickname}</p>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <SmallNumber label="Fehler" value={line.errors} onChange={(value) => onChange({ errors: count(value) })} />
        <SmallNumber
          label="Kegel"
          value={line.total ?? ""}
          onChange={(value) => onChange({ total: value === "" ? null : Math.max(0, Math.min(1200, Math.round(Number(value) || 0))) })}
        />
        <SmallNumber label="2er" value={line.twos} onChange={(value) => onChange({ twos: count(value) })} />
        <SmallNumber label="Goldene" value={line.golden} onChange={(value) => onChange({ golden: count(value) })} />
        <Label className="col-span-2 flex flex-col items-stretch gap-1 text-xs text-muted-foreground">
          Punkt
          <select
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground shadow-xs dark:bg-input/30"
            value={line.mp === null ? "" : String(line.mp)}
            onChange={(event) => onChange({ mp: event.target.value === "" ? null : Number(event.target.value) })}
          >
            <option value="">unbekannt</option>
            {mpOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Label>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox checked={line.started} onCheckedChange={(checked) => onChange({ started: checked === true })} /> gespielt
          (Startgebühr)
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={line.mass} onCheckedChange={(checked) => onChange({ mass: checked === true })} /> Maß
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={line.half} onCheckedChange={(checked) => onChange({ half: checked === true })} /> ausgewechselt (halbe
          Kosten)
        </label>
        <span className="ml-auto font-semibold whitespace-nowrap tabular-nums">{formatEuro(fees.sum)}</span>
      </div>
      {line.sheet && note && (
        <p className="text-xs text-muted-foreground">
          Wurfschein: {note.twoAt.length > 0 ? `2er in ${note.twoAt.join("; ")}` : "keine 2er"}
          {" · "}
          {note.goldenAt.length > 0 ? `Goldener in ${note.goldenAt.join("; ")}` : "kein Goldener"}
          {note.warnings.length > 0 && <span className="block text-amber-700 dark:text-amber-400">{note.warnings.join(" ")}</span>}
        </p>
      )}
      {line.sheet && !note && <p className="text-xs text-muted-foreground">2er und Goldene aus dem Wurfschein.</p>}
    </li>
  );
}

function SmallNumber({ label, value, onChange }: { label: string; value: number | ""; onChange: (value: string) => void }) {
  return (
    <Label className="flex flex-col items-stretch gap-1 text-xs text-muted-foreground">
      {label}
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        className="h-9 text-foreground tabular-nums"
        onChange={(event) => onChange(event.target.value)}
      />
    </Label>
  );
}
