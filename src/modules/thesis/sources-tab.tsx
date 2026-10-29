"use client";

import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  FileTextIcon,
  PaperclipIcon,
  PencilIcon,
  PlusIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ViewLink as Link } from "@/lib/query/view-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveCitationStyle } from "./actions";
import {
  biblatex,
  bibliography,
  citationStyleOf,
  citationStyles,
  doiUrl,
  isCitationStyle,
  kindLabel,
  missingFields,
  reference,
  referenceHtml,
  referenceText,
  sortKey,
  sourceStatuses,
  type CitationStyle,
  type Source,
} from "./cite";
import type { ThesisDocument } from "./data";
import { NotFoundNote, SearchForm } from "./fields";
import { SourceForm } from "./source-form";
import { CopyText, DownloadText, StatusSelect } from "./source-tools";
import { thesisQuery } from "./query";
import { useThesis } from "./use-thesis";

const PATH = "/m/thesis";

type Props = { today: string; sourceId?: string; status?: string; query?: string };

export function SourcesTab({ today, sourceId, status, query }: Props) {
  const [sources, documents, settings] = useThesis("sources", "documents", "settings");
  const style = settings.citationStyle;
  if (sourceId) {
    const source = sourceId === "new" ? null : (sources.find((entry) => entry.id === sourceId) ?? null);
    if (sourceId !== "new" && !source) return <NotFoundNote what="Diese Quelle" back={`${PATH}?tab=sources`} />;
    return (
      <Card>
        <CardHeader>
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
            <Link href={`${PATH}?tab=sources`}>
              <ArrowLeftIcon /> Quellen
            </Link>
          </Button>
          <CardTitle className="text-lg">
            <h2>{source ? "Quelle bearbeiten" : "Neue Quelle"}</h2>
          </CardTitle>
          <CardDescription>Mit * markierte Felder braucht das Literaturverzeichnis für eine vollständige Angabe.</CardDescription>
        </CardHeader>
        <CardContent>
          <SourceForm key={sourceId} source={source} today={today} style={style} />
        </CardContent>
      </Card>
    );
  }

  const all = [...sources].sort((a, b) => sortKey(a).localeCompare(sortKey(b), "de-DE"));
  const filter = sourceStatuses.find((entry) => entry.value === status)?.value;
  const search = query?.trim().toLowerCase() ?? "";
  const shown = all.filter(
    (source) =>
      (!filter || source.status === filter) &&
      (!search ||
        [source.title, source.citationKey, source.summary, source.notes, source.container, ...source.authors]
          .join(" ")
          .toLowerCase()
          .includes(search)),
  );
  const cited = all.filter((source) => source.status === "cited");
  const filterHref = (value?: string) => {
    const params = new URLSearchParams({ tab: "sources" });
    if (value) params.set("status", value);
    if (search) params.set("q", query!.trim());
    return `${PATH}?${params}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="brand">
          <Link href={`${PATH}?tab=sources&source=new`}>
            <PlusIcon /> Neue Quelle
          </Link>
        </Button>
        <StylePicker style={style} />
        {all.length > 0 && (
          <span className="flex flex-wrap gap-2 sm:ml-auto">
            <DownloadText text={bibliography(all)} filename="literatur.bib" label="Alle als .bib" />
            {cited.length > 0 && cited.length < all.length && (
              <DownloadText text={bibliography(cited)} filename="literatur.bib" label="Zitierte als .bib" />
            )}
          </span>
        )}
      </div>

      {all.length > 0 && (
        <SearchForm
          query={query}
          href={(q) => {
            const params = new URLSearchParams({ tab: "sources" });
            if (filter) params.set("status", filter);
            if (q) params.set("q", q);
            return `${PATH}?${params}`;
          }}
          placeholder="Titel, Autor:in, Schlüssel oder Kurzbeschreibung"
          label="Quellen durchsuchen"
        />
      )}

      {all.length > 0 && (
        <nav aria-label="Nach Status filtern" className="flex flex-wrap gap-1.5">
          {[{ value: undefined, label: "Alle" }, ...sourceStatuses].map((entry) => {
            const count = entry.value ? all.filter((source) => source.status === entry.value).length : all.length;
            const active = entry.value === filter;
            return (
              <Link
                key={entry.label}
                href={filterHref(entry.value)}
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
            Noch keine Quellen. Für jede Quelle fragt das Formular die nötigen Angaben ab und erzeugt daraus den Eintrag
            fürs Literaturverzeichnis im gewählten Zitierstil und für BibLaTeX.
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Nichts gefunden.</li>}
          {shown.map((source) => (
            <li key={source.id} id={`source-${source.id}`} className="scroll-mt-4 rounded-xl target:ring-2 target:ring-brand">
              <SourceCard source={source} style={style} documents={documents.filter((document) => document.sourceId === source.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The citation style for the reference list here and the LaTeX export.
function StylePicker({ style }: { style: CitationStyle }) {
  const queryClient = useQueryClient();
  const key = thesisQuery("settings").queryKey;
  const current = citationStyleOf(style);

  function pick(value: string) {
    if (!isCitationStyle(value) || value === style) return;
    queryClient.setQueryData(key, (settings) => (settings ? { ...settings, citationStyle: value } : settings));
    saveCitationStyle(value).catch(() => {
      toast.error("Der Zitierstil wurde nicht gespeichert. Ist die Migration 20261115000000_thesis_planning_calendar.sql ausgeführt?");
      void queryClient.invalidateQueries({ queryKey: key });
    });
  }

  return (
    <Select value={style} onValueChange={pick}>
      <SelectTrigger aria-label="Zitierstil" title={`${current.example} · ${current.usedIn}`} className="w-auto">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {citationStyles.map((entry) => (
          <SelectItem key={entry.value} value={entry.value} className="py-2">
            <span className="flex flex-col">
              <span>{entry.label}</span>
              <span className="text-xs text-muted-foreground in-data-[slot=select-value]:hidden">
                {entry.example} · {entry.usedIn}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SourceCard({ source, style, documents }: { source: Source; style: CitationStyle; documents: ThesisDocument[] }) {
  const missing = missingFields(source);
  const link = doiUrl(source.doi) || source.url;

  return (
    <Card className="gap-3 py-4">
      <CardContent className="space-y-3 px-4">
        {source.summary && <p className="font-medium">{source.summary}</p>}
        <div className="flex items-start gap-3">
          <p className="min-w-0 flex-1 text-sm break-words">
            {reference(source, style).map((segment, index) =>
              segment.italic ? <i key={index}>{segment.text}</i> : <span key={index}>{segment.text}</span>,
            )}
          </p>
          <Button asChild variant="ghost" size="icon" className="-mt-1.5 text-muted-foreground">
            <Link href={`${PATH}?tab=sources&source=${source.id}`} aria-label={`„${source.title}“ bearbeiten`}>
              <PencilIcon />
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{kindLabel(source.kind)}</span>
          <span className="font-mono">{source.citationKey}</span>
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
              <ExternalLinkIcon className="size-3" /> Öffnen
            </a>
          )}
          {documents.map((document) => (
            <Link
              key={document.id}
              href={`${PATH}?tab=documents&document=${document.id}`}
              className="inline-flex max-w-full items-center gap-1 text-brand hover:underline"
            >
              <FileTextIcon className="size-3 shrink-0" /> <span className="truncate">{document.title}</span>
            </Link>
          ))}
          <Link
            href={`${PATH}?tab=documents&document=new&source=${source.id}`}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <PaperclipIcon className="size-3" /> Datei anhängen
          </Link>
        </div>
        {missing.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-debt">
            <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
            Für eine vollständige Angabe fehlt: {missing.join(", ")}
          </p>
        )}
        {source.notes && <p className="text-sm whitespace-pre-line text-muted-foreground">{source.notes}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <StatusSelect id={source.id} status={source.status} label={`Status von „${source.title}“`} />
          <CopyText text={referenceText(source, style)} html={referenceHtml(source, style)} label={citationStyleOf(style).short} />
          <CopyText text={biblatex(source)} label="BibLaTeX" />
          <CopyText text={source.citationKey} label="Schlüssel" />
        </div>
      </CardContent>
    </Card>
  );
}
