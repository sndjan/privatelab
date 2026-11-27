"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInGermany } from "@/modules/worktime/calc";
import { planDayWithAi, readMessage, type ChatChange, type ChatTurn } from "./ai";
import {
  cleanItemInput,
  cleanRecurringInput,
  cleanSettings,
  cleanTypeInput,
  formatMinutes,
  isDate,
  itemColumns,
  itemFromRow,
  itemToRow,
  recurringToRow,
  settingsToRow,
  statusLabel,
  type DayPlan,
  type ItemInput,
  type ItemRow,
  type RecurringInput,
  type Settings,
  type TypeInput,
} from "./data";
import { addWorkdays, itemLabel } from "./plan";
import { check, loadAll, recordHistory, type Supabase } from "./server";

// Every write goes through the user's own Supabase client, so RLS enforces
// ownership and access to the 'kanzlei' module, and every change to an item
// lands in kanzlei_history with the row before and after (for undo).

const MODULE = "kanzlei";
const PATH = "/m/kanzlei";
type Result<T = object> = (T & { error?: undefined }) | { error: string };

async function requireAccess() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const supabase = await createClient();
  if (!user.isAdmin) {
    const access = check(
      await supabase.from("module_access").select("module_id").eq("user_id", user.id).eq("module_id", MODULE).maybeSingle(),
    );
    if (!access) throw new Error("No access");
  }
  return supabase;
}

async function typeNames(supabase: Supabase) {
  const rows = ((await supabase.from("kanzlei_types").select("id, name, kind, default_minutes, color, position")).data ?? []) as {
    id: string;
    name: string;
    kind: "auftrag" | "aufgabe";
    default_minutes: number;
    color: string;
    position: number;
  }[];
  return rows.map((row) => ({ id: row.id, name: row.name, kind: row.kind, defaultMinutes: row.default_minutes, color: row.color, position: row.position }));
}

async function getRow(supabase: Supabase, id: string) {
  return check(await supabase.from("kanzlei_items").select(itemColumns).eq("id", id).single<ItemRow>());
}

async function label(supabase: Supabase, row: ItemRow) {
  return itemLabel(itemFromRow(row), await typeNames(supabase));
}

// Writes an update and its history entry. `patch` holds the changed columns.
async function updateRow(supabase: Supabase, id: string, patch: Record<string, unknown>, summary: string, source: "user" | "ki" | "auto") {
  const before = await getRow(supabase, id);
  const after = check(
    await supabase
      .from("kanzlei_items")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(itemColumns)
      .single<ItemRow>(),
  );
  await recordHistory(supabase, { itemId: id, source, summary: `${await label(supabase, after)}: ${summary}`, before, after });
  return after;
}

const doneFields = (status: string, previous: ItemRow) =>
  status === "erledigt"
    ? { done_at: previous.done_at ?? new Date().toISOString(), remaining_minutes: 0, planned_for: null, follow_up: null }
    : { done_at: null };

// --- Items -------------------------------------------------------------------------

