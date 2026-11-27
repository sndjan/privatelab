"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Loading } from "@/components/loading";
import { ViewLink as Link } from "@/lib/query/view-link";
import { ForecastView } from "./forecast";
import { HistoryView } from "./history";
import { ItemDialog } from "./item-dialog";
import { ListView } from "./list";
import { SettingsView } from "./settings";
import { DialogsContext, type ItemDialogRequest } from "./store";
import { TodayView } from "./today";

const PATH = "/m/kanzlei";

const tabs = [
  { id: "today", label: "Heute" },
  { id: "list", label: "Aufträge" },
  { id: "forecast", label: "Vorschau" },
  { id: "history", label: "Verlauf" },
  { id: "settings", label: "Einstellungen" },
] as const;

type TabId = (typeof tabs)[number]["id"];

// The module in the browser: tabs switch without the server and render from
// the query cache (see index.tsx).
export function KanzleiApp() {
  const searchParams = useSearchParams();
  const tab: TabId = tabs.find((entry) => entry.id === searchParams.get("tab"))?.id ?? "today";
  const [request, setRequest] = useState<{ key: number; request: ItemDialogRequest } | null>(null);
  const dialogs = useMemo(() => ({ openItem: (next: ItemDialogRequest) => setRequest({ key: Date.now(), request: next }) }), []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <nav aria-label="Bereiche" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1 rounded-lg bg-muted p-1 sm:w-full">
          {tabs.map((entry) => (
            <li key={entry.id} className="sm:flex-1">
              <Link
                href={entry.id === "today" ? PATH : `${PATH}?tab=${entry.id}`}
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
        <DialogsContext.Provider value={dialogs}>
          {tab === "today" && <TodayView />}
          {tab === "list" && <ListView />}
          {tab === "forecast" && <ForecastView />}
          {tab === "history" && <HistoryView />}
          {tab === "settings" && <SettingsView />}
          {request && <ItemDialog key={request.key} request={request.request} onClose={() => setRequest(null)} />}
        </DialogsContext.Provider>
      </Suspense>
    </div>
  );
}
