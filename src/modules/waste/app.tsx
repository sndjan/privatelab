"use client";

import { ChevronRightIcon, HistoryIcon, Loader2Icon, MapPinIcon, PlusIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ViewLink as Link } from "@/lib/query/view-link";
import { cn } from "@/lib/utils";
import { selectPlace } from "./actions";
import { effectiveBins, placeLabel } from "./bins";
import { HistoryList, HistoryView } from "./history";
import { PATH, useHome, useRefresh } from "./hooks";
import type { Place, Rules } from "./loaders";
import { PlaceSetup } from "./place-setup";
import { PlacesView } from "./places";
import { RetryButton, RulesView } from "./rules";
import { Sorter } from "./sorter";

// The module in the browser, by the URL: ?view=add|places|rules|history, else
// the sorting screen. Without a saved place, choosing one comes first.
export function WasteApp() {
  const view = useSearchParams().get("view");
  const { data } = useHome();
  if (data.places.length === 0) return <PlaceSetup first />;
  if (view === "add") return <PlaceSetup />;
  if (view === "places") return <PlacesView places={data.places} />;
  if (view === "rules") return <RulesView place={data.places[0]} rules={data.rules} isAdmin={data.isAdmin} />;
  if (view === "history") return <HistoryView />;
  return <Home />;
}

function Home() {
  const { data } = useHome();
  const place = data.places[0];
  const bins = effectiveBins(data.rules?.status === "ready" ? data.rules.rules : null);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PlaceBar places={data.places} />
      <RulesStatus place={place} rules={data.rules} />
      {data.hasAiKey ? (
        <Sorter key={place.id} placeId={place.id} bins={bins} />
      ) : (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          Für die Erkennung fehlt auf dem Server ein <code>ANTHROPIC_API_KEY</code>. Die Regeln kannst du trotzdem ansehen.
        </p>
      )}
      {data.recent.length > 0 && (
        <section aria-labelledby="recent-title" className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <h2 id="recent-title" className="text-sm font-medium text-muted-foreground">
              Zuletzt sortiert
            </h2>
            <Link href={`${PATH}?view=history`} className="flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline">
              <HistoryIcon className="size-4" /> Alle
            </Link>
          </div>
          <HistoryList scans={data.recent} bins={bins} />
        </section>
      )}
    </div>
  );
}

// The saved places as chips; tapping one makes it the current place.
function PlaceBar({ places }: { places: Place[] }) {
  const refresh = useRefresh();
  const [pending, startTransition] = useTransition();
  const choose = (id: string) =>
    startTransition(async () => {
      try {
        await selectPlace(id);
        await refresh();
      } catch {
        toast.error("Der Ort konnte nicht gewechselt werden.");
      }
    });

  return (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1">
      {places.map((place, index) => (
        <Button
          key={place.id}
          variant={index === 0 ? "default" : "outline"}
          size="sm"
          className={cn("h-9 shrink-0 rounded-full", index === 0 && "pointer-events-none")}
          disabled={pending && index !== 0}
          onClick={() => choose(place.id)}
          aria-pressed={index === 0}
        >
          <MapPinIcon /> {placeLabel(place)}
        </Button>
      ))}
      {pending && <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />}
      <Button asChild variant="ghost" size="sm" className="h-9 shrink-0 rounded-full text-muted-foreground">
        <Link href={`${PATH}?view=places`}>
          <PlusIcon /> Orte
        </Link>
      </Button>
    </div>
  );
}

// One line about the current place's rules, with the way to all of them.
function RulesStatus({ place, rules }: { place: Place; rules: Rules | null }) {
  const href = `${PATH}?view=rules`;
  if (rules?.status === "ready") {
    return (
      <Link href={href} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 active:bg-accent">
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Regeln für {place.name}</span>
          <span className="line-clamp-2 text-sm text-muted-foreground">
            {rules.rules?.summary || "Allgemeine Regeln mit den Besonderheiten vor Ort."}
          </span>
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border bg-card px-4 py-3">
      {rules?.status === "pending" && !rules.stuck ? (
        <p className="flex items-start gap-2 text-sm">
          <Loader2Icon className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
          <span>
            Die KI sucht die Regeln für {place.name} heraus (1–2 Minuten). Bis dahin gelten die allgemeinen Regeln für Deutschland.
          </span>
        </p>
      ) : (
        <>
          <p className="text-sm">
            Die Regeln für {place.name} konnten nicht abgerufen werden
            {rules?.error ? `: ${rules.error}` : "."} Es gelten die allgemeinen Regeln für Deutschland.
          </p>
          <RetryButton rulesKey={place.rulesKey} label="Noch einmal versuchen" />
        </>
      )}
      <Link href={href} className="block text-sm text-muted-foreground underline underline-offset-4">
        Allgemeine Regeln ansehen
      </Link>
    </div>
  );
}
