"use client";

import { ChevronLeftIcon } from "lucide-react";
import { ViewLink as Link } from "@/lib/query/view-link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveExercise } from "./actions";
import { focusTags, phases, type Diagram, type ExerciseInput, type Phase } from "./data";
import { DiagramEditor } from "./diagram-editor";

const PATH = "/m/tennis";

// Creates an exercise (no id) or edits one.
export function ExerciseForm({ id, initial }: { id: string | null; initial: ExerciseInput }) {
  const [name, setName] = useState(initial.name);
  const [phase, setPhase] = useState<Phase>(initial.phase);
  const [minutes, setMinutes] = useState(String(initial.minutes));
  const [summary, setSummary] = useState(initial.summary);
  const [description, setDescription] = useState(initial.description);
  const [tips, setTips] = useState(initial.tips.join("\n"));
  const [focus, setFocus] = useState(initial.focus);
  const [diagram, setDiagram] = useState<Diagram>(initial.diagram);
  const [playersMin, setPlayersMin] = useState(initial.playersMin === null ? "" : String(initial.playersMin));
  const [playersMax, setPlayersMax] = useState(initial.playersMax === null ? "" : String(initial.playersMax));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveExercise(id, {
          name,
          phase,
          minutes: Number(minutes) || 10,
          summary,
          description,
          tips: tips.split("\n"),
          focus,
          diagram,
          playersMin: playersMin ? Number(playersMin) : null,
          playersMax: playersMax ? Number(playersMax) : null,
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Speichern fehlgeschlagen.");
      }
    });
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-2xl space-y-4">
      <div className="-ml-2 flex items-center gap-1">
        <Button asChild variant="ghost" size="icon" className="size-10 text-muted-foreground">
          <Link href={id ? `${PATH}?exercise=${id}` : `${PATH}?exercises=1`} aria-label="Zurück">
            <ChevronLeftIcon className="size-5" />
          </Link>
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">
          {id ? "Übung bearbeiten" : "Neue Übung"}
        </h2>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="exercise-name">Name</Label>
            <Input
              id="exercise-name"
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="z. B. Vorhand-Zielschießen"
            />
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Teil der Stunde</span>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {phases.map((entry) => (
                <Chip key={entry.id} active={phase === entry.id} onClick={() => setPhase(entry.id)}>
                  {entry.name}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="exercise-minutes">Dauer (Min.)</Label>
              <Input
                id="exercise-minutes"
                type="number"
                min={5}
                max={60}
                step={5}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exercise-players-min">Ab Kindern</Label>
              <Input
                id="exercise-players-min"
                type="number"
                min={1}
                max={30}
                value={playersMin}
                onChange={(event) => setPlayersMin(event.target.value)}
                placeholder="egal"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exercise-players-max">Bis Kinder</Label>
              <Input
                id="exercise-players-max"
                type="number"
                min={1}
                max={30}
                value={playersMax}
                onChange={(event) => setPlayersMax(event.target.value)}
                placeholder="egal"
                className="font-mono"
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Für wie viele Kinder die Übung klappt. Beim Umplanen nach Absagen fliegt raus, was nicht mehr passt.
          </p>

          <div className="space-y-2">
            <Label htmlFor="exercise-summary">In einem Satz</Label>
            <Input
              id="exercise-summary"
              maxLength={200}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Worum geht es?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exercise-description">Ablauf</Label>
            <Textarea
              id="exercise-description"
              maxLength={2000}
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Aufbau, Regeln, Punkte, Wechsel"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exercise-tips">Zum Zurufen (ein Tipp pro Zeile)</Label>
            <Textarea
              id="exercise-tips"
              rows={3}
              value={tips}
              onChange={(event) => setTips(event.target.value)}
              placeholder={"Früh ausholen!\nTreffpunkt vor dem Körper"}
            />
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Schwerpunkt</span>
            <div className="flex flex-wrap gap-1.5">
              {focusTags.map((tag) => (
                <Chip
                  key={tag}
                  active={focus.includes(tag)}
                  onClick={() => setFocus(focus.includes(tag) ? focus.filter((entry) => entry !== tag) : [...focus, tag])}
                >
                  {tag}
                </Chip>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skizze</CardTitle>
        </CardHeader>
        <CardContent>
          <DiagramEditor value={diagram} onChange={setDiagram} />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] flex justify-end">
        <Button type="submit" size="lg" disabled={pending || !name.trim()} className="shadow-lg">
          {pending && <Loader2Icon className="animate-spin" />}
          Speichern
        </Button>
      </div>
    </form>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 cursor-pointer rounded-full border px-3 text-sm transition-colors",
        active ? "border-brand bg-good text-good-foreground" : "bg-card text-muted-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
