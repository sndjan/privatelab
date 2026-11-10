// Server only. What the browser cache loads for the Fokusküche (see
// src/lib/query/data.ts).
import type { Loader } from "@/lib/query/loaders";
import { createClient } from "@/lib/supabase/server";
import { BREAK, TOTAL, type Phase, type Timer } from "./menu";

export type FokusState = {
  // The evening that is not finished yet, if there is one.
  session: { id: string; timer: Timer; startedAt: string; updatedAt: string } | null;
  // Finished evenings, newest first.
  history: { id: string; finishedAt: string }[];
  settings: { sound: boolean; notify: boolean };
};

const clamp = (value: unknown, max: number) => Math.max(0, Math.min(max, Number(value) || 0));

export const fokusLoaders = {
  state: async (_, user): Promise<FokusState> => {
    const supabase = await createClient();
    const [{ data: open }, { data: done }, { data: settings }] = await Promise.all([
      supabase
        .from("fokus_sessions")
        .select("id, phase, focus_seconds, break_seconds, running, anchor_at, started_at, updated_at")
        .is("finished_at", null)
        .maybeSingle(),
      supabase
        .from("fokus_sessions")
        .select("id, finished_at")
        .not("finished_at", "is", null)
        .order("finished_at", { ascending: false })
        .limit(60),
      supabase.from("fokus_settings").select("sound, notify").eq("user_id", user.id).maybeSingle(),
    ]);
    return {
      session: open
        ? {
            id: open.id,
            timer: {
              phase: (["focus", "break", "done"].includes(open.phase) ? open.phase : "focus") as Phase,
              focus: clamp(open.focus_seconds, TOTAL),
              pause: clamp(open.break_seconds, BREAK),
              running: Boolean(open.running && open.anchor_at),
              anchor: open.running && open.anchor_at ? new Date(open.anchor_at).getTime() : null,
            },
            startedAt: open.started_at,
            updatedAt: open.updated_at,
          }
        : null,
      history: (done ?? []).map((row) => ({ id: row.id, finishedAt: row.finished_at as string })),
      settings: { sound: settings?.sound ?? true, notify: settings?.notify ?? false },
    };
  },
} satisfies Record<string, Loader>;
