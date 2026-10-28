"use client";

import { FileUpIcon } from "lucide-react";
import { ViewLink as Link } from "@/lib/query/view-link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { deleteDocument, discardUpload, saveDocument } from "./actions";
import {
  DOCUMENT_BUCKET,
  documentCategories,
  formatBytes,
  formatDate,
  maxDocumentBytes,
  type ThesisDocument,
} from "./data";
import { Field } from "./fields";

const PATH = "/m/thesis";

type Props = {
  document: ThesisDocument | null;
  userId: string;
  sources: { id: string; title: string }[];
  protocols: { id: string; title: string; date: string }[];
  // Preselected links of a new document, e.g. when added from a protocol.
  defaultSourceId?: string;
  defaultProtocolId?: string;
};

// "Kapitel 2 Entwurf_v3.pdf" → "Kapitel 2 Entwurf v3"
const titleFromFileName = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim().slice(0, 200);

// Upload or edit a document. The file goes straight from the browser to
// storage; only its details go through the server action (the file input has
// no name, so the file is never part of the form data).
export function DocumentForm({ document, userId, sources, protocols, defaultSourceId, defaultProtocolId }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(document?.title ?? "");
  const [titleTouched, setTitleTouched] = useState(Boolean(document));
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setError(null);
    let uploadedPath: string | null = null;
    if (file) {
      if (file.size > maxDocumentBytes) {
        setError(`Die Datei ist ${formatBytes(file.size)} groß, erlaubt sind höchstens ${formatBytes(maxDocumentBytes)}.`);
        return;
      }
      const extension = /\.([A-Za-z0-9]{1,10})$/.exec(file.name)?.[1]?.toLowerCase();
      const path = `${userId}/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
      const contentType = file.type || "application/octet-stream";
      const { error: uploadError } = await createClient()
        .storage.from(DOCUMENT_BUCKET)
        .upload(path, file, { contentType, upsert: false });
      if (uploadError) {
        setError(`Hochladen hat nicht geklappt: ${uploadError.message}`);
        return;
      }
      uploadedPath = path;
      formData.set("storagePath", path);
      formData.set("fileName", file.name);
      formData.set("mimeType", contentType);
      formData.set("sizeBytes", String(file.size));
    } else if (!document) {
      setError("Bitte eine Datei auswählen.");
      return;
    }

    try {
      const id = await saveDocument(formData);
      router.push(`${PATH}?tab=documents&document=${id}`);
    } catch {
      if (uploadedPath) await discardUpload(uploadedPath).catch(() => {});
      setError("Speichern hat nicht geklappt. Versuch es bitte noch einmal.");
    }
  }

  return (
    <form action={submit} className="space-y-4">
      {document && <input type="hidden" name="documentId" value={document.id} />}

      <Field
        id="document-file"
        label={document ? "Neue Version hochladen" : "Datei"}
        hint={
          document
            ? `Aktuell: ${document.fileName} (${formatBytes(document.sizeBytes)}, ${formatDate(document.fileUpdatedAt.slice(0, 10))}). Die alte Datei wird beim Speichern gelöscht.`
            : `Jede Art von Datei, bis ${formatBytes(maxDocumentBytes)}.`
        }
      >
        <label
          htmlFor="document-file"
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-4 text-sm hover:bg-accent/50"
        >
          <FileUpIcon className="size-5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">
            {file ? `${file.name} · ${formatBytes(file.size)}` : document ? "Datei auswählen (optional)" : "Datei auswählen"}
          </span>
        </label>
        <input
          id="document-file"
          type="file"
          className="sr-only"
          onChange={(event) => {
            const picked = event.target.files?.[0] ?? null;
            setFile(picked);
            if (picked && !titleTouched) setTitle(titleFromFileName(picked.name));
          }}
        />
      </Field>

      <Field id="document-title" label="Titel">
        <Input
          id="document-title"
          name="title"
          required
          maxLength={200}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setTitleTouched(true);
          }}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="document-category" label="Kategorie">
          <Select name="category" defaultValue={document?.category ?? "other"}>
            <SelectTrigger id="document-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {documentCategories.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="document-source" label="Zu Quelle">
          <Select name="sourceId" defaultValue={document?.sourceId ?? defaultSourceId ?? "none"}>
            <SelectTrigger id="document-source" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Keine</SelectItem>
              {sources.map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  <span className="max-w-64 truncate">{source.title}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="document-protocol" label="Zu Protokoll">
          <Select name="protocolId" defaultValue={document?.protocolId ?? defaultProtocolId ?? "none"}>
            <SelectTrigger id="document-protocol" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Keins</SelectItem>
              {protocols.map((protocol) => (
                <SelectItem key={protocol.id} value={protocol.id}>
                  <span className="max-w-64 truncate">
                    {formatDate(protocol.date)} · {protocol.title}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field id="document-note" label="Notiz">
        <Textarea id="document-note" name="note" rows={3} maxLength={2000} defaultValue={document?.note ?? ""} />
      </Field>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="brand">{document ? "Speichern" : "Hochladen"}</SubmitButton>
        <Button asChild variant="ghost">
          <Link href={document ? `${PATH}?tab=documents&document=${document.id}` : `${PATH}?tab=documents`}>Abbrechen</Link>
        </Button>
        {document && (
          <SubmitButton
            variant="ghost"
            formAction={deleteDocument}
            formNoValidate
            onClick={(event) => {
              if (!window.confirm(`„${document.title}“ mit der Datei löschen?`)) event.preventDefault();
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
