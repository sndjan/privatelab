import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ModulePageProps } from "@/modules/registry";
import {
  addAccount,
  deleteAccount,
  deleteMonth,
  saveSettings,
  setAccountArchived,
} from "./actions";
import {
  accountKinds,
  addMonths,
  defaultSettings,
  fireNumber,
  formatDuration,
  formatMoney,
  formatMonth,
  formatSignedMoney,
  monthlySavings,
  monthsToTarget,
  savingsRate,
  signedBalance,
  type AccountKind,
  type FireSettings,
} from "./calc";
import { Calculator } from "./calculator";
import { NetWorthChart } from "./net-worth-chart";
import { RecordMonth } from "./record-month";
import {
  accentButtonClass,
  cardClass,
  headingClass,
  inputClass,
  kindColor,
  labelClass,
  rootClass,
  secondaryButtonClass,
} from "./ui";
import { WhatIf } from "./what-if";

type Account = { id: string; name: string; kind: AccountKind; archived: boolean };
type Balance = { account_id: string; month: string; balance: number };

export default async function FireModule({ user, hasAccess }: ModulePageProps) {
  // Visitors of a public FIRE module get the calculator without saved data.
  if (!user || !hasAccess) {
    return (
      <div className={`${rootClass} space-y-10`}>
        <div className="max-w-xl space-y-3">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight">When could you stop working?</h2>
          <p className="text-[17px] text-fire-muted">
            Try the FIRE calculator with your own numbers. Nothing is saved.
            {!user && (
              <>
                {" "}
                <Link href="/login?next=/m/fire" className="text-fire-accent underline">
                  Sign in
                </Link>{" "}
                to track your net worth over time.
              </>
            )}
          </p>
        </div>
        <Calculator
          netWorth={50000}
          startMonth={`${currentMonth()}-01`}
          settings={{ ...defaultSettings, monthlyIncome: 3000, monthlyExpenses: 2000 }}
        />
        <p className="max-w-2xl text-[13px] text-fire-muted">
          FIRE number = yearly expenses ÷ withdrawal rate. The projection compounds monthly at the expected real return
          and adds your monthly savings.
        </p>
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
  const savings = monthlySavings(settings);
  const progress = target > 0 ? Math.round((netWorth / target) * 100) : 0;
  const startMonth = `${currentMonth()}-01`;
  const months = monthsToTarget(netWorth, savings, settings.expectedReturn, target);

  // Investments, pension, cash and property by kind, for the allocation bar.
  const allocation = accountKinds
    .filter((kind) => kind.value !== "debt")
    .map((kind) => ({
      ...kind,
      total: activeAccounts
        .filter((account) => account.kind === kind.value)
        .reduce((sum, account) => sum + Math.max(0, latest?.byAccount.get(account.id) ?? 0), 0),
    }))
    .filter((kind) => kind.total > 0);
  const allocationTotal = allocation.reduce((sum, kind) => sum + kind.total, 0);

  return (
    <div className={`${rootClass} space-y-8`}>
      <nav aria-label="Sections" className="-mt-2 flex flex-wrap gap-1">
        {[
          ["#overview", "Overview"],
          ["#balances", "Balances"],
          ["#accounts", "Accounts"],
          ["#settings", "Settings"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="rounded-lg px-3 py-2.5 text-fire-muted hover:bg-fire-subtle hover:text-fire-ink"
          >
            {label}
          </a>
        ))}
      </nav>

      <section id="overview" aria-label="Overview" className="flex scroll-mt-4 flex-wrap items-stretch gap-6">
        <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-6 rounded-2xl bg-fire-hero p-8 text-fire-hero-ink">
          <div className="flex flex-wrap items-baseline justify-between gap-3 text-sm">
            <span className="text-fire-hero-muted">Net worth{latest && ` · ${formatMonth(latest.month)}`}</span>
            {latest && previous && (
              <span className="font-figures text-fire-hero-bar">
                {formatSignedMoney(netWorth - previous.netWorth)} since{" "}
                {new Date(`${previous.month}T00:00:00`).toLocaleDateString("en-GB", { month: "short" })}
              </span>
            )}
          </div>
          <div className="font-figures text-5xl leading-none font-medium tracking-tighter sm:text-[64px]">
            {formatMoney(netWorth)}
          </div>
          <div className="flex flex-col gap-2.5 text-sm text-fire-hero-muted">
            {target > 0 ? (
              <>
                <div className="flex justify-between gap-3">
                  <span>{progress} % of your FIRE number</span>
                  <span className="font-figures">{formatMoney(target)}</span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Progress toward FIRE number"
                  aria-valuenow={Math.max(0, Math.min(100, progress))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-3 overflow-hidden rounded-md bg-fire-hero-track"
                >
                  <div
                    className="h-full rounded-md bg-fire-hero-bar"
                    style={{ width: `${Math.max(0, Math.min(100, (netWorth / target) * 100))}%` }}
                  />
                </div>
                <div>
                  {months === null ? (
                    "Not financially independent within 100 years at your current savings."
                  ) : months === 0 ? (
                    "You have reached your FIRE number."
                  ) : (
                    <>
                      Financially independent around{" "}
                      <strong className="font-semibold text-fire-hero-ink">
                        {formatMonth(addMonths(new Date(`${startMonth}T00:00:00`), months))}
                      </strong>{" "}
                      · in {formatDuration(months)}
                    </>
                  )}
                </div>
              </>
            ) : (
              <p>
                Set your monthly expenses in{" "}
                <a href="#settings" className="text-fire-hero-ink underline">
                  Plan settings
                </a>{" "}
                to get your FIRE number.
              </p>
            )}
          </div>
        </div>

        <dl className="grid min-w-0 flex-[1_1_300px] grid-cols-2 gap-3">
          <Tile label="FIRE number" value={formatMoney(target)} note={`${settings.withdrawalRate} % withdrawal`} />
          <Tile
            label="Saving / month"
            value={formatMoney(savings)}
            note={`of ${formatMoney(settings.monthlyIncome)} income`}
          />
          <Tile
            label="Savings rate"
            value={`${savingsRate(savings, settings.monthlyIncome)} %`}
            note={`expenses ${formatMoney(settings.monthlyExpenses)}`}
          />
          <Tile label="Real return" value={`${settings.expectedReturn} %`} note="after inflation" />
        </dl>
      </section>

      <NetWorthChart points={history.map(({ month, netWorth }) => ({ month, value: netWorth }))} target={target} />

      <div className="flex flex-wrap items-start gap-6">
        <section
          id="accounts"
          aria-labelledby="accounts-heading"
          className={`${cardClass} flex min-w-0 flex-[1_1_360px] scroll-mt-4 flex-col gap-4`}
        >
          <h2 id="accounts-heading" className={headingClass}>
            Accounts
          </h2>

          {allocationTotal > 0 && (
            <div
              role="img"
              aria-label={`Allocation: ${allocation
                .map((kind) => `${kind.label} ${Math.round((kind.total / allocationTotal) * 100)} percent`)
                .join(", ")}`}
              className="flex h-2.5 gap-0.5 overflow-hidden rounded-[5px]"
            >
              {allocation.map((kind) => (
                <div key={kind.value} style={{ flex: kind.total, background: kindColor[kind.value] }} />
              ))}
            </div>
          )}

          {accounts.length > 0 && (
            <ul className="flex flex-col">
              {accounts.map((account) => {
                const balance = latest?.byAccount.get(account.id);
                const kindLabel = accountKinds.find((kind) => kind.value === account.kind)?.label;
                return (
                  <li
                    key={account.id}
                    className={`flex items-center gap-3 border-b border-fire-subtle py-2 last:border-b-0 ${
                      account.archived ? "text-fire-muted" : ""
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-[3px]"
                      style={
                        account.archived
                          ? undefined
                          : account.kind === "debt"
                            ? { border: `2px solid ${kindColor.debt}` }
                            : { background: kindColor[account.kind] }
                      }
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className={`truncate ${account.archived ? "" : "font-medium"}`}>{account.name}</span>
                      <span className="text-xs text-fire-muted">
                        {kindLabel}
                        {account.archived && " · archived"}
                      </span>
                    </span>
                    {!account.archived && balance !== undefined && (
                      <span
                        className={`ml-auto font-figures ${account.kind === "debt" ? "text-fire-debt" : ""}`}
                      >
                        {formatMoney(signedBalance(account.kind, balance))}
                      </span>
                    )}
                    <form action={setAccountArchived} className={account.archived || balance === undefined ? "ml-auto" : ""}>
                      <input type="hidden" name="accountId" value={account.id} />
                      <input type="hidden" name="archived" value={String(!account.archived)} />
                      <button
                        className={`min-h-11 px-2 font-medium ${
                          account.archived ? "text-fire-accent" : "text-fire-muted hover:text-fire-ink"
                        }`}
                        aria-label={`${account.archived ? "Restore" : "Archive"} ${account.name}`}
                      >
                        {account.archived ? "Restore" : <ArchiveIcon />}
                      </button>
                    </form>
                    {account.archived && (
                      <form action={deleteAccount}>
                        <input type="hidden" name="accountId" value={account.id} />
                        <button
                          aria-label={`Delete ${account.name}`}
                          className="min-h-11 px-2 text-fire-muted hover:text-fire-debt"
                        >
                          <TrashIcon />
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <details className="group">
            <summary className={`${secondaryButtonClass} list-none [&::-webkit-details-marker]:hidden`}>
              Add account
            </summary>
            <form action={addAccount} className="mt-3 flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="account-name">
                Account name
              </label>
              <input
                id="account-name"
                name="name"
                required
                maxLength={80}
                placeholder="e.g. ETF portfolio"
                className={`${inputClass} min-w-0 flex-1 font-fire`}
              />
              <label className="sr-only" htmlFor="account-kind">
                Kind
              </label>
              <select id="account-kind" name="kind" defaultValue="investment" className={`${inputClass} font-fire`}>
                {accountKinds.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
              <button className={accentButtonClass}>Add</button>
            </form>
          </details>
        </section>

        <WhatIf key={JSON.stringify({ netWorth, settings })} netWorth={netWorth} startMonth={startMonth} settings={settings} />
      </div>

      <section
        id="balances"
        aria-labelledby="balances-heading"
        className={`${cardClass} flex scroll-mt-4 flex-col gap-4`}
      >
        <RecordMonth
          netWorth={netWorth}
          defaultMonth={recordMonth(latest?.month)}
          accounts={activeAccounts.map((account) => ({
            ...account,
            lastBalance: latestBalance(balances, account.id),
          }))}
        />

        {history.length > 0 && (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="text-right text-[13px] text-fire-muted">
                    <th className="py-2 pr-3 text-left font-medium">Month</th>
                    {accounts.map((account) => (
                      <th key={account.id} className="px-3 py-2 font-medium">
                        {account.name}
                      </th>
                    ))}
                    <th className="px-3 py-2 font-semibold text-fire-ink">Net worth</th>
                    <th className="py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="text-right font-figures">
                  {[...history].reverse().map((row) => (
                    <tr key={row.month} className="border-t border-fire-subtle">
                      <td className="py-1.5 pr-3 text-left font-fire whitespace-nowrap">{formatMonth(row.month)}</td>
                      {accounts.map((account) => (
                        <td
                          key={account.id}
                          className={`px-3 py-1.5 ${account.kind === "debt" && row.entered.has(account.id) ? "text-fire-debt" : ""}`}
                        >
                          {row.entered.has(account.id) ? (
                            formatPlain(signedBalance(account.kind, row.byAccount.get(account.id) ?? 0))
                          ) : (
                            <span className="text-fire-muted" aria-label="no entry">
                              ·
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 font-medium">{formatPlain(row.netWorth)}</td>
                      <td className="py-1 text-right">
                        <form action={deleteMonth}>
                          <input type="hidden" name="month" value={row.month} />
                          <button
                            aria-label={`Delete ${formatMonth(row.month)}`}
                            className="inline-flex min-h-10 min-w-11 items-center justify-center text-fire-muted hover:text-fire-debt"
                          >
                            <TrashIcon />
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[13px] text-fire-muted">· = no entry that month; the last known balance counts.</p>
          </>
        )}
      </section>

      <section id="settings" aria-labelledby="settings-heading" className={`${cardClass} scroll-mt-4 space-y-4`}>
        <h2 id="settings-heading" className={headingClass}>
          Plan settings
        </h2>
        <form action={saveSettings} className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] items-end gap-4">
          <SettingField label="Monthly net income (€)" name="monthlyIncome" value={settings.monthlyIncome} step="50" />
          <SettingField label="Monthly expenses (€)" name="monthlyExpenses" value={settings.monthlyExpenses} step="50" />
          <SettingField label="Withdrawal rate (%)" name="withdrawalRate" value={settings.withdrawalRate} step="0.25" />
          <SettingField label="Expected real return (%)" name="expectedReturn" value={settings.expectedReturn} step="0.5" />
          <div className="col-span-full">
            <button className={accentButtonClass}>Save settings</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-fire-line bg-fire-surface p-[18px]">
      <dt className="text-[13px] text-fire-muted">{label}</dt>
      <dd className="font-figures text-[22px] font-medium">{value}</dd>
      <dd className="text-xs text-fire-muted">{note}</dd>
    </div>
  );
}

function SettingField({ label, name, value, step }: { label: string; name: string; value: number; step: string }) {
  return (
    <label className={labelClass}>
      {label}
      <input type="number" name={name} step={step} defaultValue={value} required className={inputClass} />
    </label>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h18v4H3zM5 8v12h14V8M10 12h4" />
    </svg>
  );
}

// Table cells: "148.200" without the currency sign.
function formatPlain(value: number) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value).replace("-", "−");
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// The month the "Record" button offers: this month, or the one after the
// latest entry when this month is already recorded.
function recordMonth(latestMonth: string | undefined) {
  const current = currentMonth();
  if (!latestMonth || latestMonth.slice(0, 7) < current) return current;
  const next = addMonths(new Date(`${latestMonth}T00:00:00`), 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
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
