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
  expensesByOffset,
  monthsToTarget,
  savingsRate,
  type FireSettings,
  type PlannedExpense,
} from "./calc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

type Props = {
  netWorth: number;
  // First day of the current month (YYYY-MM-DD), passed from the server so the
  // projection doesn't depend on the client's clock during rendering.
  startMonth: string;
  settings: FireSettings;
  expenses: PlannedExpense[];
};

// "What if" projection with extra monthly savings. Changes here are never saved.
export function WhatIf({ netWorth, startMonth, settings, expenses }: Props) {
  const [extraSavings, setExtraSavings] = useState(0);

  const target = fireNumber(settings);
  const savings = monthlySavings(settings) + extraSavings;
  const planned = expensesByOffset(expenses, startMonth);
  const months = monthsToTarget(netWorth, savings, settings.expectedReturn, target, planned);
  const baseMonths = monthsToTarget(netWorth, monthlySavings(settings), settings.expectedReturn, target, planned);
  const difference = months !== null && baseMonths !== null ? baseMonths - months : null;

  let message: string;
  let tone: "good" | "bad" | "neutral";
  if (months === null) {
    message = "So würdest du deine FIRE-Zahl nicht innerhalb von 100 Jahren erreichen.";
    tone = "bad";
  } else if (baseMonths === null) {
    message = "Dein aktueller Plan schafft es nicht innerhalb von 100 Jahren. Dieser schon.";
    tone = "good";
  } else if (difference === 0) {
    message = "Genau wie dein aktueller Plan.";
    tone = "neutral";
  } else {
    message = `${formatDuration(Math.abs(difference!))} ${difference! > 0 ? "früher" : "später"} als dein aktueller Plan.`;
    tone = difference! > 0 ? "good" : "bad";
  }
  const toneClass = {
    good: "bg-good text-good-foreground",
    bad: "bg-bad text-bad-foreground",
    neutral: "bg-muted",
  }[tone];

  return (
    <Card className="min-w-0 flex-[1_1_320px]">
      <CardHeader>
        <CardTitle className="text-lg">
          <h2>Was wäre, wenn …</h2>
        </CardTitle>
        <CardDescription>Probier Änderungen an deinem Plan aus. Hier wird nichts gespeichert.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between gap-3">
            <span id="extra-savings-label">Zusätzlich sparen pro Monat</span>
            <strong className="font-mono font-medium">{formatSignedMoney(extraSavings)}</strong>
          </div>
          <Slider
            aria-labelledby="extra-savings-label"
            min={-1000}
            max={2000}
            step={50}
            value={[extraSavings]}
            onValueChange={([value]) => setExtraSavings(value)}
            className="py-2"
          />
          <div aria-hidden="true" className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>−1.000 €</span>
            <span>0</span>
            <span>+2.000 €</span>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-lg bg-muted p-4">
            <dt className="text-[13px] text-muted-foreground">Unabhängig ab</dt>
            <dd className="font-mono text-lg font-medium sm:text-[22px]">
              {months === null
                ? "Nicht in 100 J."
                : months === 0
                  ? "Schon jetzt"
                  : formatMonth(addMonths(new Date(`${startMonth}T00:00:00`), months))}
            </dd>
            {months !== null && months > 0 && (
              <dd className="text-xs text-muted-foreground">in {formatDuration(months)}</dd>
            )}
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-muted p-4">
            <dt className="text-[13px] text-muted-foreground">Sparquote</dt>
            <dd className="font-mono text-lg font-medium sm:text-[22px]">{savingsRate(savings, settings.monthlyIncome)} %</dd>
            <dd className="text-xs text-muted-foreground">{formatMoney(savings)} / Monat</dd>
          </div>
        </dl>

        <p aria-live="polite" className={`rounded-lg px-4 py-3.5 font-medium ${toneClass}`}>
          {message}
        </p>
      </CardContent>
    </Card>
  );
}
