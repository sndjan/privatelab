"use client";

import { CalendarClockIcon, FlagIcon, MapPinIcon, MessageSquareTextIcon, NotebookPenIcon, UsersIcon } from "lucide-react";
import { ViewLink as Link } from "@/lib/query/view-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { byWhen, formatShortDate, peopleNames, relativeDays, type Person, type Protocol, type ThesisEvent } from "./data";
import { EventDialog } from "./event-dialog";
import { useThesis } from "./use-thesis";

const PATH = "/m/thesis";

// Appointments and deadlines, apart from the to-dos. After an appointment,
// "Protokoll schreiben" starts its protocol with date, title and people.
export function EventsTab({ today }: { today: string }) {
  const [events, people, protocols] = useThesis("events", "people", "protocols");
  const coming = events.filter((event) => event.date >= today).sort(byWhen);
  const past = events
    .filter((event) => event.date < today)
    .sort(byWhen)
    .reverse();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <EventDialog people={people} today={today} />
        <EventDialog people={people} today={today} defaultKind="deadline" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Demnächst</h2>
          </CardTitle>
          {coming.length === 0 && <CardDescription>Keine Termine oder Deadlines eingetragen.</CardDescription>}
        </CardHeader>
        {coming.length > 0 && (
          <CardContent>
            <EventList events={coming} people={people} protocols={protocols} today={today} />
          </CardContent>
        )}
      </Card>

      {past.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <h2>Vorbei</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EventList events={past} people={people} protocols={protocols} today={today} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function EventList({
  events,
  people,
  protocols,
  today,
  compact = false,
}: {
  events: ThesisEvent[];
  people: Person[];
  protocols: Pick<Protocol, "id" | "title">[];
  today: string;
  compact?: boolean;
}) {
  return (
    <ul className="flex flex-col divide-y">
      {events.map((event) => {
        const protocol = protocols.find((entry) => entry.id === event.protocolId);
        const names = peopleNames(people, event.personIds);
        const soon = event.date >= today && relativeDays(event.date, today);
        const Icon = event.kind === "deadline" ? FlagIcon : CalendarClockIcon;
        return (
          <li key={event.id} className="flex items-start gap-3 py-2.5">
            <Icon className={cn("mt-0.5 size-5 shrink-0", event.kind === "deadline" ? "text-debt" : "text-brand")} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium">{event.title}</span>
              <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                <span className={event.kind === "deadline" && event.date >= today ? "font-medium text-foreground" : undefined}>
                  {formatShortDate(event.date)}
                  {event.time && `, ${event.time}`}
                  {soon && ` · ${soon}`}
                </span>
                {event.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPinIcon className="size-3" /> {event.location}
                  </span>
                )}
                {names.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <UsersIcon className="size-3" /> {names.join(", ")}
                  </span>
                )}
              </span>
              {!compact && event.note && <span className="text-sm whitespace-pre-line text-muted-foreground">{event.note}</span>}
              {!compact && event.kind === "appointment" && (
                <span className="pt-1">
                  {protocol ? (
                    <Link
                      href={`${PATH}?tab=protocols&protocol=${protocol.id}`}
                      className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
                    >
                      <MessageSquareTextIcon className="size-3.5" /> {protocol.title}
                    </Link>
                  ) : (
                    event.date <= today && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`${PATH}?tab=protocols&protocol=new&event=${event.id}`}>
                          <NotebookPenIcon /> Protokoll schreiben
                        </Link>
                      </Button>
                    )
                  )}
                </span>
              )}
            </span>
            {!compact && <EventDialog key={JSON.stringify(event)} event={event} people={people} today={today} />}
          </li>
        );
      })}
    </ul>
  );
}
