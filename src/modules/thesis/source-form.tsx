"use client";

import Link from "next/link";
import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { deleteSource, saveSource } from "./actions";
import { apa, sourceKinds, sourceStatuses, suggestCitationKey, type Source, type SourceField, type SourceKind } from "./cite";
import { Field } from "./fields";

const PATH = "/m/thesis";

type Props = { source: Source | null; today: string };

const lines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const number = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value) : null);

// New or existing source. The fields follow the kind, and the APA reference
// below shows what will be copied.
export function SourceForm({ source, today }: Props) {
  const [values, setValues] = useState({
    kind: source?.kind ?? ("web" as SourceKind),
    authors: source?.authors.join("\n") ?? "",
    editors: source?.editors.join("\n") ?? "",
    year: source?.year?.toString() ?? "",
    month: source?.month?.toString() ?? "",
    day: source?.day?.toString() ?? "",
    title: source?.title ?? "",
    container: source?.container ?? "",
    volume: source?.volume ?? "",
    issue: source?.issue ?? "",
    pages: source?.pages ?? "",
    edition: source?.edition ?? "",
    version: source?.version ?? "",
    publisher: source?.publisher ?? "",
    doi: source?.doi ?? "",
    url: source?.url ?? "",
    accessed: source ? (source.accessed ?? "") : today,
  });
  const spec = sourceKinds.find((entry) => entry.value === values.kind)!;
  const has = (field: SourceField) => field in spec.fields;
  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const preview: Source = {
    id: source?.id ?? "",
    kind: values.kind,
    citationKey: "",
    status: "found",
    authors: has("authors") ? lines(values.authors) : [],
    editors: has("editors") ? lines(values.editors) : [],
    year: number(values.year),
    month: has("date") ? number(values.month) : null,
    day: has("date") && values.month ? number(values.day) : null,
    title: values.title || "Titel",
    container: has("container") ? values.container : "",
    volume: has("volume") ? values.volume : "",
    issue: has("issue") ? values.issue : "",
    pages: has("pages") ? values.pages : "",
    edition: has("edition") ? values.edition : "",
    version: has("version") ? values.version : "",
    publisher: has("publisher") ? values.publisher : "",
    doi: has("doi") ? values.doi : "",
    url: has("url") ? values.url : "",
    accessed: has("accessed") && values.accessed ? values.accessed : null,
    notes: "",
  };

  const label = (field: SourceField) => {
    const info = spec.fields[field]!;
    return info.required ? `${info.label} *` : info.label;
  };
  const hint = (field: SourceField) => spec.fields[field]?.hint;
  const required = (field: SourceField) => Boolean(spec.fields[field]?.required);
  const input = (field: Exclude<SourceField, "authors" | "editors" | "date" | "year">, props: React.ComponentProps<typeof Input> = {}) =>
    has(field) && (
      <Field id={`source-${field}`} label={label(field)} hint={hint(field)}>
        <Input
          id={`source-${field}`}
          name={field}
          required={required(field)}
          value={values[field]}
          onChange={set(field)}
          {...props}
        />
      </Field>
    );

  return (
    <form action={saveSource} className="space-y-5">
      {source && <input type="hidden" name="sourceId" value={source.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="source-kind" label="Art">
          <Select
            name="kind"
            value={values.kind}
            onValueChange={(kind) => setValues((current) => ({ ...current, kind: kind as SourceKind }))}
          >
            <SelectTrigger id="source-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sourceKinds.map((kind) => (
                <SelectItem key={kind.value} value={kind.value}>
                  {kind.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="source-status" label="Status">
          <Select name="status" defaultValue={source?.status ?? "found"}>
            <SelectTrigger id="source-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sourceStatuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {has("authors") && (
        <Field
          id="source-authors"
          label={label("authors")}
          hint={`Eine Person pro Zeile als „Nachname, Vorname“, Organisationen ohne Komma (z. B. Mozilla). ${hint("authors") ?? ""}`}
        >
          <Textarea
            id="source-authors"
            name="authors"
            rows={2}
            required={required("authors")}
            value={values.authors}
            onChange={set("authors")}
          />
        </Field>
      )}

      {has("date") ? (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">{spec.fields.date!.label}</legend>
          <div className="grid grid-cols-[6rem_5rem_5rem] gap-2">
            <Input name="year" aria-label="Jahr" placeholder="Jahr" inputMode="numeric" pattern="\d{4}" value={values.year} onChange={set("year")} className="font-mono" />
            <Input name="month" aria-label="Monat" placeholder="Monat" inputMode="numeric" pattern="([1-9]|1[0-2]|0[1-9])" value={values.month} onChange={set("month")} className="font-mono" />
            <Input name="day" aria-label="Tag" placeholder="Tag" inputMode="numeric" pattern="([1-9]|[12]\d|3[01]|0[1-9])" value={values.day} onChange={set("day")} className="font-mono" />
          </div>
          <p className="text-xs text-muted-foreground">{spec.fields.date!.hint}</p>
        </fieldset>
      ) : (
        <div className="w-32">
          <Field id="source-year" label={label("year")} hint={hint("year")}>
            <Input
              id="source-year"
              name="year"
              inputMode="numeric"
              pattern="\d{4}"
              required={required("year")}
              value={values.year}
              onChange={set("year")}
              className="font-mono"
            />
          </Field>
        </div>
      )}

      {input("title", { maxLength: 500 })}

      {has("editors") && (
        <Field id="source-editors" label={label("editors")} hint="Eine Person pro Zeile als „Nachname, Vorname“.">
          <Textarea id="source-editors" name="editors" rows={2} value={values.editors} onChange={set("editors")} />
        </Field>
      )}

      {input("container", { maxLength: 300 })}

      {(has("volume") || has("issue") || has("pages") || has("edition") || has("version")) && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {input("volume", { maxLength: 20 })}
          {input("issue", { maxLength: 20 })}
          {input("edition", { maxLength: 20 })}
          {input("version", { maxLength: 40, className: "font-mono" })}
          {input("pages", { maxLength: 30 })}
        </div>
      )}

      {input("publisher", { maxLength: 200 })}
      {input("doi", { maxLength: 200, placeholder: "10.1000/xyz123", className: "font-mono" })}
      {input("url", { type: "url", maxLength: 2000, placeholder: "https://", className: "font-mono" })}
      {has("accessed") && (
        <div className="w-44">{input("accessed", { type: "date" })}</div>
      )}

      <section aria-label="Vorschau" className="space-y-1.5 rounded-lg bg-muted px-3 py-2.5">
        <h2 className="text-xs text-muted-foreground">APA 7</h2>
        <p className="text-sm break-words">
          {apa(preview).map((segment, index) =>
            segment.italic ? <i key={index}>{segment.text}</i> : <span key={index}>{segment.text}</span>,
          )}
        </p>
      </section>

      <Field id="source-key" label="BibLaTeX-Schlüssel" hint="Leer lassen für den Vorschlag. Im Text dann z. B. \parencite{schlüssel}.">
        <Input
          id="source-key"
          name="citationKey"
          maxLength={60}
          pattern="[A-Za-z0-9_:.\-]+"
          defaultValue={source?.citationKey ?? ""}
          placeholder={suggestCitationKey(preview)}
          className="font-mono"
        />
      </Field>

      <Field id="source-notes" label="Eigene Notizen">
        <Textarea id="source-notes" name="notes" rows={4} maxLength={5000} defaultValue={source?.notes ?? ""} />
      </Field>

      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="brand">{source ? "Speichern" : "Anlegen"}</SubmitButton>
        <Button asChild variant="ghost">
          <Link href={`${PATH}?tab=sources`}>Abbrechen</Link>
        </Button>
        {source && (
          <SubmitButton
            variant="ghost"
            formAction={deleteSource}
            formNoValidate
            onClick={(event) => {
              if (!window.confirm(`„${source.title}“ löschen?`)) event.preventDefault();
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
