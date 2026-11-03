"use client";

import { CameraIcon, ChevronDownIcon, ChevronLeftIcon, ExternalLinkIcon, Loader2Icon, PencilIcon, RefreshCwIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ViewLink as Link } from "@/lib/query/view-link";
import { retryRules } from "./actions";
import { BinIcon } from "./bin-icon";
import { effectiveBins, formatDate, placeLabel, type EffectiveBin } from "./bins";
import { PATH, useRefresh } from "./hooks";
import type { Place, Rules } from "./loaders";
import { RulesEditor } from "./rules-editor";

// All rules for the current place: one card per bin with what goes in and
// what doesn't, local notes, the date and sources of the lookup.
export function RulesView({ place, rules, isAdmin }: { place: Place; rules: Rules | null; isAdmin: boolean }) {
  const [editing, setEditing] = useState(false);
  // The last good rules stay visible while a refresh runs or after one failed.
  const local = rules?.rules ?? null;
  const bins = effectiveBins(local);
  const updated = rules?.editedAt && (!rules.fetchedAt || rules.editedAt > rules.fetchedAt) ? rules.editedAt : rules?.fetchedAt;

  if (editing && rules) {
    return <RulesEditor rulesKey={rules.key} place={place} rules={local} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="-ml-2 flex items-center gap-1">
        <Button asChild variant="ghost" size="icon" className="size-10 text-muted-foreground">
          <Link href={PATH} aria-label="Zurück">
            <ChevronLeftIcon className="size-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold tracking-tight">Regeln für {place.name}</h2>
          <p className="truncate text-sm text-muted-foreground">
            {[place.label && placeLabel(place), place.district !== place.name && place.district, place.state].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border bg-card px-4 py-3 text-sm">
        {local ? (
          <>
            {local.summary && <p>{local.summary}</p>}
            {local.authority && (
              <p className="text-muted-foreground">
                Zuständig:{" "}
                {local.authorityUrl ? (
                  <a href={local.authorityUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                    {local.authority}
                  </a>
                ) : (
                  local.authority
                )}
              </p>
            )}
            <p className="text-muted-foreground">
              Allgemeine Regeln für Deutschland plus die Besonderheiten vor Ort, von der KI recherchiert
              {updated ? `, Stand ${formatDate(updated)}` : ""}. Tippe auf eine Tonne für Details; fett = Besonderheit vor Ort. Im Zweifel gilt die Website deines
              Abfallbetriebs.
            </p>
          </>
        ) : rules?.status === "pending" && !rules.stuck ? (
          <p className="flex items-start gap-2">
            <Loader2Icon className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
            Die KI sucht gerade die Besonderheiten für {place.name} heraus. Bis dahin siehst du die allgemeinen Regeln für Deutschland.
          </p>
        ) : (
          <>
            <p>Das sind die allgemeinen Regeln für Deutschland. Die Besonderheiten vor Ort konnten nicht abgerufen werden.</p>
            <RetryButton rulesKey={place.rulesKey} label="Noch einmal versuchen" />
          </>
        )}
      </div>

      <Button asChild size="lg" className="h-12 w-full">
        <Link href={PATH}>
          <CameraIcon /> Jetzt etwas sortieren
        </Link>
      </Button>

      <ul className="space-y-3">
        {bins.map((bin) => (
          <li key={bin.id}>
            <BinCard bin={bin} />
          </li>
        ))}
      </ul>

      {local && local.notes.length > 0 && (
        <section aria-labelledby="notes-title" className="space-y-1.5">
          <h3 id="notes-title" className="px-1 text-sm font-medium text-muted-foreground">
            Gut zu wissen
          </h3>
          <ul className="list-disc space-y-1 rounded-xl border bg-card py-3 pr-4 pl-8 text-sm">
            {local.notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </section>
      )}

      {rules && rules.sources.length > 0 && local && (
        <section aria-labelledby="sources-title" className="space-y-1.5">
          <h3 id="sources-title" className="px-1 text-sm font-medium text-muted-foreground">
            Quellen
          </h3>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card text-sm">
            {rules.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 active:bg-accent">
                  <span className="min-w-0 flex-1 truncate">{source.title}</span>
                  <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAdmin && rules && (
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <RetryButton rulesKey={rules.key} label="Neu abrufen" />
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={rules.status === "pending" && !rules.stuck}>
            <PencilIcon /> Bearbeiten
          </Button>
          <p className="w-full text-xs text-muted-foreground">Nur für Admins. Die Regeln gelten für alle, die {place.name} gespeichert haben.</p>
        </div>
      )}
    </div>
  );
}

function BinCard({ bin }: { bin: EffectiveBin }) {
  if (!bin.available) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-muted-foreground">
        <BinIcon color={bin.color} container={bin.container} className="size-10 opacity-40" />
        <div>
          <p className="font-medium">{bin.name}</p>
          <p className="text-sm">Gibt es hier nicht.{bin.note ? ` ${bin.note}` : ""}</p>
        </div>
      </div>
    );
  }
  const yes = [...bin.yes, ...bin.extraYes];
  const no = [...bin.no, ...bin.extraNo];
  const local = bin.extraYes.length > 0 || bin.extraNo.length > 0 || Boolean(bin.note);
  // Folded by default, so all bins fit on a phone screen; the summary already
  // says what matters most (the local note, else the general hint).
  return (
    <details className="group overflow-hidden rounded-xl border bg-card">
      <summary
        className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 active:bg-accent [&::-webkit-details-marker]:hidden"
        style={{ borderLeft: `6px solid ${bin.color}` }}
      >
        <BinIcon color={bin.color} container={bin.container} className="size-11" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 font-semibold">
            {bin.name}
            {local && (
              <Badge variant="outline" className="font-normal">
                vor Ort anders
              </Badge>
            )}
          </span>
          <span className="line-clamp-2 text-sm text-muted-foreground">{bin.note || bin.hint}</span>
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-3 border-t px-4 py-3 text-sm sm:grid-cols-2">
        <div>
          <p className="mb-1 font-medium text-green-700 dark:text-green-400">Ja</p>
          <ul className="space-y-0.5">
            {yes.map((item, index) => (
              <li key={index} className={index >= bin.yes.length ? "font-medium" : undefined}>
                {item}
              </li>
            ))}
          </ul>
        </div>
        {no.length > 0 && (
          <div>
            <p className="mb-1 font-medium text-destructive">Nein</p>
            <ul className="space-y-0.5">
              {no.map((item, index) => (
                <li key={index} className={index >= bin.no.length ? "font-medium" : undefined}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {bin.note && <p className="border-t px-4 py-2 text-xs text-muted-foreground">{bin.hint}</p>}
    </details>
  );
}

export function RetryButton({ rulesKey, label }: { rulesKey: string; label: string }) {
  const refresh = useRefresh();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await retryRules(rulesKey).catch(() => ({ error: "Das hat nicht geklappt." }));
          if (result.error) toast.error(result.error);
          else toast.success("Die KI sucht die Regeln neu heraus.");
          await refresh();
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />} {label}
    </Button>
  );
}
