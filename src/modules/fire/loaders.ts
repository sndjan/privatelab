// Server only. What the browser cache loads for FIRE (see src/lib/query/data.ts).
import type { Loader } from "@/lib/query/loaders";
import { createClient } from "@/lib/supabase/server";
import { defaultSettings, type AccountKind, type FireSettings, type PlannedExpense } from "./calc";

export type Account = { id: string; name: string; kind: AccountKind; archived: boolean };
export type Balance = { account_id: string; month: string; balance: number };

export const fireLoaders = {
  // Everything the page shows: settings, accounts, monthly balances and
  // planned expenses. Numbers come as strings from numeric columns.
  overview: async (_, user) => {
    const supabase = await createClient();
    const [{ data: settingsRow }, { data: accountRows }, { data: balanceRows }, { data: expenseRows }] = await Promise.all([
      supabase.from("fire_settings").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("fire_accounts").select("id, name, kind, archived").order("created_at"),
      supabase.from("fire_balances").select("account_id, month, balance").order("month"),
      supabase.from("fire_planned_expenses").select("id, name, amount, month").order("month"),
    ]);
    const settings: FireSettings = settingsRow
      ? {
          monthlyIncome: Number(settingsRow.monthly_income),
          monthlyExpenses: Number(settingsRow.monthly_expenses),
          withdrawalRate: Number(settingsRow.withdrawal_rate),
          expectedReturn: Number(settingsRow.expected_return),
          target: settingsRow.target === null || settingsRow.target === undefined ? null : Number(settingsRow.target),
        }
      : defaultSettings;
    return {
      settings,
      accounts: (accountRows ?? []) as Account[],
      balances: (balanceRows ?? []).map((row) => ({ ...row, balance: Number(row.balance) })) as Balance[],
      expenses: (expenseRows ?? []).map((row) => ({ ...row, amount: Number(row.amount) })) as PlannedExpense[],
    };
  },
} satisfies Record<string, Loader>;
