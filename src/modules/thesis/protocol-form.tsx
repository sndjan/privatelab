"use client";

import { ViewLink as Link } from "@/lib/query/view-link";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteProtocol, saveProtocol } from "./actions";
import type { Person, Protocol, ThesisEvent } from "./data";
import { Field } from "./fields";
import { PeoplePicker } from "./people-picker";

const PATH = "/m/thesis";

// A new protocol can start from an appointment: its date, title and people
// are filled in, and the appointment is linked to the protocol.
export function ProtocolForm({
  protocol,
  people,
  event,
  today,
}: {
  protocol: Protocol | null;
  people: Person[];
  event?: ThesisEvent | null;
  today: string;
}) {
  const back = protocol ? `${PATH}?tab=protocols&protocol=${protocol.id}` : event ? `${PATH}?tab=events` : `${PATH}?tab=protocols`;

  return (
    <form action={saveProtocol} className="space-y-4">
      {protocol && <input type="hidden" name="protocolId" value={protocol.id} />}
      {!protocol && event && <input type="hidden" name="eventId" value={event.id} />}
      <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field id="protocol-date" label="Datum">
          <Input id="protocol-date" type="date" name="date" required defaultValue={protocol?.date ?? event?.date ?? today} />
        </Field>
        <Field id="protocol-title" label="Titel">
          <Input
            id="protocol-title"
            name="title"
            required
            maxLength={120}
            defaultValue={protocol?.title ?? event?.title ?? ""}
            placeholder="z. B. Kick-off mit Betreuer"
          />
        </Field>
      </div>
      <Field id="protocol-people" label="Teilnehmende">
        <PeoplePicker id="protocol-people" people={people} defaultIds={protocol?.personIds ?? event?.personIds ?? []} />
      </Field>
      {/* Free text from before people existed; shown until it is emptied. */}
      {protocol?.participants && (
        <Field id="protocol-participants" label="Weitere Teilnehmende (Text)">
          <Input id="protocol-participants" name="participants" maxLength={300} defaultValue={protocol.participants} />
        </Field>
      )}
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
