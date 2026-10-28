"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sourceKinds, suggestCitationKey, type SourceField, type SourceKind, type SourceStatus } from "./cite";
import {
  DOCUMENT_BUCKET,
  documentCategories,
  isDate,
  maxDocumentBytes,
  parseDecimal,
  parseQuickTodo,
  todayInGermany,
  type Person,
} from "./data";

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

const isId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

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
  const priority = optionalInt(formData, "priority", 1, 3);
  const row = {
    title,
    note: longText(formData, "note", 2000),
    deadline: optionalDate(formData, "deadline"),
    phase_id: optionalId(formData, "phaseId"),
    priority,
    person_id: optionalId(formData, "personId"),
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

// One line like "Gliederung schicken !1 @Sandra #Exposé bis Fr" (see
// parseQuickTodo). A person named with @ who doesn't exist yet is added.
export async function addQuickTodo(input: string, protocolId: string | null = null): Promise<{ error: string | null }> {
  const { supabase } = await db();
  const [people, phases] = await Promise.all([
    supabase.from("thesis_people").select("id, name"),
    supabase.from("thesis_phases").select("id, name, start_date, end_date"),
  ]);
  const parsed = parseQuickTodo(input, {
    people: check(people) as Person[],
    phases: check(phases).map((row) => ({ id: row.id, name: row.name, startDate: row.start_date, endDate: row.end_date })),
    today: todayInGermany(),
  });
  if (!parsed.title) return { error: "Was ist zu tun? Der Text fehlt noch." };
  const personId = parsed.personId ?? (parsed.newPerson ? (await ensurePeople(supabase, [parsed.newPerson]))[0] : null);
  check(
    await supabase.from("thesis_todos").insert({
      title: parsed.title,
      priority: parsed.priority,
      person_id: personId,
      phase_id: parsed.phaseId,
      deadline: parsed.deadline,
      protocol_id: isId(protocolId) ? protocolId : null,
    }),
  );
  revalidatePath(PATH);
  return { error: null };
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

// The chips of a form: ids of existing people ("personId") and names typed in
// for new ones ("newPerson"), which are added.
async function personIds(supabase: Awaited<ReturnType<typeof db>>["supabase"], formData: FormData) {
  const ids = formData.getAll("personId").filter(isId);
  const names = formData
    .getAll("newPerson")
    .map((name) => String(name).trim().slice(0, 80))
    .filter(Boolean);
  return [...new Set([...ids, ...(await ensurePeople(supabase, names))])].slice(0, 30);
}

// Ids of the people with these names, adding the ones that don't exist yet.
async function ensurePeople(supabase: Awaited<ReturnType<typeof db>>["supabase"], names: string[]) {
  if (names.length === 0) return [];
  const existing = check(await supabase.from("thesis_people").select("id, name")) as Person[];
  const ids: string[] = [];
  for (const name of names) {
    const found = existing.find((person) => person.name.toLowerCase() === name.toLowerCase());
    if (found) {
      ids.push(found.id);
      continue;
    }
    const created = check(await supabase.from("thesis_people").insert({ name }).select("id, name").single()) as Person;
    existing.push(created);
    ids.push(created.id);
  }
  return ids;
}

export async function addPerson(name: string): Promise<Person | null> {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) return null;
  const { supabase } = await db();
  const [id] = await ensurePeople(supabase, [trimmed]);
  revalidatePath(PATH);
  return { id, name: trimmed };
}

// Removes the person from protocols, appointments and to-dos too.
export async function deletePerson(formData: FormData) {
  const { supabase } = await db();
  check(await supabase.from("thesis_people").delete().eq("id", String(formData.get("personId"))));
  revalidatePath(PATH);
}

export async function saveProtocol(formData: FormData) {
  const title = text(formData, "title", 120);
  if (!title) throw new Error("Title missing");
  const { supabase } = await db();
  const row = {
    date: date(formData, "date"),
    title,
    participants: text(formData, "participants", 300),
    person_ids: await personIds(supabase, formData),
    body: longText(formData, "body", 50000),
  };
  let protocolId = String(formData.get("protocolId") ?? "");
  if (protocolId) {
    check(await supabase.from("thesis_protocols").update(row).eq("id", protocolId));
  } else {
    protocolId = check(await supabase.from("thesis_protocols").insert(row).select("id").single()).id;
    // Written for an appointment: link it.
    const eventId = String(formData.get("eventId") ?? "");
    if (isId(eventId)) check(await supabase.from("thesis_events").update({ protocol_id: protocolId }).eq("id", eventId));
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

// --- Appointments and deadlines -----------------------------------------------

export async function saveEvent(formData: FormData) {
  const title = text(formData, "title", 200);
  if (!title) throw new Error("Title missing");
  const time = text(formData, "time", 5);
  const { supabase } = await db();
  const row = {
    kind: formData.get("kind") === "deadline" ? "deadline" : "appointment",
    title,
    date: date(formData, "date"),
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : null,
    location: text(formData, "location", 200),
    note: longText(formData, "note", 2000),
    person_ids: await personIds(supabase, formData),
  };
  const eventId = String(formData.get("eventId") ?? "");
  if (eventId) {
    check(await supabase.from("thesis_events").update(row).eq("id", eventId));
  } else {
    check(await supabase.from("thesis_events").insert(row));
  }
  revalidatePath(PATH);
}

export async function deleteEvent(formData: FormData) {
  const { supabase } = await db();
  check(await supabase.from("thesis_events").delete().eq("id", String(formData.get("eventId"))));
  revalidatePath(PATH);
}

// --- General infos ----------------------------------------------------------

export async function addInfo(formData: FormData) {
  const value = text(formData, "text", 500);
  if (!value) return;
  const { supabase } = await db();
  check(await supabase.from("thesis_infos").insert({ text: value }));
  revalidatePath(PATH);
}

export async function updateInfo(id: string, value: string) {
  const trimmed = value.trim().slice(0, 500);
  const { supabase } = await db();
  if (trimmed) check(await supabase.from("thesis_infos").update({ text: trimmed }).eq("id", id));
  else check(await supabase.from("thesis_infos").delete().eq("id", id));
  revalidatePath(PATH);
}

export async function deleteInfo(formData: FormData) {
  const { supabase } = await db();
  check(await supabase.from("thesis_infos").delete().eq("id", String(formData.get("infoId"))));
  revalidatePath(PATH);
}

// --- Documents --------------------------------------------------------------

// The browser uploads the file into "<user id>/…" first; this saves the row
// (or, for an existing document, its new details and maybe a new file).
export async function saveDocument(formData: FormData) {
  const title = text(formData, "title", 200);
  if (!title) throw new Error("Title missing");
  const category = String(formData.get("category"));
  const { supabase, userId } = await db();
  const row = {
    title,
    note: longText(formData, "note", 2000),
    category: documentCategories.some((entry) => entry.value === category) ? category : "other",
    source_id: optionalId(formData, "sourceId"),
    protocol_id: optionalId(formData, "protocolId"),
  };

  const storagePath = String(formData.get("storagePath") ?? "");
  const file = storagePath
    ? {
        storage_path: ownPath(storagePath, userId),
        file_name: text(formData, "fileName", 255) || "Datei",
        mime_type: text(formData, "mimeType", 200) || "application/octet-stream",
        size_bytes: Math.max(0, Math.min(maxDocumentBytes, Math.round(Number(formData.get("sizeBytes")) || 0))),
        file_updated_at: new Date().toISOString(),
      }
    : null;

  let documentId = String(formData.get("documentId") ?? "");
  if (documentId) {
    const { storage_path: oldPath } = check(
      await supabase.from("thesis_documents").select("storage_path").eq("id", documentId).single(),
    );
    check(await supabase.from("thesis_documents").update({ ...row, ...file }).eq("id", documentId));
    // The replaced file is gone for good.
    if (file && oldPath !== file.storage_path) await supabase.storage.from(DOCUMENT_BUCKET).remove([oldPath]);
  } else {
    if (!file) throw new Error("File missing");
    documentId = check(await supabase.from("thesis_documents").insert({ ...row, ...file }).select("id").single()).id;
  }
  revalidatePath(PATH);
  return documentId;
}

// Removes an uploaded file whose row couldn't be saved.
export async function discardUpload(storagePath: string) {
  const { supabase, userId } = await db();
  await supabase.storage.from(DOCUMENT_BUCKET).remove([ownPath(storagePath, userId)]);
}

export async function deleteDocument(formData: FormData) {
  const { supabase } = await db();
  const { storage_path: path } = check(
    await supabase
      .from("thesis_documents")
      .delete()
      .eq("id", String(formData.get("documentId")))
      .select("storage_path")
      .single(),
  );
  await supabase.storage.from(DOCUMENT_BUCKET).remove([path]);
  revalidatePath(PATH);
  redirect(`${PATH}?tab=documents`);
}

function ownPath(path: string, userId: string) {
  if (!path.startsWith(`${userId}/`) || path.includes("..") || path.length > 200) throw new Error("Invalid path");
  return path;
}
