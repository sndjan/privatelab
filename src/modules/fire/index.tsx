import { Trash2Icon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import type { ModulePageProps } from "@/modules/registry";
import { deleteMonth, saveSettings } from "./actions";
import { AccountDialog } from "./account-dialog";
import {
  accountKinds,
  addMonths,
  calculatedFireNumber,
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
import { TargetDialog } from "./target-dialog";
import { kindColor } from "./ui";
import { WhatIf } from "./what-if";

type Account = { id: string; name: string; kind: AccountKind; archived: boolean };
type Balance = { account_id: string; month: string; balance: number };

export default async function FireModule({ user, hasAccess }: ModulePageProps) {
  // Visitors of a public FIRE module get the calculator without saved data.
  if (!user || !hasAccess) {
    return (
      <div className="space-y-10">
        <div className="max-w-xl space-y-3">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight">Wann könntest du aufhören zu arbeiten?</h2>
          <p className="text-[17px] text-muted-foreground">
            Probier den FIRE-Rechner mit deinen eigenen Zahlen aus. Es wird nichts gespeichert.
            {!user && (
              <>
                {" "}
                <Link href="/login?next=/m/fire" className="text-brand underline underline-offset-4">
                  Melde dich an
                </Link>
                , um dein Vermögen über die Zeit zu verfolgen.
              </>
            )}
          </p>
        </div>
        <Calculator
          netWorth={50000}
          startMonth={`${currentMonth()}-01`}
          settings={{ ...defaultSettings, monthlyIncome: 3000, monthlyExpenses: 2000 }}
        />
        <p className="max-w-2xl text-[13px] text-muted-foreground">
          FIRE-Zahl = jährliche Ausgaben ÷ Entnahmerate. Die Prognose verzinst monatlich mit der erwarteten realen Rendite
          und rechnet deine monatliche Sparrate dazu.
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
        target: settingsRow.target === null || settingsRow.target === undefined ? null : Number(settingsRow.target),
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

  // Largest balance first, debts at the bottom; archived accounts last.
  const currentBalance = (account: Account) => {
    const balance = latest?.byAccount.get(account.id);
    return balance === undefined ? undefined : signedBalance(account.kind, balance);
  };
  const sortedAccounts = [...accounts].sort(
    (a, b) =>
      Number(a.archived) - Number(b.archived) ||
      (currentBalance(b) ?? -Infinity) - (currentBalance(a) ?? -Infinity),
  );

  return (
    <div className="space-y-6">
      <section aria-label="Übersicht" className="flex flex-wrap items-stretch gap-4 sm:gap-6">
        <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-5 rounded-xl bg-hero p-5 text-hero-foreground sm:gap-6 sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3 text-sm">
            <span className="text-hero-muted">Vermögen{latest && ` · ${formatMonth(latest.month)}`}</span>
            {latest && previous && (
              <span className="font-mono text-hero-bar">
                {formatSignedMoney(netWorth - previous.netWorth)} seit{" "}
                {new Date(`${previous.month}T00:00:00`).toLocaleDateString("de-DE", { month: "short" })}
              </span>
            )}
          </div>
          <div className="font-mono text-4xl leading-none font-medium tracking-tighter break-all sm:text-5xl md:text-[64px]">
            {formatMoney(netWorth)}
          </div>
          <div className="flex flex-col gap-2.5 text-sm text-hero-muted">
            {target > 0 ? (
              <>
                <div className="flex justify-between gap-3">
                  <span>{progress} % deiner FIRE-Zahl</span>
                  <span className="font-mono">{formatMoney(target)}</span>
                </div>
                <Progress
                  value={Math.max(0, Math.min(100, (netWorth / target) * 100))}
                  aria-label="Fortschritt zur FIRE-Zahl"
                  className="h-3 bg-hero-track"
                  indicatorClassName="bg-hero-bar"
                />
                <div>
                  {months === null ? (
                    "Mit deiner aktuellen Sparrate nicht innerhalb von 100 Jahren finanziell unabhängig."
                  ) : months === 0 ? (
                    "Du hast deine FIRE-Zahl erreicht."
                  ) : (
                    <>
                      Finanziell unabhängig etwa ab{" "}
                      <strong className="font-semibold text-hero-foreground">
                        {formatMonth(addMonths(new Date(`${startMonth}T00:00:00`), months))}
                      </strong>{" "}
                      · in {formatDuration(months)}
                    </>
                  )}
                </div>
              </>
            ) : (
              <p>
                Trag deine monatlichen Ausgaben in den{" "}
                <a href="#settings" className="text-hero-foreground underline underline-offset-4">
                  Planeinstellungen
                </a>{" "}
                ein, um deine FIRE-Zahl zu erhalten.
              </p>
            )}
          </div>
        </div>

        <dl className="grid min-w-0 flex-[1_1_300px] grid-cols-2 gap-3">
          <Tile
            label="FIRE-Zahl"
            value={formatMoney(target)}
            note={settings.target === null ? `${settings.withdrawalRate} % Entnahme` : "eigener Wert"}
            action={<TargetDialog target={settings.target} calculated={calculatedFireNumber(settings)} />}
          />
          <Tile
            label="Sparen / Monat"
            value={formatMoney(savings)}
            note={`von ${formatMoney(settings.monthlyIncome)} Einkommen`}
          />
          <Tile
            label="Sparquote"
            value={`${savingsRate(savings, settings.monthlyIncome)} %`}
            note={`Ausgaben ${formatMoney(settings.monthlyExpenses)}`}
          />
          <Tile label="Reale Rendite" value={`${settings.expectedReturn} %`} note="nach Inflation" />
        </dl>
      </section>

      <NetWorthChart points={history.map(({ month, netWorth }) => ({ month, value: netWorth }))} target={target} />

      <div className="flex flex-wrap items-start gap-4 sm:gap-6">
        <Card className="min-w-0 flex-[1_1_320px]">
          <CardHeader>
            <CardTitle className="text-lg">
              <h2>Konten</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {allocationTotal > 0 && (
              <div
                role="img"
                aria-label={`Aufteilung: ${allocation
                  .map((kind) => `${kind.label} ${Math.round((kind.total / allocationTotal) * 100)} Prozent`)
                  .join(", ")}`}
                className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
              >
                {allocation.map((kind) => (
                  <div key={kind.value} style={{ flex: kind.total, background: kindColor[kind.value] }} />
                ))}
              </div>
            )}

            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Konten.</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {sortedAccounts.map((account) => {
                  const balance = latest?.byAccount.get(account.id);
                  const kindLabel = accountKinds.find((kind) => kind.value === account.kind)?.label;
                  return (
                    <li
                      key={account.id}
                      className={`flex items-center gap-2 py-2 ${account.archived ? "text-muted-foreground" : ""}`}
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
                        <span className="text-xs text-muted-foreground">
                          {kindLabel}
                          {account.archived && " · archiviert"}
                        </span>
                      </span>
                      <span className={`ml-auto shrink-0 pl-1 font-mono ${account.kind === "debt" ? "text-debt" : ""}`}>
                        {!account.archived && balance !== undefined && formatMoney(signedBalance(account.kind, balance))}
                      </span>
                      <AccountDialog account={account} />
                    </li>
                  );
                })}
              </ul>
            )}

            <AccountDialog />
          </CardContent>
        </Card>

        <WhatIf key={JSON.stringify({ netWorth, settings })} netWorth={netWorth} startMonth={startMonth} settings={settings} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Monatsstände</h2>
          </CardTitle>
          {activeAccounts.length === 0 && <CardDescription>Leg zuerst ein Konto an.</CardDescription>}
          {activeAccounts.length > 0 && (
            <CardAction>
              <RecordMonth
                netWorth={netWorth}
                defaultMonth={recordMonth(latest?.month)}
                accounts={activeAccounts.map((account) => ({
                  ...account,
                  lastBalance: latestBalance(balances, account.id),
                }))}
              />
            </CardAction>
          )}
        </CardHeader>

        {history.length > 0 && (
          <CardContent className="space-y-3">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="sticky left-0 z-10 bg-card text-muted-foreground">Monat</TableHead>
                  {accounts.map((account) => (
                    <TableHead key={account.id} className="text-right text-muted-foreground">
                      {account.name}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Vermögen</TableHead>
                  <TableHead>
                    <span className="sr-only">Aktionen</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="font-mono">
                {[...history].reverse().map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="sticky left-0 z-10 bg-card font-sans">{formatMonth(row.month)}</TableCell>
                    {accounts.map((account) => (
                      <TableCell
                        key={account.id}
                        className={`text-right ${account.kind === "debt" && row.entered.has(account.id) ? "text-debt" : ""}`}
                      >
                        {row.entered.has(account.id) ? (
                          formatPlain(signedBalance(account.kind, row.byAccount.get(account.id) ?? 0))
                        ) : (
                          <span className="text-muted-foreground" aria-label="kein Eintrag">
                            ·
                          </span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-medium">{formatPlain(row.netWorth)}</TableCell>
                    <TableCell className="flex justify-end py-1">
                      <RecordMonth
                        edit={{
                          values: Object.fromEntries(
                            [...row.entered].map((id) => [id, row.byAccount.get(id) ?? 0]),
                          ),
                        }}
                        defaultMonth={row.month.slice(0, 7)}
                        netWorth={row.netWorth}
                        accounts={accounts
                          .filter((account) => !account.archived || row.entered.has(account.id))
                          .map((account) => ({ ...account, lastBalance: row.byAccount.get(account.id) }))}
                      />
                      <form action={deleteMonth}>
                        <input type="hidden" name="month" value={row.month} />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${formatMonth(row.month)} löschen`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2Icon />
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-[13px] text-muted-foreground">· = kein Eintrag in diesem Monat; es zählt der letzte bekannte Stand.</p>
          </CardContent>
        )}
      </Card>

      <Card id="settings" className="scroll-mt-4">
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Planeinstellungen</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveSettings} className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] items-end gap-4">
            <SettingField label="Monatliches Nettoeinkommen (€)" name="monthlyIncome" value={settings.monthlyIncome} step="1" />
            <SettingField label="Monatliche Ausgaben (€)" name="monthlyExpenses" value={settings.monthlyExpenses} step="1" />
            <SettingField label="Entnahmerate (%)" name="withdrawalRate" value={settings.withdrawalRate} step="0.01" />
            <SettingField label="Erwartete reale Rendite (%)" name="expectedReturn" value={settings.expectedReturn} step="0.01" />
            <div className="col-span-full">
              <Button variant="brand" size="lg">
                Einstellungen speichern
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({ label, value, note, action }: { label: string; value: string; note: string; action?: React.ReactNode }) {
  return (
    <Card className="min-w-0 gap-1.5 p-4 sm:p-[18px]">
      <dt className="flex items-start justify-between gap-1 text-[13px] text-muted-foreground">
        {label}
        {action}
      </dt>
      <dd className="font-mono text-lg font-medium break-words sm:text-[22px]">{value}</dd>
      <dd className="text-xs text-muted-foreground">{note}</dd>
    </Card>
  );
}

function SettingField({ label, name, value, step }: { label: string; name: string; value: number; step: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`setting-${name}`} className="font-normal text-muted-foreground">
        {label}
      </Label>
      <Input
        id={`setting-${name}`}
        type="number"
        name={name}
        step={step}
        defaultValue={value}
        required
        className="h-11 font-mono"
      />
    </div>
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
