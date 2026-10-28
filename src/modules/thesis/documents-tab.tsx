"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileIcon,
  FileImageIcon,
  FileTextIcon,
  MessageSquareTextIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dataQuery } from "@/lib/query/data";
import { ViewLink as Link } from "@/lib/query/view-link";
import {
  categoryLabel,
  documentCategories,
  formatBytes,
  formatDate,
  isImage,
  isPdf,
  type ThesisDocument,
} from "./data";
import { DocumentForm } from "./document-form";
import { NotFoundNote } from "./fields";
import { PdfViewer } from "./pdf-viewer-loader";
import { useThesis } from "./use-thesis";

const PATH = "/m/thesis";

type Props = {
  userId: string;
  documentId?: string;
  edit: boolean;
  category?: string;
  // Preselected links for a new document.
  sourceId?: string;
  protocolId?: string;
};

export function DocumentsTab({ userId, documentId, edit, category, sourceId, protocolId }: Props) {
  const [all, sources, protocols] = useThesis("documents", "sources", "protocols");
  if (documentId === "new" || (documentId && edit)) {
    const document = documentId === "new" ? null : (all.find((entry) => entry.id === documentId) ?? null);
    if (documentId !== "new" && !document) return <NotFoundNote what="Dieses Dokument" back={`${PATH}?tab=documents`} />;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>{document ? "Dokument bearbeiten" : "Dokument hochladen"}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentForm
            key={documentId}
            document={document}
            userId={userId}
            sources={sources
              .map((source) => ({ id: source.id, title: source.title }))
              .sort((a, b) => a.title.localeCompare(b.title, "de-DE"))}
            protocols={protocols.map((protocol) => ({ id: protocol.id, title: protocol.title, date: protocol.date }))}
            defaultSourceId={sourceId}
            defaultProtocolId={protocolId}
          />
        </CardContent>
      </Card>
    );
  }
  if (documentId) {
    const document = all.find((entry) => entry.id === documentId);
    if (!document) return <NotFoundNote what="Dieses Dokument" back={`${PATH}?tab=documents`} />;
    return (
      <DocumentView
        document={document}
        source={sources.find((entry) => entry.id === document.sourceId)}
        protocol={protocols.find((entry) => entry.id === document.protocolId)}
      />
    );
  }

  const filter = documentCategories.find((entry) => entry.value === category)?.value;
  const shown = filter ? all.filter((document) => document.category === filter) : all;

  return (
    <div className="space-y-4">
      <Button asChild variant="brand">
        <Link href={`${PATH}?tab=documents&document=new`}>
          <PlusIcon /> Dokument hochladen
        </Link>
      </Button>

      {all.length > 0 && (
        <nav aria-label="Nach Kategorie filtern" className="flex flex-wrap gap-1.5">
          {[{ value: undefined, label: "Alle" }, ...documentCategories].map((entry) => {
            const count = entry.value ? all.filter((document) => document.category === entry.value).length : all.length;
            const active = entry.value === filter;
            return (
              <Link
                key={entry.label}
                href={entry.value ? `${PATH}?tab=documents&category=${entry.value}` : `${PATH}?tab=documents`}
                aria-current={active ? "page" : undefined}
                className={`rounded-full border px-3 py-1 text-sm ${active ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
              >
                {entry.label} <span className="font-mono text-xs">{count}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {all.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            Noch keine Dokumente. Hier landen PDFs, Entwürfe, Vorlagen und alles andere rund um die Arbeit, auf Wunsch
            verknüpft mit einer Quelle oder einem Protokoll.
          </CardContent>
        </Card>
      ) : (
        <DocumentList documents={shown} />
      )}
    </div>
  );
}

// Linked list of documents, also used on protocols.
export function DocumentList({ documents }: { documents: ThesisDocument[] }) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {documents.map((document) => {
        const Icon = isPdf(document) ? FileTextIcon : isImage(document) ? FileImageIcon : FileIcon;
        return (
          <li key={document.id}>
            <Link
              href={`${PATH}?tab=documents&document=${document.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 active:bg-accent"
            >
              <Icon className="size-5 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{document.title}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {categoryLabel(document.category)} · {fileType(document)} · {formatBytes(document.sizeBytes)} ·{" "}
                  {formatDate(document.fileUpdatedAt.slice(0, 10))}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function DocumentView({
  document,
  source,
  protocol,
}: {
  document: ThesisDocument;
  source?: { id: string; title: string };
  protocol?: { id: string; title: string; date: string };
}) {
  // Signed links last an hour; a new version of the file changes the key.
  const urls = useQuery({
    ...dataQuery("thesis", "documentUrls", { id: document.id, version: document.fileUpdatedAt }),
    staleTime: 30 * 60_000,
  });
  const { viewUrl, downloadUrl } = urls.data ?? { viewUrl: null, downloadUrl: null };

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link href={`${PATH}?tab=documents`}>
          <ArrowLeftIcon /> Dokumente
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2 className="break-words">{document.title}</h2>
          </CardTitle>
          <CardDescription className="break-all">
            {categoryLabel(document.category)} · {document.fileName} · {formatBytes(document.sizeBytes)} ·{" "}
            {formatDate(document.fileUpdatedAt.slice(0, 10))}
          </CardDescription>
          <CardAction>
            <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
              <Link href={`${PATH}?tab=documents&document=${document.id}&edit=1`} aria-label="Dokument bearbeiten">
                <PencilIcon />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {document.note && <p className="text-sm whitespace-pre-line">{document.note}</p>}
          {(source || protocol) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {source && (
                <Link href={`${PATH}?tab=sources&source=${source.id}`} className="inline-flex items-center gap-1.5 text-brand hover:underline">
                  <BookOpenIcon className="size-4" /> {source.title}
                </Link>
              )}
              {protocol && (
                <Link
                  href={`${PATH}?tab=protocols&protocol=${protocol.id}`}
                  className="inline-flex items-center gap-1.5 text-brand hover:underline"
                >
                  <MessageSquareTextIcon className="size-4" /> {formatDate(protocol.date)} · {protocol.title}
                </Link>
              )}
            </div>
          )}
          {downloadUrl && viewUrl && (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <a href={downloadUrl}>
                  <DownloadIcon /> Herunterladen
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={viewUrl} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon /> In neuem Tab
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {urls.isPending ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : !viewUrl ? (
        <p className="px-1 text-sm text-destructive">Die Datei konnte nicht gefunden werden.</p>
      ) : isPdf(document) ? (
        <PdfViewer url={viewUrl} />
      ) : isImage(document) ? (
        // A signed, short-lived URL from storage; next/image can't optimize it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={viewUrl} alt={document.title} className="mx-auto max-h-[80vh] rounded-xl border" />
      ) : (
        <p className="px-1 text-sm text-muted-foreground">Für diesen Dateityp gibt es keine Vorschau. Lade die Datei herunter.</p>
      )}
    </div>
  );
}

// "PDF", "DOCX", …
function fileType(document: ThesisDocument) {
  return /\.([A-Za-z0-9]{1,10})$/.exec(document.fileName)?.[1]?.toUpperCase() ?? "Datei";
}
