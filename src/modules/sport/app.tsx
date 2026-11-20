"use client";

import { CalendarCheckIcon, CalendarDaysIcon, DumbbellIcon, FootprintsIcon, HouseIcon, MoonIcon, Settings2Icon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Loading } from "@/components/loading";
import { ViewLink as Link, useViewNavigate } from "@/lib/query/view-link";
import { cn } from "@/lib/utils";
import { CalendarTab } from "./calendar";
import { todayInGermany } from "./calc";
import { GymTab } from "./gym";
import { OverviewTab } from "./overview";
import { RecoveryTab } from "./recovery";
import { RunningTab } from "./running";
import { SettingsTab } from "./settings";
import { useSportData } from "./store";
import { PlanTab } from "./week-check";
import { yearReview } from "./wrapped";
import { WrappedStory } from "./wrapped-story";

const PATH = "/m/sport";

const tabs = [
  { id: "uebersicht", label: "Übersicht", short: "Start", icon: HouseIcon },
  { id: "laufen", label: "Laufen", short: "Laufen", icon: FootprintsIcon },
  { id: "erholung", label: "Erholung", short: "Erholung", icon: MoonIcon },
  { id: "gym", label: "Gym", short: "Gym", icon: DumbbellIcon },
  { id: "kalender", label: "Kalender", short: "Kalender", icon: CalendarDaysIcon },
  { id: "plan", label: "Plan", short: "Plan", icon: CalendarCheckIcon },
] as const;

type TabId = (typeof tabs)[number]["id"] | "einstellungen";

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
  const requested = searchParams.get("tab");
  // Old links to the week check (?tab=woche) open the Plan tab.
  const tab: TabId = requested === "einstellungen" ? "einstellungen" : requested === "woche" ? "plan" : (tabs.find((entry) => entry.id === requested)?.id ?? "uebersicht");
  const [weeks, setWeeks] = useState<number>(12);
  const today = todayInGermany();
  const href = (id: TabId) => (id === "uebersicht" ? PATH : `${PATH}?tab=${id}`);
  const showRange = tab === "laufen" || tab === "erholung" || tab === "gym";
  const reviewYear = Number(searchParams.get("rueckblick")) || null;

  return (
    <div className="space-y-4 pb-24 sm:space-y-5 sm:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <h2 className="text-lg font-semibold sm:hidden">{tab === "einstellungen" ? "Einstellungen" : tabs.find((entry) => entry.id === tab)?.label}</h2>
        <div className="flex items-center gap-2">
          {showRange && (
            <div role="group" aria-label="Zeitraum" className="flex gap-1 rounded-lg bg-muted p-1">
              {RANGES.map((range) => (
                <button
                  key={range.weeks}
                  type="button"
                  aria-pressed={weeks === range.weeks}
                  onClick={() => setWeeks(range.weeks)}
                  className={cn(
                    "h-8 cursor-pointer rounded-md px-2.5 text-sm transition-colors sm:h-9 sm:px-3",
                    weeks === range.weeks ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
          )}
          <Link
            href={href("einstellungen")}
            aria-label="Einstellungen"
            aria-current={tab === "einstellungen" ? "page" : undefined}
            className={cn(
              "flex size-10 items-center justify-center rounded-lg border bg-card transition-colors hover:bg-muted",
              tab === "einstellungen" && "border-brand text-brand",
            )}
          >
            <Settings2Icon className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {tab === "uebersicht" && <OverviewTab today={today} />}
      {tab === "laufen" && <RunningTab today={today} weeks={weeks} />}
      {tab === "erholung" && <RecoveryTab today={today} weeks={weeks} />}
      {tab === "gym" && <GymTab today={today} weeks={weeks} />}
      {tab === "kalender" && <CalendarTab today={today} />}
      {tab === "plan" && <PlanTab today={today} />}
      {tab === "einstellungen" && <SettingsTab />}
      {reviewYear && <ReviewOverlay year={reviewYear} today={today} />}

      <nav
        aria-label="Bereiche"
        data-bottom-nav=""
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] sm:hidden print:hidden"
      >
        <ul className="flex">
          {tabs.map((entry) => (
            <li key={entry.id} className="min-w-0 flex-1">
              <Link
                href={href(entry.id)}
                aria-current={entry.id === tab ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-0.5 text-[10.5px]",
                  entry.id === tab ? "font-semibold text-brand" : "text-muted-foreground",
                )}
              >
                <entry.icon className="size-5" aria-hidden="true" />
                <span className="max-w-full truncate px-0.5">{entry.short}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

// The year review over the page, opened by ?rueckblick=<year>.
function ReviewOverlay({ year, today }: { year: number; today: string }) {
  const data = useSportData();
  const navigate = useViewNavigate();
  const searchParams = useSearchParams();
  const close = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("rueckblick");
    const query = params.toString();
    navigate(query ? `${PATH}?${query}` : PATH, { replace: true, scroll: false });
  };
  return <WrappedStory review={yearReview(data, year, today)} name={data.viewerName ?? "Mein Jahr"} onClose={close} />;
}