export async function saveItem(id: string | null, input: Partial<ItemInput>): Promise<Result<{ id: string }>> {
  try {
    const supabase = await requireAccess();
    const item = cleanItemInput(input);
    if (id) {
      const before = await getRow(supabase, id);
      await updateRow(supabase, id, { ...itemToRow(item), ...doneFields(item.status, before) }, "bearbeitet", "user");
      revalidatePath(PATH);
      return { id };
    }
    const row = check(
      await supabase
        .from("kanzlei_items")
        .insert({ ...itemToRow(item), done_at: item.status === "erledigt" ? new Date().toISOString() : null })
        .select(itemColumns)
        .single<ItemRow>(),
    );
    await recordHistory(supabase, { itemId: row.id, source: "user", summary: `Angelegt: ${await label(supabase, row)}`, before: null, after: row });
    revalidatePath(PATH);
    return { id: row.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Speichern hat nicht geklappt." };
  }
}

export async function deleteItem(id: string) {
  const supabase = await requireAccess();
  const before = await getRow(supabase, id);
  check(await supabase.from("kanzlei_items").delete().eq("id", id));
  await recordHistory(supabase, { itemId: id, source: "user", summary: `Gelöscht: ${await label(supabase, before)}`, before, after: null });
  revalidatePath(PATH);
}

export type QuickAction = "begin" | "done" | "docs" | "docs_partial" | "query" | "control" | "rework" | "reopen" | "followup" | "remaining" | "pin" | "unpin";

async function followUpDate(supabase: Supabase) {
  const data = await loadSettingsAndAbsences(supabase);
  return addWorkdays(todayInGermany(), data.settings.followupWorkdays, data.settings, data.absences);
}

async function loadSettingsAndAbsences(supabase: Supabase) {
  const all = await loadAll(supabase);
  return { settings: all.settings, absences: all.absences };
}

// The buttons: one tap changes status, Wiedervorlage or remaining effort.
export async function quickAction(id: string, action: QuickAction, value?: string | number | null) {
  const supabase = await requireAccess();
  const before = await getRow(supabase, id);
  const today = todayInGermany();
  const task = before.kind === "aufgabe";
  let patch: Record<string, unknown> = {};
  let summary = "";
  switch (action) {
    case "begin":
      patch = { status: task ? "offen" : "in_bearbeitung", follow_up: null };
      summary = "Bearbeitung begonnen";
      break;
    case "done":
      patch = { status: "erledigt", ...doneFields("erledigt", before) };
      summary = "erledigt";
      break;
    case "docs":
    case "docs_partial":
      patch = { status: action === "docs" ? "bearbeitbar" : "teilweise", docs_at: today, follow_up: null };
      summary = action === "docs" ? "Unterlagen eingegangen" : "Unterlagen teilweise eingegangen";
      break;
    case "query":
    case "control": {
      const date = isDate(value) ? value : await followUpDate(supabase);
      patch = { status: task ? "wartet" : action === "query" ? "warte_rueckmeldung" : "kontrolle", follow_up: date, planned_for: null };
      summary = `${action === "query" ? "Rückfrage gestellt" : "Zur Kontrolle beim Chef"}, Wiedervorlage ${date.split("-").reverse().join(".")}`;
      break;
    }
    case "rework":
      patch = { status: task ? "offen" : "nachbearbeitung", follow_up: null };
      summary = "Nachbearbeitung";
      break;
    case "reopen":
      patch = { status: task ? "offen" : "bearbeitbar", done_at: null };
      summary = "wieder geöffnet";
      break;
    case "followup": {
      const date = isDate(value) ? value : value === null ? null : await followUpDate(supabase);
      patch = { follow_up: date };
      summary = date ? `Wiedervorlage ${date.split("-").reverse().join(".")}` : "Wiedervorlage entfernt";
      break;
    }
    case "remaining": {
      const minutes = Math.max(0, Math.min(100000, Math.round(Number(value) || 0)));
      patch = { remaining_minutes: minutes, ...(before.estimate_minutes < minutes ? { estimate_minutes: minutes } : {}) };
      summary = `Restaufwand ${formatMinutes(minutes)}`;
      break;
    }
    case "pin":
      patch = { planned_for: isDate(value) ? value : today };
      summary = `fest eingeplant für ${String(patch.planned_for).split("-").reverse().join(".")}`;
      break;
    case "unpin":
      patch = { planned_for: null };
      summary = "nicht mehr fest eingeplant";
      break;
  }
  await updateRow(supabase, id, patch, summary, "user");
  revalidatePath(PATH);
}

// Sammeländerung: the same fields for many items. `undefined` leaves a field
// as it is, `null` clears it.
export type BulkPatch = {
  status?: string;
  deadlineLegal?: string | null;
  deadlineInternal?: string | null;
  followUp?: string | null;
  plannedFor?: string | null;
  priority?: 1 | 2 | 3;
};

export async function bulkUpdate(ids: string[], patch: BulkPatch) {
  const supabase = await requireAccess();
  const date = (value: string | null | undefined) => (value === null ? null : isDate(value) ? value : undefined);
  const columns: Record<string, unknown> = {};
  const parts: string[] = [];
  if (date(patch.deadlineLegal) !== undefined) {
    columns.deadline_legal = date(patch.deadlineLegal);
    parts.push(`Frist gesetzlich ${patch.deadlineLegal ? patch.deadlineLegal.split("-").reverse().join(".") : "entfernt"}`);
  }
  if (date(patch.deadlineInternal) !== undefined) {
    columns.deadline_internal = date(patch.deadlineInternal);
    parts.push(`Frist intern ${patch.deadlineInternal ? patch.deadlineInternal.split("-").reverse().join(".") : "entfernt"}`);
  }
  if (date(patch.followUp) !== undefined) {
    columns.follow_up = date(patch.followUp);
    parts.push(`Wiedervorlage ${patch.followUp ? patch.followUp.split("-").reverse().join(".") : "entfernt"}`);
  }
  if (date(patch.plannedFor) !== undefined) {
    columns.planned_for = date(patch.plannedFor);
    parts.push(patch.plannedFor ? `fest eingeplant ${patch.plannedFor.split("-").reverse().join(".")}` : "nicht mehr fest eingeplant");
  }
  if (patch.priority === 1 || patch.priority === 2 || patch.priority === 3) {
    columns.priority = patch.priority;
    parts.push(`Priorität ${patch.priority === 1 ? "dringend" : patch.priority === 2 ? "normal" : "niedrig"}`);
  }
  for (const id of ids.slice(0, 500)) {
    const before = await getRow(supabase, id);
    const row: Record<string, unknown> = { ...columns };
    const itemParts = [...parts];
    if (patch.status) {
      const valid = cleanItemInput({ kind: before.kind, status: patch.status as ItemInput["status"] }).status === patch.status;
      if (valid) {
        row.status = patch.status;
        Object.assign(row, doneFields(patch.status, before));
        itemParts.push(`Status ${statusLabel(patch.status)}`);
      }
    }
    if (Object.keys(row).length === 0) continue;
    await updateRow(supabase, id, row, `Sammeländerung: ${itemParts.join(", ")}`, "user");
  }
  revalidatePath(PATH);
}

// --- History -------------------------------------------------------------------------

const restorable = (row: ItemRow) => {
  const rest: Partial<ItemRow> = { ...row };
  delete rest.id;
  delete rest.created_at;
  return { ...rest, updated_at: new Date().toISOString() };
};

export async function undo(historyId: string) {
  const supabase = await requireAccess();
  const entry = check(
    await supabase.from("kanzlei_history").select("id, item_id, summary, before, after, undone").eq("id", historyId).single<{
      id: string;
      item_id: string | null;
      summary: string;
      before: ItemRow | null;
      after: (ItemRow & { id: string }) | null;
      undone: boolean;
    }>(),
  );
  if (entry.undone) return;
  if (!entry.before && entry.after?.id) {
    // Created: remove it again.
    check(await supabase.from("kanzlei_items").delete().eq("id", entry.after.id));
  } else if (entry.before && !entry.after) {
    // Deleted: put it back with its old id.
    check(await supabase.from("kanzlei_items").insert({ ...restorable(entry.before), id: entry.before.id, created_at: entry.before.created_at }));
  } else if (entry.before) {
    check(await supabase.from("kanzlei_items").update(restorable(entry.before)).eq("id", entry.before.id));
  }
  check(await supabase.from("kanzlei_history").update({ undone: true }).eq("id", entry.id));
  await recordHistory(supabase, { itemId: entry.item_id, source: "user", summary: `Rückgängig: ${entry.summary}`, before: null, after: null });
  revalidatePath(PATH);
}

// --- AI ------------------------------------------------------------------------------

export async function makePlan(): Promise<Result<{ plan: DayPlan }>> {
  try {
    const supabase = await requireAccess();
    const data = await loadAll(supabase);
    const plan = await planDayWithAi(data, data.today);
    check(await supabase.from("kanzlei_plans").upsert({ day: data.today, plan, created_at: plan.createdAt }, { onConflict: "user_id,day" }));
    revalidatePath(PATH);
    return { plan };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Planen hat nicht geklappt." };
  }
}

// Back to the plan by rules (drops today's AI plan).
export async function resetPlan() {
  const supabase = await requireAccess();
  check(await supabase.from("kanzlei_plans").delete().eq("day", todayInGermany()));
  revalidatePath(PATH);
}

export async function chat(message: string, history: ChatTurn[]): Promise<Result<{ reply: string; changes: ChatChange[]; replan: boolean }>> {
  try {
    const text = String(message ?? "").trim().slice(0, 4000);
    if (!text) return { error: "Leere Nachricht." };
    const supabase = await requireAccess();
    const data = await loadAll(supabase);
    const turns = (Array.isArray(history) ? history : [])
      .filter((turn) => turn && (turn.role === "user" || turn.role === "assistant"))
      .map((turn) => ({ role: turn.role, text: String(turn.text).slice(0, 2000) }));
    return await readMessage(data, data.today, turns, text);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Die KI hat nicht geantwortet." };
  }
}

// Writes the changes the user confirmed from a chat answer, all at once.
export async function applyChanges(changes: ChatChange[]): Promise<Result<{ count: number }>> {
  try {
    const supabase = await requireAccess();
    let count = 0;
    for (const change of (Array.isArray(changes) ? changes : []).slice(0, 50)) {
      const summary = String(change.summary ?? "").slice(0, 200) || "geändert";
      if (change.action === "update" && change.itemId) {
        const before = await getRow(supabase, change.itemId);
        const merged = cleanItemInput({ ...itemFromRow(before), ...change.fields, kind: before.kind });
        await updateRow(supabase, change.itemId, { ...itemToRow(merged), ...doneFields(merged.status, before) }, `${summary} (KI)`, "ki");
        count++;
      } else if (change.action === "create") {
        const item = cleanItemInput(change.fields);
        const row = check(
          await supabase
            .from("kanzlei_items")
            .insert({ ...itemToRow(item), done_at: item.status === "erledigt" ? new Date().toISOString() : null })
            .select(itemColumns)
            .single<ItemRow>(),
        );
        await recordHistory(supabase, { itemId: row.id, source: "ki", summary: `Angelegt (KI): ${await label(supabase, row)}`, before: null, after: row });
        count++;
      }
    }
    revalidatePath(PATH);
    return { count };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Übernehmen hat nicht geklappt." };
  }
}

// --- Settings, types, recurring orders, absences --------------------------------------

export async function saveSettings(input: Partial<Settings>) {
  const supabase = await requireAccess();
  check(
    await supabase
      .from("kanzlei_settings")
      .upsert({ ...settingsToRow(cleanSettings(input)), updated_at: new Date().toISOString() }, { onConflict: "user_id" }),
  );
  revalidatePath(PATH);
}

export async function saveType(id: string | null, input: Partial<TypeInput>) {
  const supabase = await requireAccess();
  const type = cleanTypeInput(input);
  const row = { name: type.name, kind: type.kind, default_minutes: type.defaultMinutes, color: type.color };
  if (id) check(await supabase.from("kanzlei_types").update(row).eq("id", id));
  else {
    const { data } = await supabase.from("kanzlei_types").select("position").order("position", { ascending: false }).limit(1);
    check(await supabase.from("kanzlei_types").insert({ ...row, position: ((data?.[0]?.position as number | undefined) ?? -1) + 1 }));
  }
  revalidatePath(PATH);
}

export async function deleteType(id: string) {
  const supabase = await requireAccess();
  check(await supabase.from("kanzlei_types").delete().eq("id", id));
  revalidatePath(PATH);
}

export async function saveRecurring(id: string | null, input: Partial<RecurringInput>) {
  const supabase = await requireAccess();
  const row = recurringToRow(cleanRecurringInput(input));
  if (id) check(await supabase.from("kanzlei_recurring").update(row).eq("id", id));
  else check(await supabase.from("kanzlei_recurring").insert(row));
  revalidatePath(PATH);
}

export async function deleteRecurring(id: string) {
  const supabase = await requireAccess();
  check(await supabase.from("kanzlei_recurring").delete().eq("id", id));
  revalidatePath(PATH);
}

export async function saveAbsence(id: string | null, input: { startDate: string; endDate: string; label: string }) {
  const supabase = await requireAccess();
  if (!isDate(input.startDate) || !isDate(input.endDate)) throw new Error("Invalid date");
  const row = {
    start_date: input.startDate,
    end_date: input.endDate < input.startDate ? input.startDate : input.endDate,
    label: String(input.label ?? "").trim().slice(0, 60) || "Urlaub",
  };
  if (id) check(await supabase.from("kanzlei_absences").update(row).eq("id", id));
  else check(await supabase.from("kanzlei_absences").insert(row));
  revalidatePath(PATH);
}

export async function deleteAbsence(id: string) {
  const supabase = await requireAccess();
  check(await supabase.from("kanzlei_absences").delete().eq("id", id));
  revalidatePath(PATH);
}

// Everything of the user as one JSON file (Datensicherung).
export async function exportAll() {
  const supabase = await requireAccess();
  const tables = ["kanzlei_settings", "kanzlei_types", "kanzlei_items", "kanzlei_recurring", "kanzlei_absences", "kanzlei_history", "kanzlei_plans"];
  const result: Record<string, unknown> = { exportedAt: new Date().toISOString() };
  for (const table of tables) result[table] = check(await supabase.from(table).select("*"));
  return JSON.stringify(result, null, 2);
}
