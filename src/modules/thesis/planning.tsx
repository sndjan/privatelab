"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CoffeeIcon } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { setMilestoneDone } from "./actions";
import { breakOn, daysBetween, formatDate, formatShortDate, relativeDays, type Break, type Milestone } from "./data";
import { BreakDialog, MilestoneDialog } from "./plan-dialogs";
import { thesisQuery } from "./query";
import { useThesis } from "./use-thesis";

// Milestones by date; ticking one marks it reached in the cache right away.
export function MilestoneList({ milestones, today }: { milestones: Milestone[]; today: string }) {
  const queryClient = useQueryClient();
  const key = thesisQuery("milestones").queryKey;

  function toggle(milestone: Milestone, done: boolean) {
    void queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData(key, (list) => list?.map((entry) => (entry.id === milestone.id ? { ...entry, done } : entry)));
    setMilestoneDone(milestone.id, done).catch(() => {
      toast.error("Das hat nicht geklappt. Prüf deine Verbindung.");
      void queryClient.invalidateQueries({ queryKey: key });
    });
  }

  return (
    <ul className="flex flex-col divide-y">
      {milestones.map((milestone) => {
        const late = !milestone.done && milestone.date < today;
        return (
          <li key={milestone.id} className="flex items-center gap-3 py-2.5">
            <Checkbox
              checked={milestone.done}
              aria-label={`„${milestone.name}“ erreicht`}
              onCheckedChange={(value) => toggle(milestone, value === true)}
              className="size-5"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={cn("truncate", milestone.done ? "text-muted-foreground line-through" : "font-medium")}>
                <span aria-hidden className="mr-1.5 text-brand">◆</span>
                {milestone.name}
              </span>
              <span className={cn("text-xs", late ? "text-debt" : "text-muted-foreground")}>
                {formatShortDate(milestone.date)}
                {!milestone.done && ` · ${relativeDays(milestone.date, today)}`}
              </span>
            </span>
            <MilestoneDialog key={JSON.stringify(milestone)} milestone={milestone} defaultDate={milestone.date} />
          </li>
        );
      })}
    </ul>
  );
}

export function BreakList({ breaks, today }: { breaks: Break[]; today: string }) {
  return (
    <ul className="flex flex-col divide-y">
      {breaks.map((entry) => {
        const days = daysBetween(entry.startDate, entry.endDate) + 1;
        const now = entry.startDate <= today && today <= entry.endDate;
        return (
          <li key={entry.id} className={cn("flex items-center gap-3 py-2.5", entry.endDate < today && "text-muted-foreground")}>
            <CoffeeIcon className="size-5 shrink-0 text-muted-foreground" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">
                {entry.name || "Pause"}
                {now && <span className="font-normal text-muted-foreground"> · jetzt</span>}
              </span>
              <span className="text-xs text-muted-foreground">
                {entry.startDate === entry.endDate ? formatShortDate(entry.startDate) : `${formatShortDate(entry.startDate)} – ${formatShortDate(entry.endDate)}`}
                {` · ${days} ${days === 1 ? "Tag" : "Tage"}`}
              </span>
            </span>
            <BreakDialog key={JSON.stringify(entry)} entry={entry} today={today} />
          </li>
        );
      })}
    </ul>
  );
}

// --- Pause -------------------------------------------------------------------------

// Which breaks were waved away on this device ("Trotzdem öffnen").
const dismissedKey = "thesis-break-dismissed";
function useDismissed(): [string[], (id: string) => void] {
  const raw = useSyncExternalStore(
    (callback) => {
      window.addEventListener("storage", callback);
      window.addEventListener(`${dismissedKey}-change`, callback);
      return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener(`${dismissedKey}-change`, callback);
      };
    },
    () => {
      try {
        return localStorage.getItem(dismissedKey) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]",
  );
  let ids: string[] = [];
  try {
    ids = JSON.parse(raw) as string[];
  } catch {}
  return [
    ids,
    (id) => {
      try {
        localStorage.setItem(dismissedKey, JSON.stringify([...ids.slice(-20), id]));
      } catch {}
      window.dispatchEvent(new Event(`${dismissedKey}-change`));
    },
  ];
}

// During free days the module shows only a notice (everything else stays
// hidden) until it is waved away; then a slim line remembers the pause.
export function BreakGate({ today, children }: { today: string; children: ReactNode }) {
  const [breaks] = useThesis("breaks");
  const [dismissed, dismiss] = useDismissed();
  const current = breakOn(breaks, today);
  if (!current) return children;

  const left = daysBetween(today, current.endDate);
  const until = left === 0 ? "Heute ist der letzte freie Tag." : `Frei bis ${formatDate(current.endDate)}, noch ${left} ${left === 1 ? "Tag" : "Tage"}.`;

  if (!dismissed.includes(current.id)) {
    return (
      <section aria-label="Pause" className="flex flex-col items-center gap-4 rounded-xl bg-hero px-6 py-14 text-center text-hero-foreground">
        <CoffeeIcon className="size-10 text-hero-bar" />
        <div className="space-y-2">
          <h2 className="text-3xl font-medium tracking-tight">Du hast dir die Pause verdient.</h2>
          <p className="text-hero-muted">
            {current.name ? `${current.name}: ` : ""}
            {until} Die Bachelorarbeit wartet so lange auf dich.
          </p>
        </div>
        <Button variant="ghost" className="text-hero-muted hover:bg-hero-track hover:text-hero-foreground" onClick={() => dismiss(current.id)}>
          Trotzdem öffnen
        </Button>
      </section>
    );
  }

  return (
    <>
      <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        <CoffeeIcon className="size-4 shrink-0" />
        <span>
          Eigentlich hast du gerade frei{current.name ? ` (${current.name})` : ""}. {until}
        </span>
      </p>
      {children}
    </>
  );
}
