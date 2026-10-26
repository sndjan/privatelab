"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { accountKinds } from "./calc";

// All writes go through the user's own Supabase client, so RLS enforces
// ownership and access to the 'fire' module.

const PATH = "/m/fire";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return user;
}

function toNumber(value: FormDataEntryValue | null) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : 0;
}

export async function saveSettings(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("fire_settings").upsert({
    user_id: user.id,
    monthly_income: toNumber(formData.get("monthlyIncome")),
    monthly_expenses: toNumber(formData.get("monthlyExpenses")),
    withdrawal_rate: toNumber(formData.get("withdrawalRate")),
    expected_return: toNumber(formData.get("expectedReturn")),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);

  revalidatePath(PATH);
}

export async function addAccount(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind"));
  if (!name || !accountKinds.some((option) => option.value === kind)) return;

  const supabase = await createClient();
  const { error } = await supabase.from("fire_accounts").insert({ name, kind });
  if (error) throw new Error(error.message);

  revalidatePath(PATH);
}

export async function setAccountArchived(formData: FormData) {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("fire_accounts")
    .update({ archived: formData.get("archived") === "true" })
    .eq("id", String(formData.get("accountId")));
  if (error) throw new Error(error.message);

  revalidatePath(PATH);
}

export async function deleteAccount(formData: FormData) {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("fire_accounts")
    .delete()
    .eq("id", String(formData.get("accountId")));
  if (error) throw new Error(error.message);

  revalidatePath(PATH);
}

// Saves the balances of all listed accounts for one month (input type="month").
export async function saveBalances(formData: FormData) {
  await requireUser();
  const month = String(formData.get("month") ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) return;

  const rows = [...formData.entries()]
    .filter(([key, value]) => key.startsWith("balance:") && String(value).trim() !== "")
    .map(([key, value]) => ({
      account_id: key.slice("balance:".length),
      month: `${month}-01`,
      balance: toNumber(value),
    }));
  if (rows.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from("fire_balances").upsert(rows);
  if (error) throw new Error(error.message);

  revalidatePath(PATH);
}

export async function deleteMonth(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("fire_balances")
    .delete()
    .eq("user_id", user.id)
    .eq("month", String(formData.get("month")));
  if (error) throw new Error(error.message);

  revalidatePath(PATH);
}
