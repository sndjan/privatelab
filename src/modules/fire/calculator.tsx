"use client";

import { useState } from "react";
import {
  addMonths,
  fireNumber,
  formatDuration,
  formatMoney,
  formatMonth,
  monthlySavings,
  monthsToTarget,
  type FireSettings,
} from "./calc";

type Props = {
  netWorth: number;
  // First day of the current month (YYYY-MM-DD), passed from the server so the
  // projection doesn't depend on the client's clock during rendering.
  startMonth: string;
  settings: FireSettings;
  // Demo mode lets visitors type in every value themselves.
  demo?: boolean;
};

// "What if" projection. Changes here are never saved.
export function Calculator({ netWorth: initialNetWorth, startMonth, settings: initial, demo = false }: Props) {
  const [netWorth, setNetWorth] = useState(initialNetWorth);
  const [settings, setSettings] = useState(initial);
  const [extraSavings, setExtraSavings] = useState(0);

  const target = fireNumber(settings);
  const savings = monthlySavings(settings) + extraSavings;
  const months = monthsToTarget(netWorth, savings, settings.expectedReturn, target);
  const baseMonths = monthsToTarget(
    initialNetWorth,
    monthlySavings(initial),
    initial.expectedReturn,
    fireNumber(initial),
  );
  const difference = !demo && months !== null && baseMonths !== null ? baseMonths - months : 0;

  function update(key: keyof FireSettings) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setSettings({ ...settings, [key]: Number(event.target.value) });
  }

  return (
    <div className="space-y-4 rounded-lg border border-foreground/10 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {demo && (
          <NumberField label="Current net worth (€)" value={netWorth} onChange={(e) => setNetWorth(Number(e.target.value))} />
        )}
        <NumberField label="Monthly income (€)" value={settings.monthlyIncome} onChange={update("monthlyIncome")} />
        <NumberField label="Monthly expenses (€)" value={settings.monthlyExpenses} onChange={update("monthlyExpenses")} />
        <NumberField label="Expected real return (%)" value={settings.expectedReturn} step={0.5} onChange={update("expectedReturn")} />
        <NumberField label="Withdrawal rate (%)" value={settings.withdrawalRate} step={0.25} onChange={update("withdrawalRate")} />
      </div>

      {!demo && (
        <label className="block space-y-1 text-sm">
          <span>
            Extra savings per month: <strong>{formatMoney(extraSavings)}</strong>
          </span>
          <input
            type="range"
            min={-1000}
            max={2000}
            step={50}
            value={extraSavings}
            onChange={(event) => setExtraSavings(Number(event.target.value))}
            className="w-full"
          />
        </label>
      )}

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="FIRE number" value={formatMoney(target)} />
        <Stat label="Saving per month" value={formatMoney(savings)} />
        <Stat
          label="Savings rate"
          value={`${settings.monthlyIncome > 0 ? Math.round((savings / settings.monthlyIncome) * 100) : 0} %`}
        />
        <Stat
          label="Financially independent"
          value={
            months === null
              ? "not within 100 yr"
              : months === 0
                ? "already 🎉"
                : `${formatMonth(addMonths(new Date(`${startMonth}T00:00:00`), months))} (${formatDuration(months)})`
          }
        />
      </dl>

      {difference !== 0 && (
        <p className="text-sm">
          That is <strong>{formatDuration(Math.abs(difference))}</strong> {difference > 0 ? "earlier" : "later"} than
          your current plan.
        </p>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  step = 50,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="opacity-70">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={onChange}
        className="w-full rounded border border-foreground/20 bg-transparent px-3 py-1.5"
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="opacity-70">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
