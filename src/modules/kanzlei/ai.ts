// Server only: Claude plans the day and reads chat messages. It only gets
// planning data: 5-digit client numbers, kinds, periods, titles, statuses,
// deadlines and minutes, never the private notes. It never writes: the
// chat returns proposals the user confirms (actions.ts), the plan is a
// suggestion the rules in plan.ts check.
import Anthropic from "@anthropic-ai/sdk";
import {
  formatMinutes,
  orderStatuses,
  statusLabel,
  taskStatuses,
  type DayPlan,
  type Item,
  type ItemInput,
  type PlanEntry,
} from "./data";
import { basePlan, dayCapacity, deadlineRisks, isActionable, isOpen, weekLoads, type PlanData } from "./plan";

const MODEL = "claude-opus-5-5";

const client = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
export const hasAiKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

function aiError(error: unknown) {
  if (error instanceof Anthropic.RateLimitError) return "Die KI ist gerade ausgelastet. Versuch es gleich noch einmal.";
  if (error instanceof Anthropic.BadRequestError) {
    console.error("Kanzlei AI request rejected:", error.message);
    return `Die KI hat die Anfrage abgelehnt (400: ${error.message.slice(0, 200)}).`;
  }
  if (error instanceof Anthropic.APIError) return `Die KI ist nicht erreichbar (${error.status ?? "Fehler"}).`;
  if (error instanceof SyntaxError) return "Die Antwort der KI war unvollständig.";
  if (error instanceof Error) return error.message;
  return "Die KI ist nicht erreichbar.";
}

async function ask<T>(system: string, messages: Anthropic.Beta.BetaMessageParam[], schema: Record<string, unknown>, effort: "low" | "medium") {
  if (!hasAiKey()) throw new Error("Für die KI braucht es einen ANTHROPIC_API_KEY.");
  try {
    const response = await client()
      .beta.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort, format: { type: "json_schema", schema } },
        system,
        messages,
      })
      .finalMessage();
    if (response.stop_reason === "refusal") throw new Error("Die KI hat die Anfrage abgelehnt.");
    if (response.stop_reason !== "end_turn") throw new Error("Die KI hat keine vollständige Antwort geliefert.");
    const text = response.content.find((block) => block.type === "text");
    if (!text || text.type !== "text") throw new Error("Die KI hat keine Antwort geliefert.");
    return JSON.parse(text.text) as T;
  } catch (error) {
    throw new Error(aiError(error));
  }
}

// --- What Claude sees -----------------------------------------------------------

// Items get short references (#1, #2, …) instead of their ids.
function context(data: PlanData, today: string) {
  const byId = new Map(data.items.map((item) => [item.id, item]));
  const open = data.items.filter(isOpen);
  const refs = new Map(open.map((item, index) => [item.id, `#${index + 1}`]));
  const typeName = (id: string | null) => data.types.find((type) => type.id === id)?.name ?? "";
  const line = (item: Item) =>
    [
      refs.get(item.id),
      item.kind === "auftrag" ? "Auftrag" : "Aufgabe",
      item.client && `Mandant ${item.client}`,
      typeName(item.typeId),
      item.period,
      item.title && `„${item.title}“`,
      `Status ${statusLabel(item.status)}`,
      item.priority === 1 ? "dringend" : item.priority === 3 ? "niedrig" : "",
      item.deadlineInternal && `Frist intern ${item.deadlineInternal}`,
      item.deadlineLegal && `Frist gesetzlich ${item.deadlineLegal}`,
      `Rest ${item.remaining || item.estimate} min${item.estimate ? ` von ${item.estimate}` : ""}`,
      item.docsAt && `Unterlagen ${item.docsAt}`,
      item.followUp && `Wiedervorlage ${item.followUp}`,
      item.plannedFor && `fest geplant ${item.plannedFor}`,
      item.dependsOn && refs.get(item.dependsOn) && `wartet auf ${refs.get(item.dependsOn)}`,
      item.parentId && refs.get(item.parentId) && `gehört zu ${refs.get(item.parentId)}`,
      item.nextStep && `nächster Schritt: ${item.nextStep}`,
      isActionable(item, today, byId) ? "heute bearbeitbar" : "heute nicht bearbeitbar",
    ]
      .filter(Boolean)
      .join(" · ");
  const capacity = dayCapacity(today, data.settings, data.absences);
  const weeks = weekLoads(data, today, 10)
    .map((week) => `KW ab ${week.monday}: Last ${Math.round(week.load / 60)} h (davon Prognose ${Math.round((week.waiting + week.forecast) / 60)} h), Kapazität ${Math.round(week.capacity / 60)} h`)
    .join("\n");
  const risks = deadlineRisks(data, today)
    .map((risk) => `Bis ${risk.deadline} fehlen ${Math.round(risk.missing / 60)} h`)
    .join("\n");
  const text = `Heute: ${today}
Kapazität heute: ${formatMinutes(capacity.total)} netto, davon Aufträge ${formatMinutes(capacity.orders)}, Tagesgeschäft ${formatMinutes(capacity.daily)}, Puffer ${formatMinutes(capacity.buffer)}.
Arten: ${data.types.map((type) => `${type.name} (${type.kind})`).join(", ")}

Offene Aufträge und Aufgaben:
${open.map(line).join("\n") || "(keine)"}

Auslastung der Aufträge, nächste Wochen:
${weeks}
${risks ? `\nFristrisiken:\n${risks}` : ""}`;
  return { text, refs, byRef: new Map([...refs].map(([id, ref]) => [ref, id])) };
}

