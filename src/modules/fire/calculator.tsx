"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
      <Card className="min-w-0 flex-[1_1_380px]">
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2">
            <NumberField
              id="calc-net-worth"
              label="Aktuelles Vermögen (€)"
              value={netWorth}
              step={1000}
              onChange={(event) => setNetWorth(Number(event.target.value))}
              className="sm:col-span-2"
            />
            <NumberField
              id="calc-income"
              label="Monatliches Einkommen (€)"
              value={settings.monthlyIncome}
              onChange={update("monthlyIncome")}
            />
            <NumberField
              id="calc-expenses"
              label="Monatliche Ausgaben (€)"
              value={settings.monthlyExpenses}
              onChange={update("monthlyExpenses")}
            />
            <NumberField
              id="calc-return"
              label="Erwartete reale Rendite (%)"
              value={settings.expectedReturn}
              step={0.5}
              onChange={update("expectedReturn")}
            />
            <NumberField
              id="calc-withdrawal"
              label="Entnahmerate (%)"
              value={settings.withdrawalRate}
              step={0.25}
              onChange={update("withdrawalRate")}
            />
          </form>
        </CardContent>
      </Card>

      <section
        aria-label="Ergebnis"
        aria-live="polite"
        className="flex min-w-0 flex-[1_1_420px] flex-col gap-7 rounded-xl bg-hero p-8 text-hero-foreground"
      >
        <div className="flex flex-col gap-2">
          <span className="text-sm text-hero-muted">Finanziell unabhängig</span>
          <span className="font-mono text-5xl leading-none font-medium tracking-tight sm:text-[56px]">
            {months === null
              ? "Nicht in 100 J."
              : months === 0
                ? "Schon jetzt"
                : formatMonth(addMonths(new Date(`${startMonth}T00:00:00`), months))}
          </span>
          <span className="text-hero-muted">
            {months === null
              ? "Spar mehr oder gib weniger aus, um dorthin zu kommen."
              : months === 0
                ? "Dein Vermögen deckt deine FIRE-Zahl."
                : `in ${formatDuration(months)}`}
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between text-sm text-hero-muted">
            <span>{progress} % geschafft</span>
            <span className="font-mono">{formatMoney(target)}</span>
          </div>
          <Progress
            value={progress}
            aria-label="Fortschritt zur FIRE-Zahl"
            className="h-3 bg-hero-track"
            indicatorClassName="bg-hero-bar"
          />
        </div>
        <dl className="grid grid-cols-3 gap-4 border-t border-hero-track pt-5">
          <Stat label="FIRE-Zahl" value={formatMoney(target)} />
          <Stat label="Sparen / Monat" value={formatMoney(savings)} />
          <Stat label="Sparquote" value={`${savingsRate(savings, settings.monthlyIncome)} %`} />
        </dl>
      </section>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  step = 50,
  onChange,
  className,
}: {
  id: string;
  label: string;
  value: number;
  step?: number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={id} className="font-normal text-muted-foreground">
        {label}
      </Label>
      <Input id={id} type="number" step={step} value={value} onChange={onChange} className="h-11 font-mono" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[13px] text-hero-muted">{label}</dt>
      <dd className="font-mono text-lg">{value}</dd>
    </div>
  );
}
