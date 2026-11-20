"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { syncNow } from "./actions";

const NAMES = { garmin: "Garmin", hevy: "Hevy" } as const;

// Fetches the last 3 days from Garmin and/or Hevy now instead of waiting for
// the 6-hour sync, then reloads the data.
export function useSync() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"all" | "garmin" | "hevy" | null>(null);
  async function run(only: "garmin" | "hevy" | null) {
    if (busy) return;
    setBusy(only ?? "all");
    const label = only ? NAMES[only] : "Garmin und Hevy";
    const id = toast.loading(`${label} wird aktualisiert …`);
    try {
      const result = await syncNow(only);
      if ("error" in result) toast.error(result.error, { id });
      else if (result.ok) toast.success(`${label} aktualisiert.`, { id });
      else {
        const failed = Object.keys(result.errors).map((key) => NAMES[key as keyof typeof NAMES] ?? key);
        toast.error(`${failed.join(" und ")} nicht aktualisiert. Details unten im Sync-Protokoll.`, { id });
      }
    } catch {
      toast.error("Keine Verbindung zum Server.", { id });
    } finally {
      setBusy(null);
      void queryClient.invalidateQueries({ queryKey: ["sport"] });
    }
  }
  return { busy, run };
}

// Icon button for the header: both APIs.
export function SyncButton() {
  const { busy, run } = useSync();
  return (
    <button
      type="button"
      onClick={() => run(null)}
      disabled={busy != null}
      aria-label={busy ? "Wird aktualisiert" : "Garmin und Hevy jetzt aktualisieren"}
      title="Garmin und Hevy jetzt aktualisieren"
      className="flex size-10 cursor-pointer items-center justify-center rounded-xl border bg-card transition-colors hover:bg-muted disabled:cursor-wait"
    >
      <RefreshCwIcon className={cn("size-5", busy && "animate-spin text-brand")} aria-hidden="true" />
    </button>
  );
}

// One button per API, for the sync log.
export function SyncButtons() {
  const { busy, run } = useSync();
  return (
    <div className="flex flex-wrap gap-2">
      {(["garmin", "hevy"] as const).map((only) => (
        <button
          key={only}
          type="button"
          onClick={() => run(only)}
          disabled={busy != null}
          className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border bg-card px-3.5 text-sm font-semibold transition-colors hover:bg-muted disabled:cursor-wait disabled:opacity-70"
        >
          <RefreshCwIcon className={cn("size-4", (busy === only || busy === "all") && "animate-spin text-brand")} aria-hidden="true" />
          {NAMES[only]} aktualisieren
        </button>
      ))}
    </div>
  );
}
