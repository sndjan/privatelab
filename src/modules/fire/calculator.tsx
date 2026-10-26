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
  savingsRate,
  type FireSettings,
} from "./calc";
import { cardClass, inputClass, labelClass } from "./ui";

type Props = {
  netWorth: number;
  // First day of the current month (YYYY-MM-DD), passed from the server so the
  // projection doesn't depend on the client's clock during rendering.
  startMonth: string;
  settings: FireSettings;
};

// Calculator for visitors: every value is typed in and nothing is saved.
export function Calculator({ netWorth: initialNetWorth, startMonth, settings: initial }: Props) {
  const [netWorth, setNetWorth] = useState(initialNetWorth);
  const [settings, setSettings] = useState(initial);

  const target = fireNumber(settings);
  const savings = monthlySavings(settings);
  const months = monthsToTarget(netWorth, savings, settings.expectedReturn, target);
  const progress = target > 0 ? Math.max(0, Math.min(100, Math.round((netWorth / target) * 100))) : 0;

  function update(key: keyof FireSettings) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setSettings({ ...settings, [key]: Number(event.target.value) });
  }

  return (
    <div className="flex flex-wrap items-stretch gap-6">
      <form className={`${cardClass} grid min-w-0 flex-[1_1_380px] content-start gap-4 sm:grid-cols-2`}>
        <label className={`${labelClass} sm:col-span-2`}>
          Current net worth (€)
          <input
            type="number"
            step={1000}
            value={netWorth}
            onChange={(event) => setNetWorth(Number(event.target.value))}
            className={`${inputClass} min-h-12 text-[17px]`}
          />
        </label>
        <NumberField label="Monthly income (€)" value={settings.monthlyIncome} onChange={update("monthlyIncome")} />
        <NumberField label="Monthly expenses (€)" value={settings.monthlyExpenses} onChange={update("monthlyExpenses")} />
        <NumberField
          label="Expected real return (%)"
          value={settings.expectedReturn}
          step={0.5}
          onChange={update("expectedReturn")}
        />
        <NumberField
          label="Withdrawal rate (%)"
          value={settings.withdrawalRate}
          step={0.25}
          onChange={update("withdrawalRate")}
        />
      </form>

      <section
        aria-label="Result"
        aria-live="polite"
        className="flex min-w-0 flex-[1_1_420px] flex-col gap-7 rounded-2xl bg-fire-hero p-8 text-fire-hero-ink"
      >
        <div className="flex flex-col gap-2">
          <span className="text-sm text-fire-hero-muted">Financially independent</span>
          <span className="font-figures text-5xl leading-none font-medium tracking-tight sm:text-[56px]">
            {months === null
              ? "Not in 100 yr"
              : months === 0
                ? "Already"
                : formatMonth(addMonths(new Date(`${startMonth}T00:00:00`), months))}
          </span>
          <span className="text-fire-hero-muted">
            {months === null
              ? "Save more or spend less to get there."
              : months === 0
                ? "Your net worth covers your FIRE number."
                : `in ${formatDuration(months)}`}
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between text-sm text-fire-hero-muted">
            <span>{progress} % of the way</span>
            <span className="font-figures">{formatMoney(target)}</span>
          </div>
          <div
            role="progressbar"
            aria-label="Progress toward FIRE number"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-3 overflow-hidden rounded-md bg-fire-hero-track"
          >
            <div className="h-full rounded-md bg-fire-hero-bar" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-4 border-t border-fire-hero-track pt-5">
          <Stat label="FIRE number" value={formatMoney(target)} />
          <Stat label="Saving / month" value={formatMoney(savings)} />
          <Stat label="Savings rate" value={`${savingsRate(savings, settings.monthlyIncome)} %`} />
        </dl>
      </section>
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
    <label className={labelClass}>
      {label}
      <input type="number" step={step} value={value} onChange={onChange} className={inputClass} />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[13px] text-fire-hero-muted">{label}</dt>
      <dd className="font-figures text-lg">{value}</dd>
    </div>
  );
}
