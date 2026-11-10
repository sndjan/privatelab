"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BREAK, menu, TOTAL, type Timer } from "./menu";

// All writes go through the user's own Supabase client, so RLS enforces
// ownership and access to the 'fokus' module. Nothing revalidates the page:
// the timer keeps its own state in the browser and saves in the background.

async function db() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return { supabase: await createClient(), userId: user.id };
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

const clamp = (value: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(value) || 0)));

// Saves the evening that is going on (and starts one if there is none).
// A timer in phase "done" finishes it, so it moves to the history.
export async function saveTimer(timer: Timer): Promise<{ id: string; updatedAt: string }> {
  const { supabase } = await db();
  const phase = timer.phase === "break" || timer.phase === "done" ? timer.phase : "focus";
  const running = phase !== "done" && Boolean(timer.running) && Number.isFinite(timer.anchor);
  const now = new Date().toISOString();
  const row = {
    menu: menu.id,
    phase,
    focus_seconds: phase === "done" ? TOTAL : clamp(timer.focus, TOTAL),
    break_seconds: clamp(timer.pause, BREAK),
    running,
    anchor_at: running ? new Date(timer.anchor as number).toISOString() : null,
    finished_at: phase === "done" ? now : null,
    updated_at: now,
  };
  const open = (await supabase.from("fokus_sessions").select("id").is("finished_at", null).maybeSingle()).data;
  const saved = open
    ? check(await supabase.from("fokus_sessions").update(row).eq("id", open.id).select("id, updated_at").single())
    : check(await supabase.from("fokus_sessions").insert(row).select("id, updated_at").single());
  return { id: saved.id, updatedAt: saved.updated_at };
}

// Throws the unfinished evening away ("neu starten").
export async function discardSession() {
  const { supabase } = await db();
  check(await supabase.from("fokus_sessions").delete().is("finished_at", null).select("id"));
}

export async function saveSettings(settings: { sound: boolean; notify: boolean }) {
  const { supabase, userId } = await db();
  check(
    await supabase
      .from("fokus_settings")
      .upsert({ user_id: userId, sound: Boolean(settings.sound), notify: Boolean(settings.notify), updated_at: new Date().toISOString() })
      .select("user_id"),
  );
}
