import { notFound } from "next/navigation";
import { dataQuery } from "@/lib/query/data";
import { Prefetch } from "@/lib/query/server";
import type { ModulePageProps } from "@/modules/registry";
import { EventsApp } from "./app";

// Ereignis-Tracker: own event types (moments like "Fleisch gegessen" or spans
// like "Krank") with quick buttons, a calendar, statistics and a history.
// Every tab reads the same query; the browser cache takes over (see app.tsx).
export default async function EventsModule({ user, hasAccess }: ModulePageProps) {
  if (!user || !hasAccess) notFound();
  return (
    <Prefetch queries={[dataQuery("events", "all")]}>
      <EventsApp />
    </Prefetch>
  );
}
