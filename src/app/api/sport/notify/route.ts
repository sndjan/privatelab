import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import webpush, { WebPushError, type PushSubscription } from "web-push";
import { createAdminClient } from "@/lib/supabase/server";
import { runLoad, sleepStats } from "@/modules/sport/analytics";
import { addDays, easyPercent, formatKm, formatMinutes, formatNumber, formatSleep, mondayOf, readiness, runWeeks, trainingDays, weekday } from "@/modules/sport/calc";
import { planFromSettings, planWeekOf, plannedDay } from "@/modules/sport/plan";
import type { SportData } from "@/modules/sport/types";

// Called every hour by the pg_cron job sport-notify-hourly (see
// supabase/migrations/*_sport_dashboard_v2.sql) with the Vault secret
// sport_sync_secret. Decides in Berlin time whether a reminder is due:
// mornings the day's plan, Sunday evening a weekly review written by Claude
// Haiku (a few hundred tokens). `?test=morning|weekly` sends one right away.
// POST route handlers are never cached, so no segment config is needed (and
// `dynamic` is not allowed with cacheComponents).

const WEEKLY_HOUR = 19;
const MODEL = "claude-haiku-5-5";

type Context = {
  subscriptions: PushSubscription[];
  sent: { kind: string; day: string }[];
  data: SportData | null;
};

function berlinNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

function morningMessage(data: SportData, today: string) {
  const plan = planFromSettings(data.settings);
  const week = planWeekOf(plan, today);
  const planned = plannedDay(weekday(today), week);
  const ready = readiness(data.health, today);
  const night = [
    ready.hrv ? `HRV ${ready.hrv.value} ms` : null,
    ready.sleep ? `${formatSleep(ready.sleep.value)} Schlaf` : null,
  ].filter(Boolean).join(", ");
  const title = week ? `Heute: ${planned.label}` : "Guten Morgen";
  const body = [
    planned.detail ? `${planned.detail}${planned.kind === "run" ? ", unter 145 bpm" : ""}.` : planned.kind === "free" ? "Heute frei." : null,
    `${ready.headline}${night ? ` ${night}.` : ""}`,
  ].filter(Boolean).join(" ");
  return { title, body, url: "/m/sport" };
}

function weekFacts(data: SportData, today: string) {
  const monday = mondayOf(today);
  const plan = planFromSettings(data.settings);
  const week = planWeekOf(plan, today);
  const [runs] = runWeeks(data.runs, [monday]);
  const days = trainingDays(data.activities, data.workouts);
  let gym = 0;
  let other = 0;
  for (let day = monday; day <= today; day = addDays(day, 1)) {
    if (days.get(day)?.gym) gym += 1;
    if (days.get(day)?.other) other += 1;
  }
  const sleep = sleepStats(data.health, monday, today, data.settings);
  const load = runLoad(data.runs, today);
  const longest = Math.max(0, ...data.runs.filter((run) => run.day >= monday && run.day <= today).map((run) => (run.durationS ?? 0) / 60));
  return {
    planWeek: week ? `Woche ${week.number} von ${plan.length} (${week.phase})` : "noch vor dem Laufplan",
    runs: `${runs.runs} von ${week?.runs ?? 2} Läufen, ${formatKm(runs.km)}, ${formatMinutes(runs.minutes)}`,
    longest: `längster Lauf ${formatMinutes(longest)} (Plan ${week ? formatMinutes(week.longestMinutes) : "–"})`,
    zone1: `Zone 1 ${easyPercent([runs]) != null ? `${formatNumber(easyPercent([runs])!)} %` : "–"} (Ziel ${data.settings.zone1GoalPct} %)`,
    gym: `${gym} von ${week?.gym ?? data.settings.gymPerWeek} Gym-Einheiten`,
    other: other ? `${other} Tage anderer Sport` : null,
    sleep: `Schlaf Ø ${sleep.average != null ? formatSleep(sleep.average * 3600) : "–"} (Ziel ${String(data.settings.sleepGoalH).replace(".", ",")} h), ${sleep.inRange} von ${sleep.nights} Nächten im Bereich`,
    load: `Belastung: ${load.label}`,
  };
}

async function weeklyMessage(data: SportData, today: string) {
  const facts = weekFacts(data, today);
  const lines = Object.values(facts).filter(Boolean) as string[];
  const fallback = { title: "Dein Wochenrückblick", body: lines.slice(1, 5).join(" · "), url: "/m/sport?tab=plan" };
  if (!process.env.ANTHROPIC_API_KEY) return fallback;
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system:
        "Du schreibst einen kurzen Wochenrückblick für eine Push-Nachricht auf Deutsch, per Du, sachlich und freundlich. Höchstens 3 kurze Sätze, zusammen unter 280 Zeichen. Nenne ein, zwei Zahlen aus den Fakten, was gut lief, und einen konkreten Hinweis für nächste Woche aus den Regeln des Plans (locker unter 145 bpm, höchstens 10 % mehr als der längste Lauf der letzten 30 Tage). Keine medizinischen Ratschläge, keine Emojis, nichts erfinden.",
      messages: [{ role: "user", content: `Fakten dieser Woche:\n- ${lines.join("\n- ")}` }],
    });
    const text = response.content.find((block) => block.type === "text");
    if (response.stop_reason !== "end_turn" || !text || text.type !== "text") return fallback;
    return { title: "Dein Wochenrückblick", body: text.text.trim().slice(0, 300), url: "/m/sport?tab=plan" };
  } catch (error) {
    console.error("Sport weekly review: Claude failed", error);
    return fallback;
  }
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-sync-secret");
  const admin = createAdminClient();
  const { data: context, error } = await admin.rpc("sport_notify_context", { p_secret: secret ?? "" });
  if (error || !context) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { subscriptions, sent, data } = context as Context;
  if (!data || subscriptions.length === 0) return NextResponse.json({ sent: [] });

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return NextResponse.json({ error: "VAPID keys missing" }, { status: 500 });
  const { data: owner } = await admin.from("profiles").select("email").eq("is_admin", true).limit(1).maybeSingle();

  const now = berlinNow();
  const test = request.nextUrl.searchParams.get("test");
  const already = (kind: string) => sent.some((entry) => entry.kind === kind && entry.day === now.day);
  const due: ("morning" | "weekly")[] = [];
  if (test === "morning" || (data.settings.notifyMorning && now.hour === data.settings.notifyMorningHour && !already("morning"))) due.push("morning");
  if (test === "weekly" || (data.settings.notifyWeekly && weekday(now.day) === 6 && now.hour === WEEKLY_HOUR && !already("weekly"))) due.push("weekly");

  const results: { kind: string; delivered: number }[] = [];
  for (const kind of due) {
    const message = kind === "morning" ? morningMessage(data, now.day) : await weeklyMessage(data, now.day);
    const expired: string[] = [];
    let delivered = 0;
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(subscription, JSON.stringify(message), {
          vapidDetails: { subject: `mailto:${owner?.email ?? "admin@localhost"}`, publicKey, privateKey },
          TTL: 6 * 3600,
        });
        delivered += 1;
      } catch (pushError) {
        if (pushError instanceof WebPushError && (pushError.statusCode === 404 || pushError.statusCode === 410)) expired.push(subscription.endpoint);
        else console.error("Sport push failed", pushError);
      }
    }
    await admin.rpc("sport_notify_done", {
      p_secret: secret,
      p_kind: test ? `test-${kind}` : kind,
      p_day: now.day,
      p_detail: { title: message.title, body: message.body, delivered },
      p_expired: expired,
    });
    results.push({ kind, delivered });
  }
  return NextResponse.json({ sent: results });
}
