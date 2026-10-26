import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ModulePageProps } from "@/modules/registry";
import {
  addAccount,
  deleteAccount,
  deleteMonth,
  saveBalances,
  saveSettings,
  setAccountArchived,
} from "./actions";
import {
  accountKinds,
  defaultSettings,
  fireNumber,
  formatMoney,
  formatMonth,
  signedBalance,
  type AccountKind,
  type FireSettings,
} from "./calc";
import { Calculator } from "./calculator";
import { NetWorthChart } from "./net-worth-chart";

type Account = { id: string; name: string; kind: AccountKind; archived: boolean };
type Balance = { account_id: string; month: string; balance: number };

export default async function FireModule({ user, hasAccess }: ModulePageProps) {
  // Visitors of a public FIRE module get the calculator without saved data.
  if (!user || !hasAccess) {
    return (
      <div className="space-y-4">
        <p className="opacity-70">
          Try the FIRE calculator with your own numbers. Nothing is saved.
          {!user && (
            <>
              {" "}
              <Link href="/login?next=/m/fire" className="underline">
                Sign in
              </Link>{" "}
              to track your net worth over time.
            </>
          )}
        </p>
        <Calculator netWorth={50000} startMonth={`${currentMonth()}-01`} settings={{ ...defaultSettings, monthlyIncome: 3000, monthlyExpenses: 2000 }} demo />
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: settingsRow }, { data: accountRows }, { data: balanceRows }] = await Promise.all([
    supabase.from("fire_settings").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("fire_accounts").select("id, name, kind, archived").order("created_at"),
    supabase.from("fire_balances").select("account_id, month, balance").order("month"),
  ]);

  const settings: FireSettings = settingsRow
    ? {
        monthlyIncome: Number(settingsRow.monthly_income),
        monthlyExpenses: Number(settingsRow.monthly_expenses),
        withdrawalRate: Number(settingsRow.withdrawal_rate),
        expectedReturn: Number(settingsRow.expected_return),
      }
    : defaultSettings;
  const accounts = (accountRows ?? []) as Account[];
  const balances = (balanceRows ?? []).map((row) => ({ ...row, balance: Number(row.balance) })) as Balance[];
  const activeAccounts = accounts.filter((account) => !account.archived);

  const history = buildHistory(accounts, balances);
  const latest = history.at(-1);
  const previous = history.at(-2);
  const netWorth = latest?.netWorth ?? 0;
  const target = fireNumber(settings);

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Tile label="Net worth" value={formatMoney(netWorth)} note={latest ? formatMonth(latest.month) : "no data yet"} />
        <Tile
          label="Change"
          value={previous ? formatMoney(netWorth - previous.netWorth) : "–"}
          note={previous ? `since ${formatMonth(previous.month)}` : undefined}
        />
        <Tile label="FIRE number" value={formatMoney(target)} note={`${settings.withdrawalRate} % withdrawal`} />
        <Tile label="Progress" value={target > 0 ? `${Math.round((netWorth / target) * 100)} %` : "–"} />
      </section>

      <section>
        <NetWorthChart points={history.map(({ month, netWorth }) => ({ month, value: netWorth }))} target={target} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Projection</h2>
        <Calculator
          key={JSON.stringify({ netWorth, settings })}
          netWorth={netWorth}
          startMonth={`${currentMonth()}-01`}
          settings={settings}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Monthly balances</h2>
        {activeAccounts.length === 0 ? (
          <p className="text-sm opacity-70">Add an account below first.</p>
        ) : (
          <form action={saveBalances} className="space-y-3 rounded-lg border border-foreground/10 p-4">
            <label className="flex items-center gap-3 text-sm">
              <span className="w-32 opacity-70">Month</span>
              <input type="month" name="month" required defaultValue={currentMonth()} className={inputClass} />
            </label>
            {activeAccounts.map((account) => (
              <label key={account.id} className="flex items-center gap-3 text-sm">
                <span className="w-32 truncate">{account.name}</span>
                <input
                  type="number"
                  step="0.01"
                  name={`balance:${account.id}`}
                  defaultValue={latestBalance(balances, account.id) ?? ""}
                  placeholder={account.kind === "debt" ? "amount owed" : "balance"}
                  className={inputClass}
                />
              </label>
            ))}
            <button className={buttonClass}>Save month</button>
          </form>
        )}

        {history.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left opacity-70">
                  <th className="py-2 pr-4 font-normal">Month</th>
                  {accounts.map((account) => (
                    <th key={account.id} className="py-2 pr-4 text-right font-normal">
                      {account.name}
                    </th>
                  ))}
                  <th className="py-2 pr-4 text-right font-normal">Net worth</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((row) => (
                  <tr key={row.month} className="border-t border-foreground/10">
                    <td className="py-2 pr-4">{formatMonth(row.month)}</td>
                    {accounts.map((account) => (
                      <td key={account.id} className="py-2 pr-4 text-right tabular-nums">
                        {row.entered.has(account.id) ? formatMoney(row.byAccount.get(account.id) ?? 0) : ""}
                      </td>
                    ))}
                    <td className="py-2 pr-4 text-right font-medium tabular-nums">{formatMoney(row.netWorth)}</td>
                    <td className="py-2 text-right">
                      <form action={deleteMonth}>
                        <input type="hidden" name="month" value={row.month} />
                        <button className="text-red-600 opacity-70 hover:opacity-100">delete</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs opacity-60">
              Accounts without a value in a month count with their last known balance.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Accounts</h2>
        <ul className="space-y-2 text-sm">
          {accounts.map((account) => (
            <li key={account.id} className="flex items-center gap-3">
              <span className={account.archived ? "opacity-50" : ""}>{account.name}</span>
              <span className="text-xs opacity-60">
                {accountKinds.find((kind) => kind.value === account.kind)?.label}
                {account.archived && " · archived"}
              </span>
              <form action={setAccountArchived} className="ml-auto">
                <input type="hidden" name="accountId" value={account.id} />
                <input type="hidden" name="archived" value={String(!account.archived)} />
                <button className="opacity-70 hover:opacity-100">{account.archived ? "restore" : "archive"}</button>
              </form>
              <form action={deleteAccount}>
                <input type="hidden" name="accountId" value={account.id} />
                <button className="text-red-600 opacity-70 hover:opacity-100">delete</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addAccount} className="flex flex-wrap gap-2">
          <input name="name" required maxLength={80} placeholder="e.g. ETF portfolio" className={inputClass} />
          <select name="kind" defaultValue="investment" className={inputClass}>
            {accountKinds.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
          <button className={buttonClass}>Add account</button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Settings</h2>
        <form action={saveSettings} className="grid gap-3 rounded-lg border border-foreground/10 p-4 sm:grid-cols-2">
          <SettingField label="Monthly net income (€)" name="monthlyIncome" value={settings.monthlyIncome} step="50" />
          <SettingField label="Monthly expenses (€)" name="monthlyExpenses" value={settings.monthlyExpenses} step="50" />
          <SettingField label="Withdrawal rate (%)" name="withdrawalRate" value={settings.withdrawalRate} step="0.25" />
          <SettingField label="Expected real return (%)" name="expectedReturn" value={settings.expectedReturn} step="0.5" />
          <div className="sm:col-span-2">
            <button className={buttonClass}>Save settings</button>
          </div>
        </form>
      </section>
    </div>
  );
}

const inputClass = "rounded border border-foreground/20 bg-transparent px-3 py-1.5";
const buttonClass = "rounded bg-foreground px-3 py-1.5 text-sm text-background";

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-foreground/10 p-4">
      <div className="text-sm opacity-70">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      {note && <div className="text-xs opacity-60">{note}</div>}
    </div>
  );
}

function SettingField({ label, name, value, step }: { label: string; name: string; value: number; step: string }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="opacity-70">{label}</span>
      <input type="number" name={name} step={step} defaultValue={value} required className={`w-full ${inputClass}`} />
    </label>
  );
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function latestBalance(balances: Balance[], accountId: string) {
  return balances.filter((row) => row.account_id === accountId).at(-1)?.balance;
}

// Net worth per month. Accounts without an entry carry their last balance
// forward, except archived accounts after their last entry.
function buildHistory(accounts: Account[], balances: Balance[]) {
  const kinds = new Map(accounts.map((account) => [account.id, account.kind]));
  const archived = new Set(accounts.filter((account) => account.archived).map((account) => account.id));
  const lastEntry = new Map(balances.map((row) => [row.account_id, row.month]));
  const months = [...new Set(balances.map((row) => row.month))].sort();
  const lastKnown = new Map<string, number>();

  return months.map((month) => {
    const entered = new Set<string>();
    for (const row of balances) {
      if (row.month === month) {
        lastKnown.set(row.account_id, row.balance);
        entered.add(row.account_id);
      }
    }
    for (const accountId of archived) {
      if ((lastEntry.get(accountId) ?? "") < month) lastKnown.delete(accountId);
    }
    const byAccount = new Map(lastKnown);
    let netWorth = 0;
    for (const [accountId, balance] of byAccount) {
      netWorth += signedBalance(kinds.get(accountId) ?? "investment", balance);
    }
    return { month, netWorth, byAccount, entered };
  });
}
