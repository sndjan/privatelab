"use client";

import { PencilIcon } from "lucide-react";
import { useState } from "react";
import { saveBalances } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, formatMonth, formatSignedMoney, signedBalance, type AccountKind } from "./calc";

type Account = { id: string; name: string; kind: AccountKind; lastBalance: number | undefined };

type Props = {
  // lastBalance is what the month starts from: the last known balance, or
  // when editing, the account's balance in that month.
  accounts: Account[];
  netWorth: number;
  // YYYY-MM the form starts on.
  defaultMonth: string;
  // Editing an existing month: the month is fixed and fields start with the
  // entered values; emptying a field removes that entry.
  edit?: { values: Record<string, number> };
};

function formatAmount(value: number) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value);
}

function monthName(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("de-DE", { month: "long" });
}

// Accepts "98150", "98.150", "98.150,50" and "98150.50".
function parseAmount(value: string) {
  let text = value.replace(/\s/g, "");
  if (text === "") return null;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

// Button plus dialog to enter one month's balances. Empty fields keep the
// account's last balance.
export function RecordMonth({ accounts, netWorth, defaultMonth, edit }: Props) {
  const initialValues = () =>
    Object.fromEntries(Object.entries(edit?.values ?? {}).map(([id, value]) => [id, formatAmount(value)]));
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(defaultMonth);
  const [values, setValues] = useState<Record<string, string>>(initialValues);

  const change = accounts.reduce((sum, account) => {
    const value = parseAmount(values[account.id] ?? "");
    if (value === null) return sum;
    return sum + signedBalance(account.kind, value) - signedBalance(account.kind, account.lastBalance ?? 0);
  }, 0);

  async function save(formData: FormData) {
    // The server parses "," as decimal separator only, so drop thousands dots.
    for (const account of accounts) {
      const value = parseAmount(String(formData.get(`balance:${account.id}`) ?? ""));
      formData.set(`balance:${account.id}`, value === null ? "" : String(value));
    }
    await saveBalances(formData);
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setMonth(defaultMonth);
          setValues(initialValues());
        }
      }}
    >
      <DialogTrigger asChild>
        {edit ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${formatMonth(`${defaultMonth}-01`)} bearbeiten`}
            className="text-muted-foreground"
          >
            <PencilIcon />
          </Button>
        ) : (
          <Button>{monthName(defaultMonth)} eintragen</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{edit ? `${formatMonth(`${defaultMonth}-01`)} bearbeiten` : "Monat eintragen"}</DialogTitle>
            <DialogDescription>
              {edit
                ? "Ein leeres Feld löscht den Eintrag; dann zählt der letzte bekannte Stand."
                : "Lass ein Feld leer, um den letzten Stand zu behalten."}
            </DialogDescription>
          </DialogHeader>

          {edit ? (
            <>
              <input type="hidden" name="month" value={defaultMonth} />
              <input type="hidden" name="replace" value="true" />
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="record-month">Monat</Label>
              <Input
                id="record-month"
                type="month"
                name="month"
                required
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="h-11"
              />
            </div>
          )}

          <div className="divide-y rounded-lg border px-4">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center gap-3 py-3">
                <Label htmlFor={`record-${defaultMonth}-${account.id}`} className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <span className="truncate">{account.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {account.kind === "debt" && "Restschuld · "}
                    {account.lastBalance === undefined
                      ? "noch kein Stand"
                      : `${edit ? "bisher" : "zuletzt"} ${formatMoney(account.lastBalance)}`}
                  </span>
                </Label>
                <Input
                  id={`record-${defaultMonth}-${account.id}`}
                  type="text"
                  inputMode="decimal"
                  name={`balance:${account.id}`}
                  value={values[account.id] ?? ""}
                  onChange={(event) => setValues({ ...values, [account.id]: event.target.value })}
                  placeholder={account.lastBalance === undefined ? "" : formatAmount(account.lastBalance)}
                  className={`h-11 w-32 text-right font-mono ${account.kind === "debt" ? "text-debt" : ""}`}
                />
              </div>
            ))}
          </div>

          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-muted-foreground">{edit ? "Vermögen in diesem Monat" : "Neues Vermögen"}</span>
            <span className="flex items-baseline gap-2.5" aria-live="polite">
              {change !== 0 && (
                <span className={`font-mono text-[13px] ${change > 0 ? "text-brand" : "text-debt"}`}>
                  {formatSignedMoney(change)}
                </span>
              )}
              <span className="font-mono text-xl font-medium sm:text-[22px]">{formatMoney(netWorth + change)}</span>
            </span>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Abbrechen
              </Button>
            </DialogClose>
            <Button size="lg">{month ? `${monthName(month)} speichern` : "Speichern"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
