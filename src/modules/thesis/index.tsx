import { notFound } from "next/navigation";
import { Prefetch } from "@/lib/query/server";
import type { ModulePageProps } from "@/modules/registry";
import { ThesisApp } from "./app";
import { tabs, type TabId } from "./data";
import { thesisQuery, type ThesisData } from "./query";

// What each tab reads, loaded on the server for the first view; the browser
// cache takes over from there (see app.tsx).
const tabData: Record<TabId, ThesisData[]> = {
  overview: ["settings", "phases", "todos", "log", "sources", "protocols", "people", "events", "infos", "sections"],
  writing: ["sections", "sources", "documents", "settings", "phases", "imageUrls"],
  todos: ["phases", "todos", "protocols", "people"],
  events: ["events", "people", "protocols"],
  log: ["phases", "log"],
  sources: ["sources", "documents"],
  protocols: ["protocols", "people", "phases", "todos", "documents", "events"],
  documents: ["documents", "sources", "protocols"],
};

// Tracks the thesis as it happens: topic and time frame, phases, to-dos, a
// work log with hours, sources (APA 7 and BibLaTeX), meeting protocols and
// documents.
// It only shows what was entered; nothing is suggested or generated.
export default async function ThesisModule({ user, hasAccess, searchParams }: ModulePageProps) {
  if (!user || !hasAccess) notFound();
  const params = await searchParams;
  const tab = tabs.find((entry) => entry.id === params.tab)?.id ?? "overview";
  return (
    <Prefetch queries={tabData[tab].map(thesisQuery)}>
      <ThesisApp userId={user.id} />
    </Prefetch>
  );
}
