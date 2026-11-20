"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PlanChange, Settings } from "./types";

// Writes go through security definer functions that check module access
// (see supabase/migrations/*_sport_dashboard_v2.sql).

async function db() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return createClient();
}

const clamp = (value: unknown, min: number, max: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : undefined;
};

export async function saveSettings(input: Partial<Settings>) {
  const patch: Record<string, unknown> = {};
  if (input.sleepMinH !== undefined) patch.sleepMinH = clamp(input.sleepMinH, 3, 12);
  if (input.sleepMaxH !== undefined) patch.sleepMaxH = clamp(input.sleepMaxH, 3, 14);
  if (input.sleepGoalH !== undefined) patch.sleepGoalH = clamp(input.sleepGoalH, 3, 12);
  if (input.gymPerWeek !== undefined) patch.gymPerWeek = clamp(Math.round(input.gymPerWeek), 0, 7);
  if (input.zone1GoalPct !== undefined) patch.zone1GoalPct = clamp(Math.round(input.zone1GoalPct), 0, 100);
  if (input.stepsGoal !== undefined) patch.stepsGoal = input.stepsGoal === null ? null : clamp(Math.round(input.stepsGoal), 1000, 50000);
  if (input.planStart !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(input.planStart)) patch.planStart = input.planStart;
  if (input.planChanges !== undefined) {
    patch.planChanges = (input.planChanges as PlanChange[])
      .filter((change) => Number.isInteger(change.week) && (change.action === "repeat" || change.action === "skip"))
      .slice(0, 60)
      .map((change) => ({ week: change.week, action: change.action }));
  }
  if (input.notifyMorning !== undefined) patch.notifyMorning = Boolean(input.notifyMorning);
  if (input.notifyMorningHour !== undefined) patch.notifyMorningHour = clamp(Math.round(input.notifyMorningHour), 4, 11);
  if (input.notifyWeekly !== undefined) patch.notifyWeekly = Boolean(input.notifyWeekly);
  const supabase = await db();
  const { error } = await supabase.rpc("sport_save_settings", { p: patch });
  if (error) throw new Error(error.message);
}

export async function savePushSubscription(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, origin: string) {
  let endpoint: URL;
  let app: URL;
  try {
    endpoint = new URL(subscription.endpoint);
    app = new URL(origin);
  } catch {
    throw new Error("Ungültige Subscription.");
  }
  if (endpoint.protocol !== "https:" || !subscription.keys?.p256dh || !subscription.keys?.auth) throw new Error("Ungültige Subscription.");
  if (app.protocol !== "https:") throw new Error("Erinnerungen gehen nur über https (die installierte App), nicht lokal.");
  const supabase = await db();
  const { error } = await supabase.rpc("sport_save_push", {
    p_endpoint: subscription.endpoint,
    p_p256dh: subscription.keys.p256dh,
    p_auth: subscription.keys.auth,
    p_app_url: app.origin,
  });
  if (error) throw new Error(error.message);
}

export async function deletePushSubscription(endpoint: string) {
  const supabase = await db();
  const { error } = await supabase.rpc("sport_delete_push", { p_endpoint: endpoint });
  if (error) throw new Error(error.message);
}
