import { MessageSquareTextIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDate, formatShortDate, priorityClass, relativeDays, type Person, type Phase, type Protocol, type Todo } from "./data";
import { TodoDialog } from "./todo-dialog";
import { TodoToggle } from "./todo-toggle";

const PATH = "/m/thesis";

type Props = {
  todos: Todo[];
  phases: Phase[];
  people: Person[];
  // Titles of linked protocols; without it, no protocol links are shown.
  protocols?: Pick<Protocol, "id" | "title">[];
  today: string;
  showNotes?: boolean;
};

export function TodoList({ todos, phases, people, protocols, today, showNotes = false }: Props) {
  return (
    <ul className="flex flex-col divide-y">
      {todos.map((todo) => {
        const overdue = !todo.doneOn && todo.deadline !== null && todo.deadline < today;
        const phase = phases.find((entry) => entry.id === todo.phaseId);
        const protocol = protocols?.find((entry) => entry.id === todo.protocolId);
        const person = people.find((entry) => entry.id === todo.personId);
        return (
          <li key={todo.id} className="flex items-start gap-3 py-2.5">
            <span className="flex h-6 items-center">
              <TodoToggle id={todo.id} done={todo.doneOn !== null} label={`„${todo.title}“ erledigt`} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={todo.doneOn ? "text-muted-foreground line-through" : "font-medium"}>
                {todo.priority && !todo.doneOn && (
                  <span className={cn("mr-1.5 inline-block rounded px-1 font-mono text-xs", priorityClass(todo.priority))}>
                    !{todo.priority}
                  </span>
                )}
                {todo.title}
              </span>
              {showNotes && todo.note && (
                <span className="text-sm whitespace-pre-line text-muted-foreground">{todo.note}</span>
              )}
              <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                {todo.doneOn ? (
                  <span>erledigt am {formatDate(todo.doneOn)}</span>
                ) : (
                  todo.deadline && (
                    <span className={overdue ? "font-medium text-debt" : undefined}>
                      bis {formatShortDate(todo.deadline)} · {overdue ? `überfällig, ${relativeDays(todo.deadline, today)}` : relativeDays(todo.deadline, today)}
                    </span>
                  )
                )}
                {person && (
                  <span className="inline-flex items-center gap-1">
                    <UserIcon className="size-3" />
                    {person.name}
                  </span>
                )}
                {phase && <span>{phase.name}</span>}
                {protocol && (
                  <Link
                    href={`${PATH}?tab=protocols&protocol=${protocol.id}`}
                    className="inline-flex items-center gap-1 text-brand hover:underline"
                  >
                    <MessageSquareTextIcon className="size-3" />
                    {protocol.title}
                  </Link>
                )}
              </span>
            </span>
            <TodoDialog key={JSON.stringify(todo)} todo={todo} phases={phases} people={people} defaultPhaseId={null} />
          </li>
        );
      })}
    </ul>
  );
}
