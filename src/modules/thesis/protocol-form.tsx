"use client";

import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteProtocol, saveProtocol } from "./actions";
import type { Protocol } from "./data";
import { Field } from "./fields";

const PATH = "/m/thesis";

export function ProtocolForm({ protocol, today }: { protocol: Protocol | null; today: string }) {
  const back = protocol ? `${PATH}?tab=protocols&protocol=${protocol.id}` : `${PATH}?tab=protocols`;

  return (
    <form action={saveProtocol} className="space-y-4">
      {protocol && <input type="hidden" name="protocolId" value={protocol.id} />}
      <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field id="protocol-date" label="Datum">
          <Input id="protocol-date" type="date" name="date" required defaultValue={protocol?.date ?? today} />
        </Field>
        <Field id="protocol-title" label="Titel">
          <Input
            id="protocol-title"
            name="title"
            required
            maxLength={120}
            defaultValue={protocol?.title ?? ""}
            placeholder="z. B. Kick-off mit Betreuer"
          />
        </Field>
      </div>
      <Field id="protocol-participants" label="Teilnehmende">
        <Input id="protocol-participants" name="participants" maxLength={300} defaultValue={protocol?.participants ?? ""} />
      </Field>
      <Field
        id="protocol-body"
        label="Protokoll"
        hint="Markdown: # Überschrift, - Liste, **fett**, *kursiv*, [Link](https://…), - [ ] Aufgabe"
      >
        <Textarea
          id="protocol-body"
          name="body"
          rows={16}
          maxLength={50000}
          defaultValue={protocol?.body ?? ""}
          className="font-mono text-[13px]"
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="brand">{protocol ? "Speichern" : "Anlegen"}</SubmitButton>
        <Button asChild variant="ghost">
          <Link href={back}>Abbrechen</Link>
        </Button>
        {protocol && (
          <SubmitButton
            variant="ghost"
            formAction={deleteProtocol}
            formNoValidate
            onClick={(event) => {
              if (!window.confirm(`Protokoll „${protocol.title}“ löschen? Seine To-dos bleiben erhalten.`)) event.preventDefault();
            }}
            className="ml-auto text-destructive hover:text-destructive"
          >
            Löschen
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
