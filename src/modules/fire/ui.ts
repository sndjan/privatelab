import type { AccountKind } from "./calc";

// Swatch color per account kind, from the theme's chart palette.
export const kindColor: Record<AccountKind, string> = {
  investment: "var(--chart-1)",
  pension: "var(--chart-2)",
  cash: "var(--chart-3)",
  property: "var(--chart-4)",
  debt: "var(--debt)",
};
