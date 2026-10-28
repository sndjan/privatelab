// Pure FIRE calculations, shared by server and client components.

export type AccountKind = "investment" | "cash" | "pension" | "property" | "debt";

export type FireSettings = {
  monthlyIncome: number;
  monthlyExpenses: number;
  withdrawalRate: number; // percent
  expectedReturn: number; // percent per year, after inflation
  // A FIRE number set by hand; null = calculated from expenses and withdrawal rate.
  target: number | null;
};

export const defaultSettings: FireSettings = {
  monthlyIncome: 0,
  monthlyExpenses: 0,
  withdrawalRate: 4,
  expectedReturn: 5,
  target: null,
};

export const accountKinds: { value: AccountKind; label: string }[] = [
  { value: "investment", label: "Investments" },
  { value: "cash", label: "Bargeld & Konten" },
  { value: "pension", label: "Altersvorsorge" },
  { value: "property", label: "Immobilien" },
  { value: "debt", label: "Schulden" },
];

export function signedBalance(kind: AccountKind, balance: number) {
  return kind === "debt" ? -balance : balance;
}

export function calculatedFireNumber(settings: FireSettings) {
  return (settings.monthlyExpenses * 12) / (settings.withdrawalRate / 100);
}

export function fireNumber(settings: FireSettings) {
  return settings.target ?? calculatedFireNumber(settings);
}

export function monthlySavings(settings: FireSettings) {
  return settings.monthlyIncome - settings.monthlyExpenses;
}

const MAX_MONTHS = 100 * 12;

// A one-off expense in the future; `month` is the first day of its month.
export type PlannedExpense = { id: string; name: string; amount: number; month: string };

// Planned expenses as amounts per month from `startMonth` (0 = this month);
// past ones are left out, they are already gone from the balances.
export function expensesByOffset(expenses: Pick<PlannedExpense, "amount" | "month">[], startMonth: string) {
  const start = new Date(`${startMonth}T00:00:00`);
  const byOffset = new Map<number, number>();
  for (const expense of expenses) {
    const date = new Date(`${expense.month}T00:00:00`);
    const offset = (date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth();
    if (offset >= 0) byOffset.set(offset, (byOffset.get(offset) ?? 0) + expense.amount);
  }
  return byOffset;
}

// Months until net worth reaches the target, saving `savings` per month and
// compounding monthly at the expected real return. Planned expenses (by
// month offset, 0 = this month) are taken out in their month, and the target
// only counts as reached once no later expense pulls it below again.
// null = not within 100 years.
export function monthsToTarget(
  netWorth: number,
  savings: number,
  annualReturn: number,
  target: number,
  expenses: Map<number, number> = new Map(),
) {
  if (target <= 0) return null;
  const monthlyReturn = Math.pow(1 + annualReturn / 100, 1 / 12) - 1;
  const lastExpense = Math.max(-1, ...expenses.keys());
  let value = netWorth - (expenses.get(0) ?? 0);
  let reached: number | null = value >= target ? 0 : null;
  for (let month = 1; month <= MAX_MONTHS; month++) {
    if (reached !== null && month > lastExpense) return reached;
    value = value * (1 + monthlyReturn) + savings - (expenses.get(month) ?? 0);
    if (value < target) reached = null;
    else reached ??= month;
  }
  return reached;
}

export function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMonth(month: string | Date) {
  const date = typeof month === "string" ? new Date(`${month}T00:00:00`) : month;
  return date.toLocaleDateString("de-DE", { month: "short", year: "numeric" });
}

export function formatDuration(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} Mon.`;
  return rest === 0 ? `${years} J.` : `${years} J. ${rest} Mon.`;
}

// Axis labels: "160k €", "1,2 Mio. €".
export function formatCompactMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${String(+(value / 1_000_000).toFixed(1)).replace(".", ",")} Mio. €`;
  if (abs >= 1_000) return `${+(value / 1_000).toFixed(0)}k €`;
  return `${value} €`;
}

// "+5.100 €" / "−300 €"
export function formatSignedMoney(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return sign + formatMoney(Math.abs(value));
}

export function savingsRate(savings: number, income: number) {
  return income > 0 ? Math.round((savings / income) * 100) : 0;
}
