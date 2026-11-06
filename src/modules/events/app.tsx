"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Loading } from "@/components/loading";
import { ViewLink as Link } from "@/lib/query/view-link";
import { CalendarTab } from "./calendar";
import { todayInGermany } from "./calc";
import type { EventType } from "./data";
import { EntryDialog } from "./entry-dialog";
import { HistoryTab } from "./history";
import { Overview } from "./overview";
import { StatsTab } from "./stats";
import { DialogsContext, useEventsData, type EntryDialogRequest } from "./store";
import { TypeDialog } from "./type-dialog";

const PATH = "/m/events";

const tabs = [
  { id: "overview", label: "Übersicht" },
  { id: "calendar", label: "Kalender" },
  { id: "stats", label: "Statistik" },
  { id: "history", label: "Verlauf" },
] as const;

type TabId = (typeof tabs)[number]["id"];

// The module in the browser: tabs switch without the server and render from
// the query cache (see index.tsx).
export function EventsApp() {
  const searchParams = useSearchParams();
  const tab: TabId = tabs.find((entry) => entry.id === searchParams.get("tab"))?.id ?? "overview";
  const today = todayInGermany();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav aria-label="Bereiche" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1 rounded-lg bg-muted p-1 sm:w-full">
          {tabs.map((entry) => (
            <li key={entry.id} className="sm:flex-1">
              <Link
                href={entry.id === "overview" ? PATH : `${PATH}?tab=${entry.id}`}
                aria-current={entry.id === tab ? "page" : undefined}
                className={`flex h-9 items-center justify-center rounded-md px-3 text-sm whitespace-nowrap transition-colors ${
                  entry.id === tab ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {entry.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Suspense fallback={<Loading />}>
        <WithDialogs today={today}>
          {tab === "overview" && <Overview today={today} />}
          {tab === "calendar" && <CalendarTab today={today} month={searchParams.get("month") ?? undefined} />}
          {tab === "stats" && <StatsTab today={today} />}
          {tab === "history" && <HistoryTab today={today} />}
        </WithDialogs>
      </Suspense>
    </div>
  );
}

// The entry and type dialogs, opened from any tab through DialogsContext.
function WithDialogs({ today, children }: { today: string; children: React.ReactNode }) {
  const { types, entries } = useEventsData();
  const [entryRequest, setEntryRequest] = useState<{ key: number; request: EntryDialogRequest } | null>(null);
  const [typeRequest, setTypeRequest] = useState<{ key: number; type?: EventType } | null>(null);
  const dialogs = useMemo(
    () => ({
      openEntry: (request: EntryDialogRequest) => setEntryRequest({ key: Date.now(), request }),
      openType: (type?: EventType) => setTypeRequest({ key: Date.now(), type }),
    }),
    [],
  );
  const editedType = typeRequest?.type;

  return (
    <DialogsContext.Provider value={dialogs}>
      {children}
      {entryRequest && types.length > 0 && (
        <EntryDialog
          key={entryRequest.key}
          request={entryRequest.request}
          types={types}
          today={today}
          onClose={() => setEntryRequest(null)}
        />
      )}
      {typeRequest && (
        <TypeDialog
          key={typeRequest.key}
          type={editedType}
          entryCount={editedType ? entries.filter((entry) => entry.typeId === editedType.id).length : 0}
          nextPosition={types.length}
          onClose={() => setTypeRequest(null)}
        />
      )}
    </DialogsContext.Provider>
  );
}
