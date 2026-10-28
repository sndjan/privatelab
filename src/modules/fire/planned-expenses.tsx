"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRef } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addPlannedExpense, deletePlannedExpense } from "./actions";
import { formatMoney, formatMonth, type PlannedExpense } from "./calc";

// One-off expenses still to come ("Auto, März 2028"). The projection takes
// them out of net worth in their month.
export function PlannedExpenses({ expenses, startMonth }: { expenses: PlannedExpense[]; startMonth: string }) {
  const form = useRef<HTMLFormElement>(null);
  const upcoming = expenses.filter((expense) => expense.month >= startMonth);
  const past = expenses.filter((expense) => expense.month < startMonth);
  const total = upcoming.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <Card className="min-w-0 flex-[1_1_320px]">
      <CardHeader>
        <CardTitle className="text-lg">
          <h2>Geplante Ausgaben</h2>
        </CardTitle>
        <CardDescription>
          {upcoming.length > 0
            ? `${formatMoney(total)} sind schon verplant und zählen in der Prognose nicht zum Vermögen.`
            : "Größere Ausgaben, die schon feststehen, z. B. ein Auto. Die Prognose zieht sie im jeweiligen Monat ab."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {expenses.length > 0 && (
          <ul className="flex flex-col divide-y">
            {[...upcoming, ...past].map((expense) => (
              <li key={expense.id} className={`flex items-center gap-2 py-2 ${expense.month < startMonth ? "text-muted-foreground" : ""}`}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{expense.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatMonth(expense.month)}
                    {expense.month < startMonth && " · vorbei, zählt nicht mehr"}
                  </span>
                </span>
                <span className="ml-auto shrink-0 font-mono text-debt">−{formatMoney(expense.amount)}</span>
                <form action={deletePlannedExpense}>
                  <input type="hidden" name="expenseId" value={expense.id} />
                  <SubmitButton
                    variant="ghost"
                    size="icon"
                    aria-label={`${expense.name} löschen`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2Icon />
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form
          ref={form}
          action={async (formData) => {
            await addPlannedExpense(formData);
            form.current?.reset();
          }}
          className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_8rem_auto]"
        >
          <div className="col-span-2 space-y-2 sm:col-span-1">
            <Label htmlFor="expense-name" className="font-normal text-muted-foreground">
              Wofür
            </Label>
            <Input id="expense-name" name="name" required maxLength={80} placeholder="z. B. Auto" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-month" className="font-normal text-muted-foreground">
              Wann
            </Label>
            <Input id="expense-month" name="month" type="month" required min={startMonth.slice(0, 7)} className="font-mono" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-amount" className="font-normal text-muted-foreground">
              Betrag
            </Label>
            <div className="relative">
              <Input id="expense-amount" name="amount" type="number" required min={1} step={1} className="pr-8 font-mono" />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">€</span>
            </div>
          </div>
          <SubmitButton variant="outline" className="col-span-2 sm:col-span-1">
            <PlusIcon /> Hinzufügen
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
