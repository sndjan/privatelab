"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const kinds = ["bug", "idea", "other"] as const;

export async function sendFeedback(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const message = String(formData.get("message") ?? "").trim().slice(0, 4000);
  const kind = String(formData.get("kind"));
  if (!message) return;

  const supabase = await createClient();
  const { error } = await supabase.from("feedback").insert({
    message,
    kind: kinds.includes(kind as (typeof kinds)[number]) ? kind : "other",
    page: String(formData.get("page") ?? "").slice(0, 300) || null,
    user_agent: String(formData.get("userAgent") ?? "").slice(0, 500) || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
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