// --- Day plan -----------------------------------------------------------------------

const entrySchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      ref: { type: "string", description: "Reference like #3" },
      minutes: { type: "integer", description: "Minutes planned for it today" },
      reason: { type: "string", description: "One short German sentence why now" },
    },
    required: ["ref", "minutes", "reason"],
    additionalProperties: false,
  },
} as const;

const planSchema = {
  type: "object",
  properties: {
    summary: { type: "string", description: "One or two short German sentences: what today is about" },
    must: entrySchema,
    focus: entrySchema,
    optional: entrySchema,
    warnings: { type: "array", items: { type: "string" }, description: "Short German warnings with a concrete recommendation" },
  },
  required: ["summary", "must", "focus", "optional", "warnings"],
  additionalProperties: false,
} as const;

const planSystem = `You plan the working day of an employee of a German tax office (Steuerkanzlei). Answer in German, short and factual, using "du".
Groups: "must" = has to be done today (deadline today or tomorrow, fixed for today, due Wiedervorlage, urgent). "focus" = the main work of the day. "optional" = if time is left, in this order.
Rules:
- Only plan items marked "heute bearbeitbar". Use each reference at most once.
- Orders (Auftrag) use the orders capacity, small tasks (Aufgabe) the daily-business capacity. Never plan more than the capacity; leave the buffer free. Prefer chunks of 1–3 hours for big orders.
- Order "must" by deadline, then bundle similar work (several Lohn, several FiBu) instead of switching between kinds.
- Weigh deadlines, urgency, remaining effort, dependencies, documents received, work already started and the load of the coming weeks: if a week is overloaded, pull work forward now.
- Deadlines are given; never invent or change one.
- A starting point computed by rules is given; improve it, don't just copy it.`;

type RawPlan = { summary: string; must: RawEntry[]; focus: RawEntry[]; optional: RawEntry[]; warnings: string[] };
type RawEntry = { ref: string; minutes: number; reason: string };

