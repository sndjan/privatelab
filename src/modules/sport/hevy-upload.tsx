"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2Icon, UploadIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pushRoutinesToHevy } from "./actions";
import { routineUploads, type RoutinePreview } from "./hevy-routines";
import { useSportData } from "./store";

// Writes routine days A/B/C as Hevy routines "Ganzkörper A/B/C": first a
// preview (which template each exercise gets, new or replaced), then the upload.
export function HevyUpload() {
  const data = useSportData();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<RoutinePreview[] | null>(null);
  const [done, setDone] = useState<RoutinePreview[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(dry: boolean) {
    setBusy(true);
    setError(null);
    try {
      const result = await pushRoutinesToHevy(routineUploads(data.exercises), dry);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (dry) {
        setPreview(result.routines);
        return;
      }
      setDone(result.routines);
      const failed = result.routines.filter((routine) => routine.error);
      if (failed.length) toast.error(`${failed.length} von ${result.routines.length} Routinen nicht übertragen.`);
      else toast.success("Routinen in Hevy gespeichert.");
      void queryClient.invalidateQueries({ queryKey: ["sport"] });
    } catch {
      setError("Keine Verbindung zum Server.");
    } finally {
      setBusy(false);
    }
  }

  function openDialog() {
    setOpen(true);
    setPreview(null);
    setDone(null);
    void run(true);
  }

  const shown = done ?? preview;

  return (
    <>
      <Button variant="outline" size="sm" onClick={openDialog}>
        <UploadIcon aria-hidden="true" />
        Nach Hevy übertragen
      </Button>
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Routine nach Hevy</DialogTitle>
            <DialogDescription>
              Tag A, B und C werden in Hevy zu „Ganzkörper A/B/C“: erst das Aufwärmen, dann die Übungen mit Sätzen, Wiederholungsbereich, Pausen und dem Startgewicht aus „Nächstes
              Mal“. Gibt es eine Routine mit dem Titel schon, wird sie ersetzt.
            </DialogDescription>
          </DialogHeader>

          {error && <p className="rounded-xl bg-bad px-3 py-2 text-sm text-bad-foreground">{error}</p>}
          {!shown && busy && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
              Übungen werden mit Hevy abgeglichen …
            </p>
          )}

          {shown && (
            <div className="max-h-[55vh] space-y-2 overflow-y-auto">
              {shown.map((routine) => (
                <section key={routine.title} className="rounded-2xl border p-3.5">
                  <h3 className="flex items-baseline justify-between gap-2 text-sm font-semibold">
                    {routine.title}
                    <span
                      className={
                        routine.error
                          ? "rounded-full bg-bad px-2 py-0.5 text-xs font-semibold text-bad-foreground"
                          : done || routine.action !== "update"
                            ? "rounded-full bg-good px-2 py-0.5 text-xs font-semibold text-good-foreground"
                            : "rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
                      }
                    >
                      {done ? (routine.error ? "fehlgeschlagen" : routine.action === "update" ? "ersetzt" : "angelegt") : routine.action === "update" ? "wird ersetzt" : "neu"}
                    </span>
                  </h3>
                  {routine.error && <p className="mt-1 text-xs text-bad-foreground">{routine.error}</p>}
                  <ul className="mt-2 space-y-1 text-xs">
                    {routine.exercises.map((exercise) => (
                      <li key={exercise.name} className="flex justify-between gap-2">
                        <span className="min-w-0">{exercise.name}</span>
                        {exercise.templateTitle && exercise.templateTitle !== exercise.name && (
                          <span className="min-w-0 text-right text-muted-foreground">→ {exercise.templateTitle}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {routine.missing.length > 0 && (
                    <p className="mt-1.5 text-xs text-bad-foreground">
                      Nicht in Hevy gefunden, fehlt in der Routine: {routine.missing.join(", ")}. In Hevy von Hand ergänzen.
                    </p>
                  )}
                </section>
              ))}
              <p className="text-xs text-muted-foreground">
                Den Wiederholungsbereich zeigt die Hevy-App womöglich nicht an; er steht deshalb auch in der Notiz jeder Übung.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {done ? "Schließen" : "Abbrechen"}
            </Button>
            {!done && (
              <Button onClick={() => run(false)} disabled={busy || !preview}>
                {busy && preview && <Loader2Icon className="animate-spin" aria-hidden="true" />}
                Übertragen
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
