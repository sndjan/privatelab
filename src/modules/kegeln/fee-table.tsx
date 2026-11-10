"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { columns, displayName, feesOf, formatEuro, type Line, type Rates } from "./data";

const rateLabel = (cents: number) => formatEuro(cents).replace(/\s?€/, " €");

// The table the team knows from the spreadsheet: one row per player, one
// column per kind of fee with its amount in the header, the sum on the right.
export function FeeTable({
  lines,
  rates,
  threshold,
  nicknames,
  onPaid,
}: {
  lines: Line[];
  rates: Rates;
  threshold: number;
  nicknames: Record<string, string>;
  // With it, a "bezahlt" column to tick players off.
  onPaid?: (index: number, paid: boolean) => void;
}) {
  const rows = lines.map((line) => ({ line, fees: feesOf(line, rates, threshold) }));
  const total = rows.reduce((sum, row) => sum + row.fees.sum, 0);
  // Columns stay even when nobody owes anything for them, like on the paper;
  // only a fee switched off in the settings (0 €) is left out.
  const shown = columns.filter((column) => rates[column.id] > 0);

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[34rem] border-collapse text-sm tabular-nums">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th scope="col" className="sticky left-0 bg-background py-2 pr-2 text-left font-medium">
              Spieler
            </th>
            {shown.map((column) => (
              <th key={column.id} scope="col" className="px-1.5 py-2 text-right leading-tight font-medium">
                {column.id === "under" ? `u${threshold}` : column.label}
                <span className="block font-normal">{rateLabel(rates[column.id])}</span>
              </th>
            ))}
            <th scope="col" className="py-2 pl-2 text-right font-medium">
              Gesamt
            </th>
            {onPaid && (
              <th scope="col" className="py-2 pl-3 text-center font-medium">
                bezahlt
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ line, fees }, index) => (
            <tr key={index} className={cn("border-b last:border-0 ", line.paid && onPaid && "text-muted-foreground")}>
              <th scope="row" className="sticky left-0 bg-background py-2 pr-2 text-left font-medium whitespace-nowrap">
                {displayName(line.name, nicknames)}
              </th>
              {shown.map((column) => (
                <td key={column.id} className="px-1.5 py-2 text-right whitespace-nowrap">
                  {fees[column.id] > 0 ? formatEuro(fees[column.id]) : ""}
                </td>
              ))}
              <td className="py-2 pl-2 text-right font-semibold whitespace-nowrap">{fees.sum > 0 ? formatEuro(fees.sum) : "–"}</td>
              {onPaid && (
                <td className="py-2 pl-3 text-center">
                  <Checkbox
                    checked={line.paid}
                    disabled={fees.sum === 0}
                    onCheckedChange={(checked) => onPaid(index, checked === true)}
                    aria-label={`${displayName(line.name, nicknames)} hat bezahlt`}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 font-semibold">
            <th scope="row" className="sticky left-0 bg-background py-2 pr-2 text-left">
              Summe
            </th>
            {shown.map((column) => {
              const sum = rows.reduce((a, row) => a + row.fees[column.id], 0);
              return (
                <td key={column.id} className="px-1.5 py-2 text-right whitespace-nowrap">
                  {sum > 0 ? formatEuro(sum) : ""}
                </td>
              );
            })}
            <td className="py-2 pl-2 text-right whitespace-nowrap">{formatEuro(total)}</td>
            {onPaid && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
