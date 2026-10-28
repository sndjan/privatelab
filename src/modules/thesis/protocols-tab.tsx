import { ArrowLeftIcon, CalendarClockIcon, PencilIcon, PlusIcon, SearchIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { byPriority, formatDate, formatShortDate, peopleNames, type Person, type Protocol } from "./data";
import { DocumentList } from "./documents-tab";
import { ProtocolMarkdown } from "./markdown";
import { ProtocolForm } from "./protocol-form";
import { loadDocuments, loadEvent, loadEvents, loadPeople, loadPhases, loadProtocol, loadProtocols, loadTodos } from "./queries";
import { QuickTodo } from "./quick-todo";
import { TodoList } from "./todo-list";

const PATH = "/m/thesis";

type Props = { today: string; protocolId?: string; edit: boolean; query?: string; eventId?: string };

export async function ProtocolsTab({ today, protocolId, edit, query, eventId }: Props) {
  if (protocolId === "new" || (protocolId && edit)) {
    const [protocol, people, event] = await Promise.all([
      protocolId === "new" ? null : loadProtocol(protocolId),
      loadPeople(),
      protocolId === "new" && eventId ? loadEvent(eventId) : null,
    ]);
    if (protocolId !== "new" && !protocol) notFound();
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>{protocol ? "Protokoll bearbeiten" : "Neues Protokoll"}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProtocolForm protocol={protocol} people={people} event={event} today={today} />
        </CardContent>
      </Card>
    );
  }
  if (protocolId) return <ProtocolView protocolId={protocolId} today={today} />;

  const [protocols, people] = await Promise.all([loadProtocols(), loadPeople()]);
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
          <form action={PATH} className="relative min-w-48 flex-1 sm:ml-auto sm:max-w-72">
            <input type="hidden" name="tab" value="protocols" />
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" name="q" defaultValue={search} placeholder="Protokolle durchsuchen" aria-label="Protokolle durchsuchen" className="pl-8" />
          </form>
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

async function ProtocolView({ protocolId, today }: { protocolId: string; today: string }) {
  const [protocol, phases, todos, documents, people, events] = await Promise.all([
    loadProtocol(protocolId),
    loadPhases(),
    loadTodos(protocolId),
    loadDocuments({ protocolId }),
    loadPeople(),
    loadEvents(protocolId),
  ]);
  if (!protocol) notFound();
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
