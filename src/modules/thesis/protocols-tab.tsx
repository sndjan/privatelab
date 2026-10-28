import { ArrowLeftIcon, PencilIcon, PlusIcon, SearchIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { byDeadline, formatDate, phaseOn, type Protocol } from "./data";
import { DocumentList } from "./documents-tab";
import { ProtocolMarkdown } from "./markdown";
import { ProtocolForm } from "./protocol-form";
import { loadDocuments, loadPhases, loadProtocol, loadProtocols, loadTodos } from "./queries";
import { TodoDialog } from "./todo-dialog";
import { TodoList } from "./todo-list";

const PATH = "/m/thesis";

type Props = { today: string; protocolId?: string; edit: boolean; query?: string };

export async function ProtocolsTab({ today, protocolId, edit, query }: Props) {
  if (protocolId === "new" || (protocolId && edit)) {
    const protocol = protocolId === "new" ? null : await loadProtocol(protocolId);
    if (protocolId !== "new" && !protocol) notFound();
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>{protocol ? "Protokoll bearbeiten" : "Neues Protokoll"}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProtocolForm protocol={protocol} today={today} />
        </CardContent>
      </Card>
    );
  }
  if (protocolId) return <ProtocolView protocolId={protocolId} today={today} />;

  const protocols = await loadProtocols();
  const search = query?.trim() ?? "";
  const shown = search ? protocols.filter((protocol) => matches(protocol, search)) : protocols;

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
                  {formatDate(protocol.date)}
                  {protocol.participants && ` · ${protocol.participants}`}
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
  const [protocol, phases, todos, documents] = await Promise.all([
    loadProtocol(protocolId),
    loadPhases(),
    loadTodos(protocolId),
    loadDocuments({ protocolId }),
  ]);
  if (!protocol) notFound();
  const open = todos.filter((todo) => !todo.doneOn).sort(byDeadline);
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
            {formatDate(protocol.date)}
            {protocol.participants && ` · ${protocol.participants}`}
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
          {todos.length > 0 && <TodoList todos={[...open, ...done]} phases={phases} today={today} showNotes />}
          <TodoDialog
            phases={phases}
            defaultPhaseId={phaseOn(phases, today)?.id ?? null}
            protocolId={protocol.id}
            triggerLabel="To-do hinzufügen"
          />
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

function matches(protocol: Protocol, search: string) {
  const needle = normalize(search);
  return [protocol.title, protocol.participants, protocol.body].some((field) => normalize(field).includes(needle));
}

// The text around the first match (or the start), without Markdown symbols.
function snippet(body: string, search: string) {
  const plain = body.replace(/[#*_`>[\]]|\(https?:[^)]*\)/g, "").replace(/\s+/g, " ").trim();
  const index = search ? normalize(plain).indexOf(normalize(search)) : -1;
  if (index <= 40) return plain.slice(0, 200);
  return `…${plain.slice(index - 40, index + 160)}`;
}
