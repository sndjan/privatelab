import { createClient } from "@/lib/supabase/server";
import type { Source, SourceKind, SourceStatus } from "./cite";
import { emptySettings, type LogEntry, type Phase, type Protocol, type Settings, type Todo } from "./data";

// Reads the user's rows (RLS limits every query to them) and maps them to
// the module's types.

export async function loadSettings(userId: string): Promise<Settings> {
  const supabase = await createClient();
  const { data } = await supabase.from("thesis_settings").select("*").eq("user_id", userId).maybeSingle();
  if (!data) return emptySettings;
  return {
    title: data.title,
    researchQuestion: data.research_question,
    supervisors: data.supervisors,
    university: data.university,
    company: data.company,
    startDate: data.start_date,
    endDate: data.end_date,
  };
}

export async function loadPhases(): Promise<Phase[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("thesis_phases")
    .select("id, name, start_date, end_date")
    .order("start_date")
    .order("created_at");
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, startDate: row.start_date, endDate: row.end_date }));
}

const todoColumns = "id, title, note, deadline, phase_id, protocol_id, done_on";

type TodoRow = {
  id: string;
  title: string;
  note: string;
  deadline: string | null;
  phase_id: string | null;
  protocol_id: string | null;
  done_on: string | null;
};

const toTodo = (row: TodoRow): Todo => ({
  id: row.id,
  title: row.title,
  note: row.note,
  deadline: row.deadline,
  phaseId: row.phase_id,
  protocolId: row.protocol_id,
  doneOn: row.done_on,
});

export async function loadTodos(protocolId?: string): Promise<Todo[]> {
  const supabase = await createClient();
  let query = supabase.from("thesis_todos").select(todoColumns).order("created_at");
  if (protocolId) query = query.eq("protocol_id", protocolId);
  const { data } = await query;
  return ((data ?? []) as TodoRow[]).map(toTodo);
}

export async function loadLog(): Promise<LogEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("thesis_log")
    .select("id, day, hours, text, phase_id")
    .order("day", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => ({
    id: row.id,
    day: row.day,
    hours: Number(row.hours),
    text: row.text,
    phaseId: row.phase_id,
  }));
}

type SourceRow = {
  id: string;
  kind: string;
  citation_key: string;
  status: string;
  authors: string[];
  editors: string[];
  year: number | null;
  month: number | null;
  day: number | null;
  title: string;
  container: string;
  volume: string;
  issue: string;
  pages: string;
  edition: string;
  version: string;
  publisher: string;
  doi: string;
  url: string;
  accessed: string | null;
  notes: string;
};

const toSource = (row: SourceRow): Source => ({
  id: row.id,
  kind: row.kind as SourceKind,
  citationKey: row.citation_key,
  status: row.status as SourceStatus,
  authors: row.authors,
  editors: row.editors,
  year: row.year,
  month: row.month,
  day: row.day,
  title: row.title,
  container: row.container,
  volume: row.volume,
  issue: row.issue,
  pages: row.pages,
  edition: row.edition,
  version: row.version,
  publisher: row.publisher,
  doi: row.doi,
  url: row.url,
  accessed: row.accessed,
  notes: row.notes,
});

export async function loadSources(): Promise<Source[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("thesis_sources").select("*");
  return ((data ?? []) as SourceRow[]).map(toSource);
}

export async function loadSource(id: string): Promise<Source | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("thesis_sources").select("*").eq("id", id).maybeSingle();
  return data ? toSource(data as SourceRow) : null;
}

const protocolColumns = "id, date, title, participants, body";

export async function loadProtocols(): Promise<Protocol[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("thesis_protocols")
    .select(protocolColumns)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as Protocol[];
}

export async function loadProtocol(id: string): Promise<Protocol | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("thesis_protocols").select(protocolColumns).eq("id", id).maybeSingle();
  return (data as Protocol | null) ?? null;
}
