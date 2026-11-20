"use client";

import { CalendarCheckIcon, DumbbellIcon, FootprintsIcon, HouseIcon, MoonIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Loading } from "@/components/loading";
import { ViewLink as Link } from "@/lib/query/view-link";
import { cn } from "@/lib/utils";
import { todayInGermany } from "./calc";
import { GymTab } from "./gym";
import { OverviewTab } from "./overview";
import { RecoveryTab } from "./recovery";
import { RunningTab } from "./running";
import { WeekCheckTab } from "./week-check";

const PATH = "/m/sport";

const tabs = [
  { id: "uebersicht", label: "Übersicht", icon: HouseIcon },
  { id: "laufen", label: "Laufen", icon: FootprintsIcon },
  { id: "erholung", label: "Erholung", icon: MoonIcon },
  { id: "gym", label: "Gym", icon: DumbbellIcon },
  { id: "woche", label: "Wochen-Check", icon: CalendarCheckIcon },
] as const;

type TabId = (typeof tabs)[number]["id"];

export const RANGES = [
  { weeks: 12, label: "12 Wo." },
  { weeks: 26, label: "26 Wo." },
  { weeks: 52, label: "1 Jahr" },
] as const;

export function SportApp() {
  return (
    <Suspense fallback={<Loading />}>
      <Shell />
    </Suspense>
  );
}

function Shell() {
  const searchParams = useSearchParams();
  const tab: TabId = tabs.find((entry) => entry.id === searchParams.get("tab"))?.id ?? "uebersicht";
  const [weeks, setWeeks] = useState<number>(12);
  const today = todayInGermany();
  const href = (id: TabId) => (id === "uebersicht" ? PATH : `${PATH}?tab=${id}`);
  const showRange = tab === "laufen" || tab === "erholung" || tab === "gym";

  return (
    <div className="space-y-5 pb-24 sm:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Bereiche" className="hidden sm:block">
          <ul className="flex gap-1 rounded-lg bg-muted p-1">
            {tabs.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={href(entry.id)}
                  aria-current={entry.id === tab ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center rounded-md px-3 text-sm whitespace-nowrap transition-colors",
                    entry.id === tab ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {entry.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {showRange && (
          <div role="group" aria-label="Zeitraum" className="flex gap-1 rounded-lg bg-muted p-1">
            {RANGES.map((range) => (
              <button
                key={range.weeks}
                type="button"
                aria-pressed={weeks === range.weeks}
                onClick={() => setWeeks(range.weeks)}
                className={cn(
                  "h-9 cursor-pointer rounded-md px-3 text-sm transition-colors",
                  weeks === range.weeks ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "uebersicht" && <OverviewTab today={today} />}
      {tab === "laufen" && <RunningTab today={today} weeks={weeks} />}
      {tab === "erholung" && <RecoveryTab today={today} weeks={weeks} />}
      {tab === "gym" && <GymTab today={today} weeks={weeks} />}
      {tab === "woche" && <WeekCheckTab today={today} />}

      <nav
        aria-label="Bereiche"
        data-bottom-nav=""
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] sm:hidden print:hidden"
      >
        <ul className="flex">
          {tabs.map((entry) => (
            <li key={entry.id} className="flex-1">
              <Link
                href={href(entry.id)}
                aria-current={entry.id === tab ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-0.5 text-[11px]",
                  entry.id === tab ? "font-semibold text-brand" : "text-muted-foreground",
                )}
              >
                <entry.icon className="size-5" aria-hidden="true" />
                {entry.id === "woche" ? "Woche" : entry.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
