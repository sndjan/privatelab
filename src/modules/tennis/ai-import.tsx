"use client";

import { Loader2Icon, SparklesIcon } from "lucide-react";
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
import { importExercises } from "./actions";
import { Court } from "./court";
import { aiPrompt, parseExercises, phaseName } from "./data";

// New exercises from any AI chat, without an API key: copy a prompt that
// explains the JSON and court format, paste the answer back, import.
export function AiImport({ existing }: { existing: string[] }) {
  const [open, setOpen] = useState(false);
  const [wish, setWish] = useState("");
  const [answer, setAnswer] = useState("");
  const [added, setAdded] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const parsed = answer.trim() ? parseExercises(answer) : null;

  function save() {
    if (!parsed || parsed.exercises.length === 0) return;
    startTransition(async () => {
      const count = await importExercises(parsed.exercises);
      setAdded(count);
      setAnswer("");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Übungen mit KI erstellen</DialogTitle>
          <DialogDescription>
            Kostenlos mit Claude oder ChatGPT: Prompt kopieren, im Chat einfügen, die Antwort hier einfügen. Die KI zeichnet
            die Skizze gleich mit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="ai-wish">1. Was brauchst du?</Label>
          <Textarea
            id="ai-wish"
            rows={2}
            value={wish}
            onChange={(event) => setWish(event.target.value)}
            placeholder="z. B. 5 Volley-Spiele für 6 Kinder, 8–10 Jahre, mit viel Bewegung"
          />
          <CopyButton text={aiPrompt(wish, existing)} label="Prompt kopieren" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-answer">2. Antwort der KI einfügen</Label>
          <Textarea
            id="ai-answer"
            rows={4}
            value={answer}
            onChange={(event) => {
              setAnswer(event.target.value);
              setAdded(null);
            }}
            placeholder='[{ "name": "…", "phase": "game", … }]'
            className="max-h-40 font-mono text-xs"
          />
          {parsed?.error && <p className="text-sm text-destructive">{parsed.error}</p>}
          {added !== null && (
            <p role="status" className="text-sm text-brand">
              {added === 1 ? "1 Übung" : `${added} Übungen`} hinzugefügt.
            </p>
          )}
        </div>

        {parsed && parsed.exercises.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {parsed.exercises.map((exercise, index) => (
              <li key={index} className="space-y-1">
                <Court diagram={exercise.diagram} className="w-full" />
                <p className="text-xs leading-tight font-medium">{exercise.name}</p>
                <p className="text-xs text-muted-foreground">{phaseName(exercise.phase)}</p>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button onClick={save} disabled={pending || !parsed || parsed.exercises.length === 0}>
            {pending && <Loader2Icon className="animate-spin" />}
            {parsed && parsed.exercises.length > 1 ? `${parsed.exercises.length} Übungen importieren` : "Importieren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
