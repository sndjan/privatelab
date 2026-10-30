"use client";

import { ChevronRightIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { importExercises, inventExercisesWithAi } from "./actions";
import { Court } from "./court";
import { aiPrompt, parseExercises, phaseName, playersLabel, type ExerciseInput } from "./data";
import { useTennis } from "./use-tennis";

// New exercises from Claude: describe what you need, look at what it wrote
// (with sketch and variations), keep the ones you like. It follows the
// principles. Without an API key (or for any other chat) the prompt can be
// copied and the answer pasted back.
export function AiImport({ existing }: { existing: string[] }) {
  const [principles] = useTennis("principles");
  const [open, setOpen] = useState(false);
  const [wish, setWish] = useState("");
  const [suggested, setSuggested] = useState<ExerciseInput[]>([]);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<number | null>(null);
  const [asking, startAsking] = useTransition();
  const [saving, startSaving] = useTransition();
  const pasted = answer.trim() ? parseExercises(answer) : null;
  // Pasted answers replace the suggestions while there are any.
  const list = pasted && pasted.exercises.length > 0 ? pasted.exercises : suggested;
  const keep = pasted && pasted.exercises.length > 0 ? list : list.filter((_, index) => chosen.has(index));

  function ask() {
    setError(null);
    setAdded(null);
    startAsking(async () => {
      try {
        const result = await inventExercisesWithAi(wish);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setSuggested(result.exercises);
        setChosen(new Set(result.exercises.map((_, index) => index)));
      } catch {
        setError("Keine Verbindung zum Server. Versuch es bitte noch einmal.");
      }
    });
  }

  function save() {
    if (keep.length === 0) return;
    startSaving(async () => {
      const count = await importExercises(keep);
      setAdded(count);
      setAnswer("");
      setSuggested([]);
      setChosen(new Set());
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setAdded(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <SparklesIcon /> Mit KI erstellen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Übungen mit KI erstellen</DialogTitle>
          <DialogDescription>
            Claude erfindet Übungen mit Skizze und Variationen und hält sich an deine Grundsätze. Du wählst aus, was in die
            Sammlung kommt.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!asking) ask();
          }}
          className="space-y-2"
        >
          <Label htmlFor="ai-wish">Was brauchst du?</Label>
          <Textarea
            id="ai-wish"
            rows={2}
            value={wish}
            onChange={(event) => setWish(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                if (!asking) ask();
              }
            }}
            placeholder="z. B. 4 Volley-Spiele für 6 Kinder, 8–10 Jahre, Midcourt, mit viel Bewegung"
          />
          <Button type="submit" disabled={asking || !wish.trim()}>
            {asking ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
            {asking ? "Claude denkt nach …" : "Übungen erfinden"}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>

        {list.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {list.map((exercise, index) => {
              const selected = pasted && pasted.exercises.length > 0 ? true : chosen.has(index);
              return (
                <li key={index}>
                  <label
                    className={cn(
                      "flex h-full cursor-pointer flex-col gap-1.5 rounded-lg border p-2 transition-colors",
                      selected ? "border-brand bg-good/40" : "opacity-60",
                    )}
                  >
                    <span className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={Boolean(pasted && pasted.exercises.length > 0)}
                        onChange={() => {
                          const next = new Set(chosen);
                          if (next.has(index)) next.delete(index);
                          else next.add(index);
                          setChosen(next);
                        }}
                        className="mt-1 accent-brand"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-tight font-medium">{exercise.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {[phaseName(exercise.phase), `${exercise.minutes} Min.`, playersLabel(exercise)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </span>
                    <Court diagram={exercise.diagram} horizontal className="w-full" />
                    {exercise.summary && <span className="text-xs">{exercise.summary}</span>}
                    {exercise.variations.harder && (
                      <span className="text-xs text-muted-foreground">Schwerer: {exercise.variations.harder}</span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {added !== null && (
          <p role="status" className="text-sm text-brand">
            {added === 1 ? "1 Übung" : `${added} Übungen`} in die Sammlung aufgenommen.
          </p>
        )}

        <details className="group text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-muted-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
            Ohne KI-Schlüssel: mit einem anderen Chat
          </summary>
          <div className="mt-2 space-y-2">
            <p className="text-muted-foreground">
              Prompt kopieren (er nimmt deinen Wunsch von oben), in Claude oder ChatGPT einfügen und die Antwort hier einfügen.
            </p>
            <CopyButton text={aiPrompt(wish, existing, principles)} label="Prompt kopieren" />
            <Label htmlFor="ai-answer" className="sr-only">
              Antwort der KI
            </Label>
            <Textarea
              id="ai-answer"
              rows={3}
              value={answer}
              onChange={(event) => {
                setAnswer(event.target.value);
                setAdded(null);
              }}
              placeholder='[{ "name": "…", "phase": "game", … }]'
              className="max-h-40 font-mono text-xs"
            />
            {pasted?.error && <p className="text-destructive">{pasted.error}</p>}
          </div>
        </details>

        <DialogFooter>
          <Button onClick={save} disabled={saving || keep.length === 0}>
            {saving && <Loader2Icon className="animate-spin" />}
            {keep.length > 1 ? `${keep.length} Übungen aufnehmen` : "Aufnehmen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
