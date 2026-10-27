"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const kinds = ["bug", "idea", "other"] as const;

// Returns an error message instead of throwing: errors thrown in server
// actions reach the client without their message in production builds.
export async function sendFeedback(formData: FormData): Promise<{ error: string | null }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte melde dich erneut an." };

  const message = String(formData.get("message") ?? "").trim().slice(0, 4000);
  const kind = String(formData.get("kind"));
  if (!message) return { error: "Bitte schreib eine Nachricht." };

  const supabase = await createClient();
  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    message,
    kind: kinds.includes(kind as (typeof kinds)[number]) ? kind : "other",
    page: String(formData.get("page") ?? "").slice(0, 300) || null,
    user_agent: String(formData.get("userAgent") ?? "").slice(0, 500) || null,
  });
  if (error) {
    console.error("Saving feedback failed:", error);
    // PGRST205: the table isn't in the API's schema cache, i.e. the feedback
    // migration hasn't been run on this project.
    if (error.code === "PGRST205" || error.code === "42P01") {
      return { error: "Die Feedback-Tabelle fehlt in Supabase. Die Migration 20261028000000_feedback.sql muss noch ausgeführt werden." };
    }
    return { error: `Das hat nicht geklappt (${error.message}). Versuch es bitte noch einmal.` };
  }
  revalidatePath("/admin");
  return { error: null };
}

export async function setFeedbackStatus(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("feedback")
    .update({ status: formData.get("status") === "done" ? "done" : "new" })
    .eq("id", String(formData.get("feedbackId")));
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function deleteFeedback(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("feedback").delete().eq("id", String(formData.get("feedbackId")));
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
