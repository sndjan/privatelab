import { ArrowLeftIcon, ExternalLinkIcon, PencilIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  apa,
  apaHtml,
  apaText,
  biblatex,
  bibliography,
  doiUrl,
  kindLabel,
  missingFields,
  sortKey,
  sourceStatuses,
  type Source,
} from "./cite";
import { loadSource, loadSources } from "./queries";
import { SourceForm } from "./source-form";
import { CopyText, DownloadText, StatusSelect } from "./source-tools";

const PATH = "/m/thesis";

type Props = { today: string; sourceId?: string; status?: string };

export async function SourcesTab({ today, sourceId, status }: Props) {
  if (sourceId) {
    const source = sourceId === "new" ? null : await loadSource(sourceId);
    if (sourceId !== "new" && !source) notFound();
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
          <CardDescription>Mit * markierte Felder braucht APA für eine vollständige Angabe.</CardDescription>
        </CardHeader>
        <CardContent>
          <SourceForm source={source} today={today} />
        </CardContent>
      </Card>
    );
  }

  const all = (await loadSources()).sort((a, b) => sortKey(a).localeCompare(sortKey(b), "de-DE"));
  const filter = sourceStatuses.find((entry) => entry.value === status)?.value;
  const shown = filter ? all.filter((source) => source.status === filter) : all;
  const cited = all.filter((source) => source.status === "cited");
  const filterHref = (value?: string) => (value ? `${PATH}?tab=sources&status=${value}` : `${PATH}?tab=sources`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="brand">
          <Link href={`${PATH}?tab=sources&source=new`}>
            <PlusIcon /> Neue Quelle
          </Link>
        </Button>
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
            Noch keine Quellen. Für jede Quelle fragt das Formular die Angaben ab, die APA 7 braucht, und erzeugt daraus
            den Eintrag fürs Literaturverzeichnis und für BibLaTeX.
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((source) => (
            <li key={source.id}>
              <SourceCard source={source} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SourceCard({ source }: { source: Source }) {
  const missing = missingFields(source);
  const link = doiUrl(source.doi) || source.url;

  return (
    <Card className="gap-3 py-4">
      <CardContent className="space-y-3 px-4">
        <div className="flex items-start gap-3">
          <p className="min-w-0 flex-1 text-sm break-words">
            {apa(source).map((segment, index) =>
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
        </div>
        {missing.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-debt">
            <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
            Für APA fehlt: {missing.join(", ")}
          </p>
        )}
        {source.notes && <p className="text-sm whitespace-pre-line text-muted-foreground">{source.notes}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <StatusSelect id={source.id} status={source.status} label={`Status von „${source.title}“`} />
          <CopyText text={apaText(source)} html={apaHtml(source)} label="APA" />
          <CopyText text={biblatex(source)} label="BibLaTeX" />
          <CopyText text={source.citationKey} label="Schlüssel" />
        </div>
      </CardContent>
    </Card>
  );
}
