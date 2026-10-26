"use client";

import { useState } from "react";
import {
  addMonths,
  fireNumber,
  formatDuration,
  formatMoney,
  formatMonth,
  formatSignedMoney,
  monthlySavings,
  monthsToTarget,
  savingsRate,
  type FireSettings,
} from "./calc";
import { cardClass, headingClass } from "./ui";

type Props = {
  netWorth: number;
  // First day of the current month (YYYY-MM-DD), passed from the server so the
  // projection doesn't depend on the client's clock during rendering.
  startMonth: string;
  settings: FireSettings;
};

// "What if" projection with extra monthly savings. Changes here are never saved.
export function WhatIf({ netWorth, startMonth, settings }: Props) {
  const [extraSavings, setExtraSavings] = useState(0);

  const target = fireNumber(settings);
  const savings = monthlySavings(settings) + extraSavings;
  const months = monthsToTarget(netWorth, savings, settings.expectedReturn, target);
  const baseMonths = monthsToTarget(netWorth, monthlySavings(settings), settings.expectedReturn, target);
  const difference = months !== null && baseMonths !== null ? baseMonths - months : null;

  let message: string;
  let tone: "good" | "bad" | "neutral";
  if (months === null) {
    message = "At this rate you would not reach your FIRE number within 100 years.";
    tone = "bad";
  } else if (baseMonths === null) {
    message = "Your current plan doesn't get there within 100 years. This one does.";
    tone = "good";
  } else if (difference === 0) {
    message = "Same as your current plan.";
    tone = "neutral";
  } else {
    message = `${formatDuration(Math.abs(difference!))} ${difference! > 0 ? "earlier" : "later"} than your current plan.`;
    tone = difference! > 0 ? "good" : "bad";
  }
  const toneClass = {
    good: "bg-fire-good-bg text-fire-good-ink",
    bad: "bg-fire-bad-bg text-fire-bad-ink",
    neutral: "bg-fire-subtle",
  }[tone];

  return (
    <div className={`${cardClass} flex min-w-0 flex-[1_1_420px] flex-col gap-5`}>
      <div className="space-y-1">
        <h2 className={headingClass}>What if…</h2>
        <p className="text-[13px] text-fire-muted">Try changes to your plan. Nothing here is saved.</p>
      </div>

      <label className="flex flex-col gap-2.5">
        <span className="flex justify-between gap-3">
          <span>Extra savings per month</span>
          <strong className="font-figures font-medium">{formatSignedMoney(extraSavings)}</strong>
        </span>
        <input
          type="range"
          min={-1000}
          max={2000}
          step={50}
          value={extraSavings}
          onChange={(event) => setExtraSavings(Number(event.target.value))}
          className="min-h-8 w-full accent-fire-accent"
        />
        <span aria-hidden="true" className="flex justify-between font-figures text-[11px] text-fire-muted">
          <span>−1.000 €</span>
          <span>0</span>
          <span>+2.000 €</span>
        </span>
      </label>

      <dl className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-xl bg-fire-subtle p-4">
          <dt className="text-[13px] text-fire-muted">Independent in</dt>
          <dd className="font-figures text-[22px] font-medium">
            {months === null
              ? "Not in 100 yr"
              : months === 0
                ? "Already"
                : formatMonth(addMonths(new Date(`${startMonth}T00:00:00`), months))}
          </dd>
          {months !== null && months > 0 && (
            <dd className="text-xs text-fire-muted">in {formatDuration(months)}</dd>
          )}
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-fire-subtle p-4">
          <dt className="text-[13px] text-fire-muted">Savings rate</dt>
          <dd className="font-figures text-[22px] font-medium">{savingsRate(savings, settings.monthlyIncome)} %</dd>
          <dd className="text-xs text-fire-muted">{formatMoney(savings)} / month</dd>
        </div>
      </dl>

      <p aria-live="polite" className={`rounded-xl px-4 py-3.5 font-medium ${toneClass}`}>
        {message}
      </p>
    </div>
  );
}
