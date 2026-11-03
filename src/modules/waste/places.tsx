"use client";

import { ChevronLeftIcon, Loader2Icon, MapPinIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useViewNavigate, ViewLink as Link } from "@/lib/query/view-link";
import { deletePlace, renamePlace, selectPlace } from "./actions";
import { placeLabel } from "./bins";
import { PATH, useRefresh } from "./hooks";
import type { Place } from "./loaders";

// The saved places: switch, rename, delete, add another one.
export function PlacesView({ places }: { places: Place[] }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="-ml-2 flex items-center gap-1">
        <Button asChild variant="ghost" size="icon" className="size-10 text-muted-foreground">
          <Link href={PATH} aria-label="Zurück">
            <ChevronLeftIcon className="size-5" />
          </Link>
        </Button>
        <h2 className="text-xl font-semibold tracking-tight">Meine Orte</h2>
      </div>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {places.map((place, index) => (
          <li key={place.id}>
            <PlaceRow place={place} current={index === 0} />
          </li>
        ))}
      </ul>
      <Button asChild size="lg" className="h-12 w-full">
        <Link href={`${PATH}?view=add`}>
          <PlusIcon /> Ort hinzufügen
        </Link>
      </Button>
    </div>
  );
}

function PlaceRow({ place, current }: { place: Place; current: boolean }) {
  const refresh = useRefresh();
  const navigate = useViewNavigate();
  const [label, setLabel] = useState(place.label);
  const [pending, startTransition] = useTransition();

  const act = (work: () => Promise<unknown>, after?: () => void) =>
    startTransition(async () => {
      try {
        await work();
        await refresh();
        after?.();
      } catch {
        toast.error("Das hat nicht geklappt.");
      }
    });

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <Button
        variant={current ? "default" : "outline"}
        size="icon"
        className="size-10 shrink-0 rounded-full"
        aria-label={current ? `${placeLabel(place)} ist ausgewählt` : `${placeLabel(place)} auswählen`}
        aria-pressed={current}
        disabled={pending}
        onClick={() => !current && act(() => selectPlace(place.id), () => navigate(PATH))}
      >
        {pending ? <Loader2Icon className="animate-spin" /> : <MapPinIcon />}
      </Button>
      <div className="min-w-0 flex-1">
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={() => label.trim() !== place.label && act(() => renamePlace(place.id, label))}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
          maxLength={40}
          placeholder={place.name}
          aria-label={`Name für ${place.name}`}
          className="h-8 border-0 px-1 shadow-none focus-visible:ring-1"
        />
        <p className="truncate px-1 text-xs text-muted-foreground">
          {[place.postcode, place.name, place.district !== place.name && place.district, place.state].filter(Boolean).join(" · ")}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-10 shrink-0 text-muted-foreground"
        aria-label={`${placeLabel(place)} löschen`}
        disabled={pending}
        onClick={async () => {
          if (!(await confirmDialog({ title: `„${placeLabel(place)}“ löschen?`, description: "Der Verlauf bleibt erhalten." }))) return;
          act(() => deletePlace(place.id));
        }}
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}
