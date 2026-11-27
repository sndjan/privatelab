// Server only: reads the whole planner for the user's own Supabase client
// (RLS limits it to their rows), sets up a new user and creates the orders
// recurring templates are due for. Used by the loader and the actions.
import { createClient } from "@/lib/supabase/server";
import { todayInGermany } from "@/modules/worktime/calc";
import {
  itemColumns,
  itemFromRow,
  recurringColumns,
  recurringFromRow,
  settingsColumns,
  settingsFromRow,
  starterTypes,
  type Absence,
  type DayPlan,
  type HistoryEntry,
  type ItemRow,
  type RecurringRow,
  type SettingsRow,
  type TypeDef,
} from "./data";
import { occurrences, periodOf } from "./plan";

export type Supabase = Awaited<ReturnType<typeof createClient>>;

export function check<T>({ data, error }: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

export async function recordHistory(
  supabase: Supabase,
  entry: { itemId: string | null; source: "user" | "ki" | "auto"; summary: string; before: unknown; after: unknown },
) {
  check(
    await supabase.from("kanzlei_history").insert({
      item_id: entry.itemId,
      source: entry.source,
      summary: entry.summary.slice(0, 300),
      before: entry.before ?? null,
      after: entry.after ?? null,
    }),
  );
}

// A user's first visit: default settings and the starter types.
async function ensureSetup(supabase: Supabase) {
  const { data } = await supabase.from("kanzlei_settings").select("user_id").maybeSingle();
  if (data) return;
  const { error } = await supabase.from("kanzlei_settings").insert({});
  // Another request may have set up at the same moment.
  if (error) return;
  check(
    await supabase.from("kanzlei_types").insert(
      starterTypes.map((type, position) => ({
        name: type.name,
        kind: type.kind,
        default_minutes: type.defaultMinutes,
        color: type.color,
        position,
      })),
    ),
  );
}

// Creates an order for every period of an active template that has started,
// and moves the template on to its next period.
async function syncRecurring(supabase: Supabase, today: string) {
  const templates = ((await supabase.from("kanzlei_recurring").select(recurringColumns).eq("active", true)).data ??
    []) as RecurringRow[];
  for (const row of templates) {
    const template = recurringFromRow(row);
    const due = occurrences(template, today, 24);
    if (due.length === 0) continue;
    const existing = new Set(
      (((await supabase.from("kanzlei_items").select("period").eq("recurring_id", template.id)).data ?? []) as { period: string }[]).map(
        (item) => item.period,
      ),
    );
    const rows = due
      .filter((occurrence) => !existing.has(occurrence.period))
      .map((occurrence) => ({
        kind: "auftrag",
        client: template.client,
        type_id: template.typeId,
        title: template.title,
        period: occurrence.period,
        status: "warte_unterlagen",
        deadline_internal: occurrence.deadlineInternal,
        deadline_legal: occurrence.deadlineLegal,
        estimate_minutes: template.estimate,
        remaining_minutes: template.estimate,
        recurring_id: template.id,
      }));
    if (rows.length > 0) {
      const created = check(await supabase.from("kanzlei_items").insert(rows).select("id, period"));
      for (const item of created as { id: string; period: string }[]) {
        await recordHistory(supabase, {
          itemId: item.id,
          source: "auto",
          summary: `Wiederkehrend angelegt: ${template.title || "Auftrag"} ${item.period}${template.client ? ` · ${template.client}` : ""}`,
          before: null,
          after: { id: item.id },
        });
      }
    }
    const last = due[due.length - 1];
    check(
      await supabase
        .from("kanzlei_recurring")
        .update({ next_period: periodOf(last.periodStart, template.rhythm).next })
        .eq("id", template.id),
    );
  }
}

export async function loadAll(supabase: Supabase) {
  const today = todayInGermany();
  await ensureSetup(supabase);
  await syncRecurring(supabase, today);
  const [settings, types, items, recurring, absences, history, plan] = await Promise.all([
    supabase.from("kanzlei_settings").select(settingsColumns).maybeSingle(),
    supabase.from("kanzlei_types").select("id, name, kind, default_minutes, color, position").order("position").order("created_at"),
    supabase.from("kanzlei_items").select(itemColumns).order("created_at"),
    supabase.from("kanzlei_recurring").select(recurringColumns).order("created_at"),
    supabase.from("kanzlei_absences").select("id, start_date, end_date, label").order("start_date"),
    supabase
      .from("kanzlei_history")
      .select("id, item_id, source, summary, undone, created_at, before")
      .order("created_at", { ascending: false })
      .limit(150),
    supabase.from("kanzlei_plans").select("plan").eq("day", today).maybeSingle(),
  ]);
  return {
    today,
    hasAi: Boolean(process.env.ANTHROPIC_API_KEY),
    settings: settingsFromRow(settings.data as SettingsRow | null),
    types: ((types.data ?? []) as { id: string; name: string; kind: "auftrag" | "aufgabe"; default_minutes: number; color: string; position: number }[]).map(
      (row): TypeDef => ({ id: row.id, name: row.name, kind: row.kind, defaultMinutes: row.default_minutes, color: row.color, position: row.position }),
    ),
    items: ((items.data ?? []) as ItemRow[]).map(itemFromRow),
    recurring: ((recurring.data ?? []) as RecurringRow[]).map(recurringFromRow),
    absences: ((absences.data ?? []) as { id: string; start_date: string; end_date: string; label: string }[]).map(
      (row): Absence => ({ id: row.id, startDate: row.start_date, endDate: row.end_date, label: row.label }),
    ),
    history: (
      (history.data ?? []) as { id: string; item_id: string | null; source: "user" | "ki" | "auto"; summary: string; undone: boolean; created_at: string }[]
    ).map(
      (row): HistoryEntry => ({ id: row.id, itemId: row.item_id, source: row.source, summary: row.summary, undone: row.undone, createdAt: row.created_at }),
    ),
    plan: ((plan.data as { plan: DayPlan } | null)?.plan ?? null) as DayPlan | null,
  };
}
