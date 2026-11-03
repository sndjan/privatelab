"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { dataQuery } from "@/lib/query/data";
import { ViewLink as Link } from "@/lib/query/view-link";
import { deleteScan } from "./actions";
import { BinIcon } from "./bin-icon";
import { effectiveBins, formatDate, type EffectiveBin } from "./bins";
import { PATH, useHome, useRefresh } from "./hooks";
import type { Scan } from "./loaders";

// Everything sorted so far, newest first.
export function HistoryView() {
  const { data: scans } = useSuspenseQuery(dataQuery("waste", "history"));
  const { data: home } = useHome();
  const bins = effectiveBins(home.rules?.status === "ready" ? home.rules.rules : null);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="-ml-2 flex items-center gap-1">
        <Button asChild variant="ghost" size="icon" className="size-10 text-muted-foreground">
          <Link href={PATH} aria-label="Zurück">
            <ChevronLeftIcon className="size-5" />
          </Link>
        </Button>
        <h2 className="text-xl font-semibold tracking-tight">Verlauf</h2>
      </div>
      {scans.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">Noch nichts sortiert.</p>
      ) : (
        <HistoryList scans={scans} bins={bins} deletable />
      )}
    </div>
  );
}

// The bin names are the current place's; a scan from another place keeps
// its bin, only the local name may differ.
export function HistoryList({ scans, bins, deletable = false }: { scans: Scan[]; bins: EffectiveBin[]; deletable?: boolean }) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {scans.map((scan) => (
        <li key={scan.id}>
          <ScanRow scan={scan} bins={bins} deletable={deletable} />
        </li>
      ))}
    </ul>
  );
}

function ScanRow({ scan, bins, deletable }: { scan: Scan; bins: EffectiveBin[]; deletable: boolean }) {
  const refresh = useRefresh();
  const [pending, startTransition] = useTransition();
  const { verdict } = scan;
  const bin = bins.find((entry) => entry.id === verdict.bin) ?? bins[0];
  const parts = verdict.parts.filter((part) => part.bin !== verdict.bin);

  return (
    <div className="flex items-center gap-3 px-3 py-2" aria-busy={pending}>
      {scan.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
        <img src={scan.thumbUrl} alt="" className="size-12 shrink-0 rounded-lg border object-cover" />
      ) : (
        <BinIcon color={bin.color} container={bin.container} className="size-12" />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate font-medium">
          {verdict.hazard && <TriangleAlertIcon className="size-4 shrink-0 text-destructive" aria-label="Gefährlich" />}
          {verdict.item}
        </p>
        <p className="flex items-center gap-1.5 text-sm">
          <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: bin.color }} />
          <span className="truncate">
            {bin.name}
            {parts.length > 0 && ` + ${parts.map((part) => bins.find((entry) => entry.id === part.bin)?.short ?? part.bin).join(", ")}`}
          </span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDate(scan.createdAt)}
          {scan.placeName && ` · ${scan.placeName}`}
        </p>
      </div>
      {deletable && (
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground"
          aria-label={`${verdict.item} aus dem Verlauf löschen`}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await deleteScan(scan.id);
                await refresh();
              } catch {
                toast.error("Löschen hat nicht geklappt.");
              }
            })
          }
        >
          <Trash2Icon />
        </Button>
      )}
    </div>
  );
}
