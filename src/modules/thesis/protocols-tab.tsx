"use client";

import { ArrowLeftIcon, CalendarClockIcon, PencilIcon, PlusIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ViewLink as Link } from "@/lib/query/view-link";
import { byPriority, formatDate, formatShortDate, peopleNames, type Person, type Protocol } from "./data";
import { DocumentList } from "./documents-tab";
import { NotFoundNote, SearchForm } from "./fields";
import { ProtocolMarkdown } from "./markdown";
import { ProtocolForm } from "./protocol-form";
import { QuickTodo } from "./quick-todo";
import { TodoList } from "./todo-list";
import { useThesis } from "./use-thesis";

const PATH = "/m/thesis";

type Props = { today: string; protocolId?: string; edit: boolean; query?: string; eventId?: string };

export function ProtocolsTab({ today, protocolId, edit, query, eventId }: Props) {
  const [protocols, people, events] = useThesis("protocols", "people", "events");
  if (protocolId === "new" || (protocolId && edit)) {
    const protocol = protocolId === "new" ? null : (protocols.find((entry) => entry.id === protocolId) ?? null);
    const event = protocolId === "new" && eventId ? (events.find((entry) => entry.id === eventId) ?? null) : null;
    if (protocolId !== "new" && !protocol) return <NotFoundNote what="Dieses Protokoll" back={`${PATH}?tab=protocols`} />;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>{protocol ? "Protokoll bearbeiten" : "Neues Protokoll"}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProtocolForm key={`${protocolId}-${eventId}`} protocol={protocol} people={people} event={event} today={today} />
        </CardContent>
      </Card>
    );
  }
  if (protocolId) return <ProtocolView protocolId={protocolId} today={today} />;

  const search = query?.trim() ?? "";
  const shown = search ? protocols.filter((protocol) => matches(protocol, people, search)) : protocols;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="brand">
          <Link href={`${PATH}?tab=protocols&protocol=new`}>
            <PlusIcon /> Neues Protokoll
          </Link>
        </Button>
        {protocols.length > 0 && (
          <SearchForm
            query={search}
            href={(q) => `${PATH}?tab=protocols${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            placeholder="Protokolle durchsuchen"
            label="Protokolle durchsuchen"
            className="relative min-w-48 flex-1 sm:ml-auto sm:max-w-72"
          />
        )}
      </div>

      {protocols.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            Noch keine Protokolle. Nach jedem Termin hier festhalten, was besprochen wurde, und To-dos direkt daraus anlegen.
          </CardContent>
        </Card>
      ) : shown.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">Kein Protokoll enthält „{search}“.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {shown.map((protocol) => (
            <li key={protocol.id}>
              <Link
                href={`${PATH}?tab=protocols&protocol=${protocol.id}`}
                className="flex flex-col gap-0.5 px-4 py-3 hover:bg-accent/50 active:bg-accent"
              >
                <span className="text-xs text-muted-foreground">
                  {[formatDate(protocol.date), participants(protocol, people)].filter(Boolean).join(" · ")}
                </span>
                <span className="font-medium">{protocol.title}</span>
                {protocol.body && (
                  <span className="line-clamp-2 text-sm text-muted-foreground">{snippet(protocol.body, search)}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProtocolView({ protocolId, today }: { protocolId: string; today: string }) {
  const [protocols, phases, allTodos, allDocuments, people, allEvents] = useThesis(
    "protocols",
    "phases",
    "todos",
    "documents",
    "people",
    "events",
  );
  const protocol = protocols.find((entry) => entry.id === protocolId);
  if (!protocol) return <NotFoundNote what="Dieses Protokoll" back={`${PATH}?tab=protocols`} />;
  const todos = allTodos.filter((todo) => todo.protocolId === protocolId);
  const documents = allDocuments.filter((document) => document.protocolId === protocolId);
  const events = allEvents.filter((event) => event.protocolId === protocolId);
  const open = todos.filter((todo) => !todo.doneOn).sort(byPriority);
  const done = todos.filter((todo) => todo.doneOn);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link href={`${PATH}?tab=protocols`}>
          <ArrowLeftIcon /> Protokolle
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>{protocol.title}</h2>
          </CardTitle>
          <CardDescription>
            {[formatDate(protocol.date), participants(protocol, people)].filter(Boolean).join(" · ")}
            {events.map((event) => (
              <Link
                key={event.id}
                href={`${PATH}?tab=events`}
                className="mt-1 flex items-center gap-1 text-brand hover:underline"
              >
                <CalendarClockIcon className="size-3.5" /> Termin: {event.title}, {formatShortDate(event.date)}
                {event.time && ` ${event.time}`}
              </Link>
            ))}
          </CardDescription>
          <CardAction>
            <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
              <Link href={`${PATH}?tab=protocols&protocol=${protocol.id}&edit=1`} aria-label="Protokoll bearbeiten">
                <PencilIcon />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {protocol.body ? (
            <ProtocolMarkdown text={protocol.body} />
          ) : (
            <p className="text-sm text-muted-foreground">Kein Text.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>To-dos aus diesem Termin</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <QuickTodo people={people} phases={phases} today={today} protocolId={protocol.id} />
          {todos.length > 0 && <TodoList todos={[...open, ...done]} phases={phases} people={people} today={today} showNotes />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Dokumente</h2>
          </CardTitle>
          {documents.length === 0 && <CardDescription>z. B. Folien oder Unterlagen zu diesem Termin.</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-3">
          {documents.length > 0 && <DocumentList documents={documents} />}
          <Button asChild variant="outline" className="w-fit">
            <Link href={`${PATH}?tab=documents&document=new&protocol=${protocol.id}`}>
              <UploadIcon /> Dokument hochladen
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

const normalize = (text: string) => text.toLocaleLowerCase("de-DE");

// "Sandra, Prof. Weber" from the chips and the old free text.
const participants = (protocol: Protocol, people: Person[]) =>
  [...peopleNames(people, protocol.personIds), protocol.participants].filter(Boolean).join(", ");

function matches(protocol: Protocol, people: Person[], search: string) {
  const needle = normalize(search);
  return [protocol.title, participants(protocol, people), protocol.body].some((field) => normalize(field).includes(needle));
}

// The text around the first match (or the start), without Markdown symbols.
function snippet(body: string, search: string) {
  const plain = body.replace(/[#*_`>[\]]|\(https?:[^)]*\)/g, "").replace(/\s+/g, " ").trim();
  const index = search ? normalize(plain).indexOf(normalize(search)) : -1;
  if (index <= 40) return plain.slice(0, 200);
  return `…${plain.slice(index - 40, index + 160)}`;
}
