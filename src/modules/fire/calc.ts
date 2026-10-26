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

// Months until net worth reaches the target, saving `savings` per month and
// compounding monthly at the expected real return. null = not within 100 years.
export function monthsToTarget(netWorth: number, savings: number, annualReturn: number, target: number) {
  if (target <= 0) return null;
  if (netWorth >= target) return 0;

  const monthlyReturn = Math.pow(1 + annualReturn / 100, 1 / 12) - 1;
  let value = netWorth;
  for (let month = 1; month <= MAX_MONTHS; month++) {
    value = value * (1 + monthlyReturn) + savings;
    if (value >= target) return month;
  }
  return null;
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
