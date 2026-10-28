"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sourceKinds, suggestCitationKey, type SourceField, type SourceKind, type SourceStatus } from "./cite";
import { isDate, parseDecimal, todayInGermany } from "./data";

// All writes go through the user's own Supabase client, so RLS enforces
// ownership and access to the 'thesis' module.

const PATH = "/m/thesis";

async function db() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return { supabase: await createClient(), userId: user.id };
}

function text(formData: FormData, key: string, max: number) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

// Keeps line breaks, trims the ends.
function longText(formData: FormData, key: string, max: number) {
  return String(formData.get(key) ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
}

function date(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  if (!isDate(value)) throw new Error(`Invalid date: ${key}`);
  return value;
}

function optionalDate(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  return isDate(value) ? value : null;
}

// Select fields use "none" for "no phase".
function optionalId(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  return value && value !== "none" ? value : null;
}

function optionalInt(formData: FormData, key: string, min: number, max: number) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max ? value : null;
}

// Throws on a Supabase error; otherwise returns the data (an empty result for writes without select).
function check<T>({ data, error }: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

// --- Topic and time frame ---------------------------------------------------

export async function saveSettings(formData: FormData) {
  const startDate = optionalDate(formData, "startDate");
  let endDate = optionalDate(formData, "endDate");
  if (startDate && endDate && endDate < startDate) endDate = startDate;
  const { supabase, userId } = await db();
  check(
    await supabase.from("thesis_settings").upsert({
      user_id: userId,
      title: text(formData, "title", 300),
      research_question: longText(formData, "researchQuestion", 2000),
      supervisors: text(formData, "supervisors", 300),
      university: text(formData, "university", 200),
      company: text(formData, "company", 200),
      start_date: startDate,
      end_date: endDate,
      updated_at: new Date().toISOString(),
    }),
  );
  revalidatePath(PATH);
}

// --- Phases -----------------------------------------------------------------

export async function savePhase(formData: FormData) {
  const startDate = date(formData, "startDate");
  const endDate = date(formData, "endDate");
  const name = text(formData, "name", 60);
  if (!name) throw new Error("Name missing");
  const row = { name, start_date: startDate, end_date: endDate < startDate ? startDate : endDate };
  const { supabase } = await db();
  const phaseId = String(formData.get("phaseId") ?? "");
  if (phaseId) {
    check(await supabase.from("thesis_phases").update(row).eq("id", phaseId));
  } else {
    check(await supabase.from("thesis_phases").insert(row));
  }
  revalidatePath(PATH);
}

export async function deletePhase(formData: FormData) {
  const { supabase } = await db();
  check(await supabase.from("thesis_phases").delete().eq("id", String(formData.get("phaseId"))));
  revalidatePath(PATH);
}

// --- To-dos -----------------------------------------------------------------

export async function saveTodo(formData: FormData) {
  const title = text(formData, "title", 200);
  if (!title) throw new Error("Title missing");
  const row = {
    title,
    note: longText(formData, "note", 2000),
    deadline: optionalDate(formData, "deadline"),
    phase_id: optionalId(formData, "phaseId"),
  };
  const { supabase } = await db();
  const todoId = String(formData.get("todoId") ?? "");
  if (todoId) {
    check(await supabase.from("thesis_todos").update(row).eq("id", todoId));
  } else {
    check(await supabase.from("thesis_todos").insert({ ...row, protocol_id: optionalId(formData, "protocolId") }));
  }
  revalidatePath(PATH);
}

export async function deleteTodo(formData: FormData) {
  const { supabase } = await db();
  check(await supabase.from("thesis_todos").delete().eq("id", String(formData.get("todoId"))));
  revalidatePath(PATH);
}

export async function setTodoDone(id: string, done: boolean) {
  const { supabase } = await db();
  check(await supabase.from("thesis_todos").update({ done_on: done ? todayInGermany() : null }).eq("id", id));
  revalidatePath(PATH);
}

// --- Work log ---------------------------------------------------------------

export async function saveLogEntry(formData: FormData) {
  const hours = parseDecimal(String(formData.get("hours") ?? ""));
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) throw new Error("Invalid hours");
  const entry = longText(formData, "text", 2000);
  if (!entry) throw new Error("Text missing");
  const row = {
    day: date(formData, "day"),
    hours: Math.round(hours * 100) / 100,
    text: entry,
    phase_id: optionalId(formData, "phaseId"),
  };
  const { supabase } = await db();
  const entryId = String(formData.get("entryId") ?? "");
  if (entryId) {
    check(await supabase.from("thesis_log").update(row).eq("id", entryId));
  } else {
    check(await supabase.from("thesis_log").insert(row));
  }
  revalidatePath(PATH);
}

