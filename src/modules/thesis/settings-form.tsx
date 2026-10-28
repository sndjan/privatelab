"use client";

import { PencilIcon } from "lucide-react";
import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveSettings } from "./actions";
import type { Settings } from "./data";
import { closingAfter, Field } from "./fields";

function SettingsFields({ settings }: { settings: Settings }) {
  return (
    <>
      <Field id="settings-title" label="Arbeitstitel">
        <Input id="settings-title" name="title" maxLength={300} defaultValue={settings.title} />
      </Field>
      <Field id="settings-question" label="Forschungsfrage(n)">
        <Textarea id="settings-question" name="researchQuestion" rows={3} maxLength={2000} defaultValue={settings.researchQuestion} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="settings-supervisors" label="Betreuer:innen">
          <Input id="settings-supervisors" name="supervisors" maxLength={300} defaultValue={settings.supervisors} />
        </Field>
        <Field id="settings-university" label="Hochschule">
          <Input id="settings-university" name="university" maxLength={200} defaultValue={settings.university} />
        </Field>
        <Field id="settings-company" label="Firma">
          <Input id="settings-company" name="company" maxLength={200} defaultValue={settings.company} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="settings-start" label="Beginn">
          <Input id="settings-start" type="date" name="startDate" required defaultValue={settings.startDate ?? ""} />
        </Field>
        <Field id="settings-end" label="Abgabe">
          <Input id="settings-end" type="date" name="endDate" required defaultValue={settings.endDate ?? ""} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="settings-pages" label="Umfang (Seiten)" hint="Vorgabe ohne Verzeichnisse und Anhang, für die Fortschrittsschätzung.">
          <Input
            id="settings-pages"
            type="number"
            name="targetPages"
            min={1}
            max={1000}
            inputMode="numeric"
            defaultValue={settings.targetPages ?? ""}
            placeholder="z. B. 50"
            className="font-mono"
          />
        </Field>
        <Field id="settings-words-per-page" label="Wörter pro Seite" hint="Etwa 300 bei 12 pt und 1,5-zeilig; Bilder zählen als halbe Seite.">
          <Input
            id="settings-words-per-page"
            type="number"
            name="wordsPerPage"
            min={50}
            max={1000}
            inputMode="numeric"
            defaultValue={settings.wordsPerPage}
            className="font-mono"
          />
        </Field>
      </div>
    </>
  );
}

// First start: the form right on the page.
export function SettingsForm({ settings }: { settings: Settings }) {
  return (
    <form action={saveSettings} className="space-y-4">
      <SettingsFields settings={settings} />
      <SubmitButton variant="brand" size="lg">
        Speichern
      </SubmitButton>
    </form>
  );
}

export function SettingsDialog({ settings }: { settings: Settings }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Thema und Zeitraum bearbeiten" className="text-muted-foreground">
          <PencilIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form action={closingAfter(saveSettings, () => setOpen(false))} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Thema & Zeitraum</DialogTitle>
          </DialogHeader>
          <SettingsFields settings={settings} />
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Abbrechen
              </Button>
            </DialogClose>
            <SubmitButton>Speichern</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