export async function planDayWithAi(data: PlanData, today: string): Promise<DayPlan> {
  const { text, byRef, refs } = context(data, today);
  const base = basePlan(data, today);
  const show = (entries: PlanEntry[]) => entries.map((entry) => `${refs.get(entry.id)} ${entry.minutes} min`).join(", ") || "–";
  const raw = await ask<RawPlan>(
    planSystem,
    [
      {
        role: "user",
        content: `${text}\n\nStartpunkt nach Regeln:\nmust: ${show(base.must)}\nfocus: ${show(base.focus)}\noptional: ${show(base.optional)}\n\nErstelle den Tagesplan.`,
      },
    ],
    planSchema,
    "medium",
  );
  const byId = new Map(data.items.map((item) => [item.id, item]));
  const used = new Set<string>();
  const entries = (list: RawEntry[]): PlanEntry[] =>
    list.flatMap((entry) => {
      const id = byRef.get(entry.ref.trim());
      const item = id ? byId.get(id) : undefined;
      if (!id || !item || used.has(id) || !isActionable(item, today, byId)) return [];
      used.add(id);
      return [{ id, minutes: Math.max(5, Math.min(600, Math.round(entry.minutes) || 30)), reason: String(entry.reason).slice(0, 240) }];
    });
  return {
    day: today,
    createdAt: new Date().toISOString(),
    source: "ki",
    summary: String(raw.summary).slice(0, 400),
    must: entries(raw.must),
    focus: entries(raw.focus),
    optional: entries(raw.optional),
    warnings: raw.warnings.slice(0, 5).map((warning) => String(warning).slice(0, 300)),
  };
}

// --- Chat -------------------------------------------------------------------------------

const nullable = (type: string, extra: Record<string, unknown> = {}) => ({ type: [type, "null"], ...extra });
const statusIds = [...orderStatuses, ...taskStatuses].map((status) => status.id);

const chatSchema = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Short German answer: what you understood, a question if something is unclear, and what to do next" },
    changes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update"] },
          ref: nullable("string", { description: "For update: the reference like #3" }),
          summary: { type: "string", description: "One short German line describing the change" },
          kind: nullable("string", { enum: ["auftrag", "aufgabe", null] }),
          client: nullable("string", { description: "5-digit client number" }),
          type: nullable("string", { description: "Name of one of the given kinds" }),
          title: nullable("string"),
          period: nullable("string", { description: "e.g. 11/2026, Q4/2026, 2025" }),
          status: nullable("string", { enum: [...statusIds, null] }),
          priority: nullable("integer", { description: "1 urgent, 2 normal, 3 low" }),
          deadlineInternal: nullable("string", { description: "YYYY-MM-DD, only if the user named it" }),
          deadlineLegal: nullable("string", { description: "YYYY-MM-DD, only if the user named it" }),
          estimate: nullable("integer", { description: "Minutes" }),
          remaining: nullable("integer", { description: "Minutes still to do" }),
          docsAt: nullable("string", { description: "YYYY-MM-DD documents arrived" }),
          followUp: nullable("string", { description: "YYYY-MM-DD Wiedervorlage" }),
          plannedFor: nullable("string", { description: "YYYY-MM-DD fixed day" }),
          nextStep: nullable("string"),
        },
        required: [
          "action", "ref", "summary", "kind", "client", "type", "title", "period", "status", "priority", "deadlineInternal",
          "deadlineLegal", "estimate", "remaining", "docsAt", "followUp", "plannedFor", "nextStep",
        ],
        additionalProperties: false,
      },
    },
    replan: { type: "boolean", description: "true if today's plan should be made again because of this" },
  },
  required: ["reply", "changes", "replan"],
  additionalProperties: false,
} as const;

const chatSystem = (followupDays: number, taskMinutes: number) => `You keep the order list of an employee of a German tax office up to date from short chat messages. Answer in German with "du", short.
Clients are 5-digit numbers. Orders (Auftrag) are client jobs like FiBu, Lohn, Jahresabschluss, EÜR, ESt. Tasks (Aufgabe) are smaller things that take longer than a day to settle: e-mails, questions, talks with the boss, calls, internal work, reminders.
Turn the message into changes:
- Match existing items by client number, kind and period; use update with their reference. Several changes in one message are fine.
- "fertig" / "erledigt" → status erledigt, remaining 0. Time spent is not tracked; only set remaining when the user says how much is left.
- Documents arrived → status bearbeitbar (or teilweise), docsAt today. "angefangen" → in_bearbeitung.
- Question sent to the client → warte_rueckmeldung; handed to the boss → kontrolle; both with followUp ${followupDays} workdays later unless the user names a date.
- New task without an estimate: ${taskMinutes} minutes. New order: use the kind's usual effort only if the user gives none.
- Never invent a deadline. Set deadlines only when the user names one ("bis morgen" means tomorrow's date as deadlineInternal).
- Fill only fields that change; null for the rest. Titles stay short; no names of people.
- If you are not sure which item is meant, or important facts are missing, ask in "reply" and propose no change for it.
- Small things done the same day ("viel nebenbei gemacht") are not recorded; set replan true instead.`;

