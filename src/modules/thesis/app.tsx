"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ViewLink as Link } from "@/lib/query/view-link";
import { CalendarTab } from "./calendar-tab";
import { byPriority, tabs, todayInGermany, type TabId } from "./data";
import { DocumentsTab } from "./documents-tab";
import { Overview } from "./overview";
import { EventsTab } from "./events-tab";
import { LogTab } from "./log-tab";
import { BreakGate } from "./planning";
import { ProtocolsTab } from "./protocols-tab";
import { QuickTodo } from "./quick-todo";
import { SourcesTab } from "./sources-tab";
import { TodoList } from "./todo-list";
import { useThesis } from "./use-thesis";
import { WritingTab } from "./writing-tab";

const PATH = "/m/thesis";

// The module in the browser: views switch without the server and render from
// the query cache (see index.tsx for what the first view gets from the server).
export function ThesisApp({ userId }: { userId: string }) {
  const searchParams = useSearchParams();
  const param = (key: string) => searchParams.get(key) ?? undefined;
  const tab: TabId = tabs.find((entry) => entry.id === param("tab"))?.id ?? "overview";
  const today = todayInGermany();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <nav aria-label="Bereiche" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1 rounded-lg bg-muted p-1 sm:w-full">
          {tabs.map((entry) => (
            <li key={entry.id} className="sm:flex-1">
              <Link
                href={entry.id === "overview" ? PATH : `${PATH}?tab=${entry.id}`}
                aria-current={entry.id === tab ? "page" : undefined}
                className={`flex h-9 items-center justify-center rounded-md px-3 text-sm whitespace-nowrap transition-colors ${
                  entry.id === tab
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {entry.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Suspense fallback={<Loading />}>
        <BreakGate today={today}>
          {tab === "overview" && <Overview today={today} />}
          {tab === "writing" && <WritingTab />}
          {tab === "todos" && <TodosTab today={today} />}
          {tab === "events" && <EventsTab today={today} />}
          {tab === "calendar" && <CalendarTab today={today} />}
          {tab === "log" && <LogTab today={today} />}
          {tab === "sources" && <SourcesTab today={today} sourceId={param("source")} status={param("status")} query={param("q")} />}
          {tab === "protocols" && (
            <ProtocolsTab
              today={today}
              protocolId={param("protocol")}
              edit={param("edit") === "1"}
              query={param("q")}
              eventId={param("event")}
            />
          )}
          {tab === "documents" && (
            <DocumentsTab
              userId={userId}
              documentId={param("document")}
              edit={param("edit") === "1"}
              category={param("category")}
              sourceId={param("source")}
              protocolId={param("protocol")}
            />
          )}
        </BreakGate>
      </Suspense>
    </div>
  );
}

// --- To-dos --------------------------------------------------------------------

function TodosTab({ today }: { today: string }) {
  const [phases, todos, protocols, people] = useThesis("phases", "todos", "protocols", "people");
  const open = todos.filter((todo) => !todo.doneOn).sort(byPriority);
  const done = todos
    .filter((todo) => todo.doneOn)
    .sort((a, b) => (a.doneOn! < b.doneOn! ? 1 : a.doneOn! > b.doneOn! ? -1 : 0));

  return (
    <div className="space-y-6">
      <QuickTodo people={people} phases={phases} today={today} autoFocus />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Offen</h2>
          </CardTitle>
          <CardDescription>
            {open.length === 0 ? "Nichts offen." : `${open.length} To-dos, nach Priorität und Deadline sortiert`}
          </CardDescription>
        </CardHeader>
        {open.length > 0 && (
          <CardContent>
            <TodoList todos={open} phases={phases} people={people} protocols={protocols} today={today} showNotes />
          </CardContent>
        )}
      </Card>

      {done.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <h2>Erledigt</h2>
            </CardTitle>
            <CardDescription>{done.length} To-dos</CardDescription>
          </CardHeader>
          <CardContent>
            <TodoList todos={done} phases={phases} people={people} protocols={protocols} today={today} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