export async function deleteLogEntry(formData: FormData) {
  const { supabase } = await db();
  check(await supabase.from("thesis_log").delete().eq("id", String(formData.get("entryId"))));
  revalidatePath(PATH);
}

// --- Sources ----------------------------------------------------------------

// One name per line.
function names(formData: FormData, key: string) {
  return String(formData.get(key) ?? "")
    .split("\n")
    .map((name) => name.trim().replace(/\s+/g, " ").slice(0, 200))
    .filter(Boolean)
    .slice(0, 50);
}

export async function saveSource(formData: FormData) {
  const kind = String(formData.get("kind")) as SourceKind;
  const spec = sourceKinds.find((entry) => entry.value === kind);
  if (!spec) throw new Error("Invalid kind");
  const status = String(formData.get("status")) as SourceStatus;
  // Fields the kind doesn't ask for are stored empty, so switching the kind
  // in the form leaves nothing hidden behind.
  const has = (field: SourceField) => field in spec.fields;
  const value = (field: SourceField, max: number) => (has(field) ? text(formData, field, max) : "");
  const year = has("date") || has("year") ? optionalInt(formData, "year", 1000, 2200) : null;
  const month = has("date") && year !== null ? optionalInt(formData, "month", 1, 12) : null;
  const row = {
    kind,
    status: ["found", "read", "cited"].includes(status) ? status : "found",
    authors: has("authors") ? names(formData, "authors") : [],
    editors: has("editors") ? names(formData, "editors").slice(0, 20) : [],
    year,
    month,
    day: month !== null ? optionalInt(formData, "day", 1, 31) : null,
    title: text(formData, "title", 500),
    container: value("container", 300),
    volume: value("volume", 20),
    issue: value("issue", 20),
    pages: value("pages", 30),
    edition: value("edition", 20),
    version: value("version", 40),
    publisher: value("publisher", 200),
    doi: value("doi", 200),
    url: value("url", 2000),
    accessed: has("accessed") ? optionalDate(formData, "accessed") : null,
    notes: longText(formData, "notes", 5000),
  };
  if (!row.title) throw new Error("Title missing");

  const { supabase } = await db();
  const sourceId = String(formData.get("sourceId") ?? "");
  const { data: keyRows } = await supabase.from("thesis_sources").select("id, citation_key");
  const taken = new Set((keyRows ?? []).filter((other) => other.id !== sourceId).map((other) => other.citation_key));
  const wanted = text(formData, "citationKey", 60).replace(/[^A-Za-z0-9_:.-]/g, "") || suggestCitationKey(row);
  // A taken key gets a, b, c … appended, like APA does for same author and year.
  let citationKey = wanted.slice(0, 58);
  for (let index = 0; taken.has(citationKey); index++) {
    citationKey = `${wanted.slice(0, 58)}${index < 26 ? String.fromCharCode(97 + index) : index}`;
  }

  if (sourceId) {
    check(await supabase.from("thesis_sources").update({ ...row, citation_key: citationKey }).eq("id", sourceId));
  } else {
    check(await supabase.from("thesis_sources").insert({ ...row, citation_key: citationKey }));
  }
  revalidatePath(PATH);
  redirect(`${PATH}?tab=sources`);
}

export async function deleteSource(formData: FormData) {
  const { supabase } = await db();
  check(await supabase.from("thesis_sources").delete().eq("id", String(formData.get("sourceId"))));
  revalidatePath(PATH);
  redirect(`${PATH}?tab=sources`);
}

export async function setSourceStatus(id: string, status: SourceStatus) {
  if (!["found", "read", "cited"].includes(status)) throw new Error("Invalid status");
  const { supabase } = await db();
  check(await supabase.from("thesis_sources").update({ status }).eq("id", id));
  revalidatePath(PATH);
}

// --- Protocols --------------------------------------------------------------

export async function saveProtocol(formData: FormData) {
  const title = text(formData, "title", 120);
  if (!title) throw new Error("Title missing");
  const row = {
    date: date(formData, "date"),
    title,
    participants: text(formData, "participants", 300),
    body: longText(formData, "body", 50000),
  };
  const { supabase } = await db();
  let protocolId = String(formData.get("protocolId") ?? "");
  if (protocolId) {
    check(await supabase.from("thesis_protocols").update(row).eq("id", protocolId));
  } else {
    protocolId = check(await supabase.from("thesis_protocols").insert(row).select("id").single()).id;
  }
  revalidatePath(PATH);
  redirect(`${PATH}?tab=protocols&protocol=${protocolId}`);
}

// Its to-dos stay, without the link to the meeting.
export async function deleteProtocol(formData: FormData) {
  const { supabase } = await db();
  check(await supabase.from("thesis_protocols").delete().eq("id", String(formData.get("protocolId"))));
  revalidatePath(PATH);
  redirect(`${PATH}?tab=protocols`);
}