export type ChatChange = {
  action: "create" | "update";
  itemId: string | null;
  summary: string;
  fields: Partial<ItemInput>;
};

export type ChatTurn = { role: "user" | "assistant"; text: string };

type RawChange = {
  action: "create" | "update";
  ref: string | null;
  summary: string;
  kind: "auftrag" | "aufgabe" | null;
  client: string | null;
  type: string | null;
  title: string | null;
  period: string | null;
  status: string | null;
  priority: number | null;
  deadlineInternal: string | null;
  deadlineLegal: string | null;
  estimate: number | null;
  remaining: number | null;
  docsAt: string | null;
  followUp: string | null;
  plannedFor: string | null;
  nextStep: string | null;
};

export async function readMessage(data: PlanData, today: string, history: ChatTurn[], message: string) {
  const { text, byRef } = context(data, today);
  const earlier = history
    .slice(-6)
    .map((turn) => `${turn.role === "user" ? "Ich" : "Du"}: ${turn.text}`)
    .join("\n");
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `${text}\n\n${earlier ? `Bisheriger Chat:\n${earlier}\n\n` : ""}Neue Nachricht:\n${message}`,
    },
  ];
  const raw = await ask<{ reply: string; changes: RawChange[]; replan: boolean }>(
    chatSystem(data.settings.followupWorkdays, data.settings.taskMinutes),
    messages,
    chatSchema,
    "low",
  );
  const typeByName = (name: string | null) =>
    name ? data.types.find((type) => type.name.toLowerCase() === name.trim().toLowerCase()) : undefined;
  const changes: ChatChange[] = raw.changes.flatMap((change) => {
    const itemId = change.ref ? (byRef.get(change.ref.trim()) ?? null) : null;
    if (change.action === "update" && !itemId) return [];
    const fields: Partial<ItemInput> = {};
    const type = typeByName(change.type);
    if (change.kind) fields.kind = change.kind;
    if (type) {
      fields.typeId = type.id;
      if (!change.kind) fields.kind = type.kind;
    }
    if (change.client !== null) fields.client = change.client;
    if (change.title !== null) fields.title = change.title;
    if (change.period !== null) fields.period = change.period;
    if (change.status !== null && statusIds.includes(change.status as never)) fields.status = change.status as ItemInput["status"];
    if (change.priority === 1 || change.priority === 2 || change.priority === 3) fields.priority = change.priority;
    if (change.deadlineInternal !== null) fields.deadlineInternal = change.deadlineInternal;
    if (change.deadlineLegal !== null) fields.deadlineLegal = change.deadlineLegal;
    if (change.estimate !== null) fields.estimate = change.estimate;
    if (change.remaining !== null) fields.remaining = change.remaining;
    if (change.docsAt !== null) fields.docsAt = change.docsAt;
    if (change.followUp !== null) fields.followUp = change.followUp;
    if (change.plannedFor !== null) fields.plannedFor = change.plannedFor;
    if (change.nextStep !== null) fields.nextStep = change.nextStep;
    if (change.action === "create") {
      fields.kind = fields.kind ?? "aufgabe";
      if (fields.estimate === undefined) fields.estimate = type?.defaultMinutes ?? (fields.kind === "aufgabe" ? data.settings.taskMinutes : 60);
      if (fields.remaining === undefined) fields.remaining = fields.estimate;
      if (!fields.typeId) {
        const fallback = data.types.find((entry) => entry.kind === fields.kind && /sonstig|spontan/i.test(entry.name));
        if (fallback) fields.typeId = fallback.id;
      }
    }
    return [{ action: change.action, itemId, summary: String(change.summary).slice(0, 200), fields }];
  });
  return { reply: String(raw.reply).slice(0, 2000), changes, replan: Boolean(raw.replan) };
}
