"use client";

import { useState } from "react";
import { saveBalances } from "./actions";
import { formatMoney, formatSignedMoney, signedBalance, type AccountKind } from "./calc";
import { cardClass, headingClass, inputClass, labelClass, primaryButtonClass } from "./ui";

type Account = { id: string; name: string; kind: AccountKind; lastBalance: number | undefined };

type Props = {
  accounts: Account[];
  netWorth: number;
  // YYYY-MM the form starts on.
  defaultMonth: string;
};

function monthName(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long" });
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

// Header of the balances card plus the form for one month's balances. Empty
// fields keep the account's last balance.
export function RecordMonth({ accounts, netWorth, defaultMonth }: Props) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(defaultMonth);
  const [values, setValues] = useState<Record<string, string>>({});

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
    setValues({});
    setOpen(false);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="balances-heading" className={headingClass}>
          Monthly balances
        </h2>
        {accounts.length > 0 && !open && (
          <button type="button" onClick={() => setOpen(true)} className={primaryButtonClass}>
            Record {monthName(defaultMonth)}
          </button>
        )}
      </div>

      {accounts.length === 0 && <p className="text-sm text-fire-muted">Add an account first.</p>}

      {open && (
        <form action={save} className="max-w-md space-y-4 rounded-2xl bg-fire-ground p-4">
          <label className={labelClass}>
            Month
            <input
              type="month"
              name="month"
              required
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className={`${inputClass} min-h-12 font-fire text-base`}
            />
          </label>

          <div className={`${cardClass} px-4 py-1`}>
            {accounts.map((account, index) => (
              <label
                key={account.id}
                className={`flex items-center gap-3 py-3 ${index > 0 ? "border-t border-fire-subtle" : ""}`}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{account.name}</span>
                  <span className="text-xs text-fire-muted">
                    {account.kind === "debt" && "amount owed · "}
                    {account.lastBalance === undefined ? "no balance yet" : `last ${formatMoney(account.lastBalance)}`}
                  </span>
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  name={`balance:${account.id}`}
                  value={values[account.id] ?? ""}
                  onChange={(event) => setValues({ ...values, [account.id]: event.target.value })}
                  placeholder={account.lastBalance === undefined ? "" : String(account.lastBalance)}
                  className={`${inputClass} w-32 text-right text-base ${account.kind === "debt" ? "text-fire-debt" : ""}`}
                />
              </label>
            ))}
          </div>

          <p className="text-[13px] text-fire-muted">Leave a field empty to keep its last balance.</p>

          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-fire-muted">New net worth</span>
            <span className="flex items-baseline gap-2.5">
              {change !== 0 && (
                <span className={`font-figures text-[13px] ${change > 0 ? "text-fire-accent" : "text-fire-debt"}`}>
                  {formatSignedMoney(change)}
                </span>
              )}
              <span className="font-figures text-[22px] font-medium">{formatMoney(netWorth + change)}</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className={`${primaryButtonClass} min-h-[52px] flex-1 text-base font-semibold`}>
              Save {month ? monthName(month) : "month"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-[52px] rounded-xl px-4 font-medium text-fire-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </>
  );
}
