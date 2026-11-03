"use client";

import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon, LocateFixedIcon, SearchIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useViewNavigate, ViewLink as Link } from "@/lib/query/view-link";
import { addPlace, findPlaces, locatePlace } from "./actions";
import type { PlaceCandidate } from "./geocode";
import { PATH, useRefresh } from "./hooks";

const describe = (place: PlaceCandidate) =>
  [place.postcode, place.district !== place.name && place.district, place.state].filter(Boolean).join(" · ");

function currentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error("Dein Browser kann den Standort nicht bestimmen."));
    else navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 });
  });
}

function positionError(error: unknown) {
  if (typeof GeolocationPositionError !== "undefined" && error instanceof GeolocationPositionError) {
    return error.code === error.PERMISSION_DENIED
      ? "Standort nicht freigegeben. Erlaube ihn in den Browser-Einstellungen oder suche nach deinem Ort."
      : "Der Standort konnte nicht bestimmt werden. Suche stattdessen nach deinem Ort.";
  }
  return error instanceof Error ? error.message : "Der Standort konnte nicht bestimmt werden.";
}

// "Wo wohnst du?": the GPS position or a search by postcode or place name,
// then an optional name ("Zuhause") and saving. Afterwards the place's rules
// are shown.
export function PlaceSetup({ first = false }: { first?: boolean }) {
  const navigate = useViewNavigate();
  const refresh = useRefresh();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceCandidate[] | null>(null);
  const [chosen, setChosen] = useState<PlaceCandidate | null>(null);
  const [label, setLabel] = useState(first ? "Zuhause" : "");
  const [error, setError] = useState<string | null>(null);
  const [locating, startLocating] = useTransition();
  const [searching, startSearching] = useTransition();
  const [saving, startSaving] = useTransition();

  const locate = () =>
    startLocating(async () => {
      setError(null);
      try {
        const position = await currentPosition();
        const result = await locatePlace(position.coords.latitude, position.coords.longitude);
        if (result.error !== undefined) setError(result.error);
        else setChosen(result.place);
      } catch (problem) {
        setError(positionError(problem));
      }
    });

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    startSearching(async () => {
      setError(null);
      const result = await findPlaces(query).catch(() => ({ error: "Die Suche hat nicht geklappt." }));
      if (result.error !== undefined) setError(result.error);
      else setResults(result.places);
    });
  };

  const save = () =>
    startSaving(async () => {
      if (!chosen) return;
      setError(null);
      const result = await addPlace(chosen, label).catch(() => ({ error: "Der Ort konnte nicht gespeichert werden." }));
      if (result.error !== undefined) {
        setError(result.error);
        return;
      }
      await refresh();
      navigate(`${PATH}?view=rules`, { replace: true });
    });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="-ml-2 flex items-center gap-1">
        {!first && (
          <Button asChild variant="ghost" size="icon" className="size-10 text-muted-foreground">
            <Link href={`${PATH}?view=places`} aria-label="Zurück">
              <ChevronLeftIcon className="size-5" />
            </Link>
          </Button>
        )}
        <div className={first ? "px-2" : undefined}>
          <h2 className="text-xl font-semibold tracking-tight">{first ? "Wo wohnst du?" : "Ort hinzufügen"}</h2>
          <p className="text-sm text-muted-foreground">
            Jede Gemeinde trennt ein bisschen anders. Mit deinem Ort zeigt die App die Regeln, die bei dir gelten.
          </p>
        </div>
      </div>

      {chosen ? (
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <div>
            <p className="text-lg font-semibold">{chosen.name}</p>
            <p className="text-sm text-muted-foreground">{describe(chosen)}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="place-label">Name (optional)</Label>
            <Input
              id="place-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={40}
              placeholder="z. B. Zuhause, Bei den Eltern"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="lg" className="h-12 flex-1" onClick={save} disabled={saving}>
              {saving && <Loader2Icon className="animate-spin" />} Ort speichern
            </Button>
            <Button variant="outline" size="lg" className="h-12" onClick={() => setChosen(null)} disabled={saving}>
              Anderer Ort
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Button size="lg" className="h-14 w-full text-base" onClick={locate} disabled={locating}>
            {locating ? <Loader2Icon className="animate-spin" /> : <LocateFixedIcon className="size-5" />} Meinen Standort verwenden
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
            <span className="h-px flex-1 bg-border" /> oder <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={search} className="flex gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Postleitzahl oder Ort"
              aria-label="Postleitzahl oder Ort"
              maxLength={100}
              enterKeyHint="search"
              className="h-11"
            />
            <Button type="submit" variant="outline" className="h-11" disabled={searching || query.trim().length < 2}>
              {searching ? <Loader2Icon className="animate-spin" /> : <SearchIcon />} Suchen
            </Button>
          </form>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {results &&
            (results.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">Kein Ort in Deutschland gefunden. Versuch es mit der Postleitzahl.</p>
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {results.map((place) => (
                  <li key={`${place.state}|${place.district}|${place.name}`}>
                    <button
                      type="button"
                      onClick={() => setChosen(place)}
                      className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-accent"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{place.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{describe(place)}</span>
                      </span>
                      <ChevronRightIcon className="size-4 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            ))}

          <p className="px-1 text-xs text-muted-foreground">
            Der Standort wird nur einmal an OpenStreetMap geschickt, um den Ort zu finden. Gespeichert wird nur der Ort, nicht die
            genaue Position.
          </p>
        </>
      )}
    </div>
  );
}
