"use client";

import { CameraIcon, CheckIcon, ImageIcon, Loader2Icon, PencilIcon, RotateCcwIcon, SearchIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { sortThing } from "./actions";
import { BinIcon } from "./bin-icon";
import { confidenceLabel, type EffectiveBin, type Verdict } from "./bins";
import { useRefresh } from "./hooks";
import { preparePhoto, type PreparedPhoto } from "./image";

type Answer = { scanId: string; verdict: Verdict };

// Take a photo (or pick one, or describe the thing), the AI says where it
// goes. Its description comes first, so the user can check it looked at the
// right thing, and correct it if not.
export function Sorter({ placeId, bins }: { placeId: string; bins: EffectiveBin[] }) {
  const refresh = useRefresh();
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Free the preview when the photo changes or the sorter goes away.
  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.previewUrl);
  }, [photo]);

  function run(input: { photo: PreparedPhoto | null; text: string; correction?: string; previous?: Answer }) {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("placeId", placeId);
      data.set("text", input.text);
      if (input.photo) data.set("photo", input.photo.photo, "photo.jpg");
      if (input.correction && input.previous) {
        data.set("correction", input.correction);
        data.set("previous", input.previous.verdict.description);
        data.set("scanId", input.previous.scanId);
      } else if (input.photo?.thumb) {
        data.set("thumb", input.photo.thumb, input.photo.thumb.type === "image/webp" ? "thumb.webp" : "thumb.jpg");
      }
      const result = await sortThing(data).catch(() => ({ error: "Die Erkennung hat nicht geklappt. Bitte noch einmal versuchen." }));
      if (result.error !== undefined) {
        setError(result.error);
        return;
      }
      setAnswer(result);
      void refresh();
    });
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setAnswer(null);
    try {
      const prepared = await preparePhoto(file);
      setPhoto(prepared);
      run({ photo: prepared, text });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Das Foto konnte nicht gelesen werden.");
    }
  }

  function reset() {
    setPhoto(null);
    setAnswer(null);
    setText("");
    setError(null);
  }

  const fileInputs = (
    <>
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          void pickFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void pickFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </>
  );

  // The inputs stay mounted while the view switches ("Nächstes Foto" opens
  // the camera right after going back to the start).
  return (
    <>
      {fileInputs}
      {!photo && !answer && !pending ? renderStart() : renderOutcome()}
    </>
  );

  // --- Start: photo or text ---
  function renderStart() {
    return (
      <section aria-label="Gegenstand sortieren" className="space-y-3">
        <Button size="lg" className="h-16 w-full text-base" onClick={() => cameraInput.current?.click()}>
          <CameraIcon className="size-5" /> Foto aufnehmen
        </Button>
        <Button variant="outline" className="h-11 w-full" onClick={() => galleryInput.current?.click()}>
          <ImageIcon /> Aus der Galerie
        </Button>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim()) run({ photo: null, text: text.trim() });
          }}
        >
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={500}
            placeholder="Oder beschreiben, z. B. fettiger Pizzakarton"
            aria-label="Gegenstand beschreiben"
            enterKeyHint="search"
            className="h-11"
          />
          <Button type="submit" variant="outline" size="icon" className="size-11 shrink-0" disabled={!text.trim()} aria-label="Prüfen">
            <SearchIcon />
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>
    );
  }

  function renderOutcome() {
    return (
    <section aria-label="Ergebnis" aria-busy={pending} className="space-y-4">
      <div className="flex gap-3">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob URL
          <img src={photo.previewUrl} alt="Dein Foto" className="size-28 shrink-0 rounded-xl border object-cover" />
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          {pending ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2Icon className="size-4 animate-spin" /> Die KI schaut sich das an …
            </p>
          ) : answer ? (
            <Description answer={answer} />
          ) : (
            <p className="text-sm text-muted-foreground">{text}</p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {answer && !pending && (
        <>
          <Correction
            key={answer.verdict.description}
            onCorrect={(correction) => run({ photo, text, correction, previous: answer })}
          />
          <Result verdict={answer.verdict} bins={bins} />
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button className="h-11 flex-1" onClick={() => { reset(); cameraInput.current?.click(); }} disabled={pending}>
          <CameraIcon /> Nächstes Foto
        </Button>
        {photo && (
          <Button variant="outline" className="h-11" onClick={() => cameraInput.current?.click()} disabled={pending}>
            <RotateCcwIcon /> Foto wiederholen
          </Button>
        )}
        <Button variant="ghost" className="h-11" onClick={reset} disabled={pending}>
          Fertig
        </Button>
      </div>
    </section>
    );
  }
}

function Description({ answer: { verdict } }: { answer: Answer }) {
  return (
    <>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Die KI erkennt</p>
      <p className="font-semibold">{verdict.item}</p>
      {verdict.description && <p className="text-sm text-muted-foreground">{verdict.description}</p>}
      <Badge
        variant="outline"
        className={cn(
          verdict.confidence === "sicher" && "border-green-600/40 text-green-700 dark:text-green-400",
          verdict.confidence === "wahrscheinlich" && "border-amber-500/50 text-amber-700 dark:text-amber-400",
          verdict.confidence === "unsicher" && "border-destructive/50 text-destructive",
        )}
      >
        {confidenceLabel[verdict.confidence]}
      </Badge>
    </>
  );
}

// "Stimmt das?" Yes hides the question, no lets the user say what it is.
function Correction({ onCorrect }: { onCorrect: (correction: string) => void }) {
  const [state, setState] = useState<"ask" | "ok" | "edit">("ask");
  const [value, setValue] = useState("");
  if (state === "ok") return null;
  if (state === "ask") {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
        <span className="flex-1 text-sm">Hat die KI das richtig erkannt?</span>
        <Button size="sm" variant="outline" onClick={() => setState("ok")}>
          <CheckIcon /> Ja
        </Button>
        <Button size="sm" variant="outline" onClick={() => setState("edit")}>
          <PencilIcon /> Nein
        </Button>
      </div>
    );
  }
  return (
    <form
      className="space-y-2 rounded-xl border bg-muted/40 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim()) onCorrect(value.trim());
      }}
    >
      <label htmlFor="waste-correction" className="text-sm font-medium">
        Was ist es wirklich?
      </label>
      <Textarea
        id="waste-correction"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={500}
        rows={2}
        autoFocus
        placeholder="z. B. Das ist ein Tetrapak, kein Karton"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!value.trim()}>
          Neu prüfen
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setState("ask")}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

