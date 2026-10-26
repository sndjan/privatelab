"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

// Every action re-checks admin rights: server actions are public endpoints.

export async function inviteUser(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const moduleIds = formData.getAll("modules").map(String);
  if (!email) return;

  const admin = createAdminClient();
  // Creates the auth user (the trigger adds the profile). No email is sent;
  // the person signs in on /login with a magic link.
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw new Error(error.message);

  if (moduleIds.length > 0) {
    const { error: accessError } = await admin
      .from("module_access")
      .insert(moduleIds.map((moduleId) => ({ user_id: data.user.id, module_id: moduleId })));
    if (accessError) throw new Error(accessError.message);
  }

  revalidatePath("/admin");
}

export async function setModuleAccess(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId"));
  const moduleId = String(formData.get("moduleId"));
  const enabled = formData.get("enabled") === "true";

  const admin = createAdminClient();
  const { error } = enabled
    ? await admin.from("module_access").upsert({ user_id: userId, module_id: moduleId })
    : await admin.from("module_access").delete().eq("user_id", userId).eq("module_id", moduleId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}

export async function setModuleVisibility(formData: FormData) {
  await requireAdmin();
  const moduleId = String(formData.get("moduleId"));
  const visibility = formData.get("visibility") === "public" ? "public" : "private";

  const { error } = await createAdminClient()
    .from("modules")
    .update({ visibility })
    .eq("id", moduleId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}

export async function removeUser(formData: FormData) {
  const currentUser = await requireAdmin();
  const userId = String(formData.get("userId"));
  if (userId === currentUser.id) return;

  const { error } = await createAdminClient().auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}
