"use client";

import { HouseIcon, ListIcon, PersonStandingIcon, PlusIcon, RulerIcon, Settings2Icon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { Loading } from "@/components/loading";
import { Button } from "@/components/ui/button";
import { ViewLink as Link } from "@/lib/query/view-link";
import { cn } from "@/lib/utils";
import { BodyTab } from "./body";
import { todayInGermany } from "./calc";
import { EntrySheet } from "./entry-sheet";
import { LogTab } from "./log";
import { MeasuresTab } from "./measures";
import { SetupTab } from "./setup";
import { StartTab } from "./start";
import { SheetContext, useWeightData, type SheetRequest } from "./store";

const PATH = "/m/weight";

const tabs = [
  { id: "start", label: "Start", icon: HouseIcon },
  { id: "body", label: "Körper", icon: PersonStandingIcon },
  { id: "measures", label: "Maße", icon: RulerIcon },
  { id: "log", label: "Log", icon: ListIcon },
  { id: "setup", label: "Setup", icon: Settings2Icon },
] as const;

type TabId = (typeof tabs)[number]["id"];

// Mobile first: on phones the tabs are a bar at the bottom with a round +
// above it; from sm on they sit at the top next to a "Messung" button.
export function WeightApp() {
  return (
    <Suspense fallback={<Loading />}>
      <Shell />
    </Suspense>
  );
}

function Shell() {
  const searchParams = useSearchParams();
  const data = useWeightData();
  const visible = tabs.filter((tab) => tab.id !== "setup" || data.me.isAdmin);
  const tab: TabId = visible.find((entry) => entry.id === searchParams.get("tab"))?.id ?? "start";
  const today = todayInGermany();
  const [request, setRequest] = useState<{ key: number; request: SheetRequest } | null>(null);
  const openSheet = useCallback((next: SheetRequest) => setRequest({ key: Date.now(), request: next }), [setRequest]);
  const canEnter = data.participants.length > 0;
  const href = (id: TabId) => (id === "start" ? PATH : `${PATH}?tab=${id}`);

  return (
    <SheetContext.Provider value={openSheet}>
      <div className="mx-auto max-w-xl space-y-4 pb-28 sm:pb-0">
        <nav aria-label="Bereiche" className="hidden items-center gap-2 sm:flex">
          <ul className="flex flex-1 gap-1 rounded-lg bg-muted p-1">
            {visible.map((entry) => (
              <li key={entry.id} className="flex-1">
                <Link
                  href={href(entry.id)}
                  aria-current={entry.id === tab ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-md px-3 text-sm whitespace-nowrap transition-colors",
                    entry.id === tab ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {entry.label}
                </Link>
              </li>
            ))}
          </ul>
          {canEnter && (
            <Button onClick={() => openSheet({ kind: "weight" })}>
              <PlusIcon /> Messung
            </Button>
          )}
        </nav>

        {tab === "start" && <StartTab today={today} />}
        {tab === "body" && <BodyTab />}
        {tab === "measures" && <MeasuresTab />}
        {tab === "log" && <LogTab />}
        {tab === "setup" && <SetupTab />}
      </div>

      {canEnter && (
        <button
          type="button"
          onClick={() => openSheet({ kind: "weight" })}
          aria-label="Neue Messung"
          className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex size-14 cursor-pointer items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg transition-transform active:scale-95 sm:hidden"
        >
          <PlusIcon className="size-7" />
        </button>
      )}

      <nav
        aria-label="Bereiche"
        data-bottom-nav=""
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] sm:hidden print:hidden"
      >
        <ul className="flex">
          {visible.map((entry) => (
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
                {entry.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {request && canEnter && (
        <EntrySheet key={request.key} request={request.request} today={today} onClose={() => setRequest(null)} />
      )}
    </SheetContext.Provider>
  );
}