function Result({ verdict, bins }: { verdict: Verdict; bins: EffectiveBin[] }) {
  const binOf = (id: string) => bins.find((bin) => bin.id === id) ?? bins[0];
  const main = binOf(verdict.bin);

  if (!verdict.recognized) {
    return (
      <Alert>
        <TriangleAlertIcon />
        <AlertTitle>Nichts erkannt</AlertTitle>
        <AlertDescription>
          {verdict.check || "Bitte ein schärferes Foto machen oder den Gegenstand beschreiben."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {verdict.hazard && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Achtung: nicht in den Hausmüll</AlertTitle>
          <AlertDescription>{verdict.hazardNote || "Das gehört zum Wertstoffhof, Schadstoffmobil oder zurück in den Handel."}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-4 rounded-2xl border-2 p-4" style={{ borderColor: main.color }}>
        <BinIcon color={main.color} container={main.container} className="size-20" />
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{verdict.parts.length > 1 ? "Hauptsächlich in" : "Gehört in"}</p>
          <p className="text-2xl leading-tight font-semibold">{main.name}</p>
          {main.note && <p className="mt-1 text-sm text-muted-foreground">{main.note}</p>}
        </div>
      </div>

      {verdict.parts.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="px-1 text-sm font-medium text-muted-foreground">Trennen</h3>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {verdict.parts.map((part, index) => {
              const bin = binOf(part.bin);
              return (
                <li key={index} className="flex items-center gap-3 px-3 py-2">
                  <BinIcon color={bin.color} container={bin.container} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p>
                      {part.part} → <span className="font-medium">{bin.name}</span>
                    </p>
                    {part.hint && <p className="text-sm text-muted-foreground">{part.hint}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {verdict.check && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Bitte prüfen</AlertTitle>
          <AlertDescription>{verdict.check}</AlertDescription>
        </Alert>
      )}

      {verdict.tips.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
          {verdict.tips.map((tip, index) => (
            <li key={index}>{tip}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
