"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { columns, displayName, feesOf, formatEuro, type Fees, type Line, type Rates } from "./data";

type Row = { line: Line; fees: Fees };
type Props = {
  lines: Line[];
  rates: Rates;
  threshold: number;
  nicknames: Record<string, string>;
  // With it, a "bezahlt" tick per player.
  onPaid?: (index: number, paid: boolean) => void;
};

// What each player pays. On a phone a list (one player per row, the fees as
// one short line under the name); from sm on the table the team knows from
// the spreadsheet, one column per kind of fee with its amount in the header.
export function FeeTable(props: Props) {
  const { lines, rates, threshold } = props;
  const rows = lines.map((line) => ({ line, fees: feesOf(line, rates, threshold) }));
  // A fee switched off in the settings (0 €) is left out.
  const shown = columns.filter((column) => rates[column.id] > 0);
  return (
    <>
      <FeeList {...props} rows={rows} shown={shown} />
      <FeeGrid {...props} rows={rows} shown={shown} />
    </>
  );
}

type Inner = Props & { rows: Row[]; shown: typeof columns };

const columnLabel = (id: (typeof columns)[number]["id"], label: string, threshold: number) => (id === "under" ? `u${threshold}` : label);

// "Fehler 3× = 0,90 €": the count where there is one, so it can be checked.
function feeParts({ line, fees }: Row, shown: typeof columns, threshold: number) {
  const counts: Partial<Record<(typeof columns)[number]["id"], number>> = { error: line.errors, two: line.twos, golden: line.golden };
  return shown
    .filter((column) => fees[column.id] > 0)
    .map((column) => {
      const count = counts[column.id];
      const label = column.id === "start" ? "Start" : column.id === "point" ? "Punkt" : columnLabel(column.id, column.label, threshold);
      return `${label}${count && count > 1 ? ` ${count}×` : ""} ${formatEuro(fees[column.id])}`;
    });
}

function FeeList({ rows, shown, threshold, nicknames, onPaid }: Inner) {
  const total = rows.reduce((sum, row) => sum + row.fees.sum, 0);
  return (
    <ul className="divide-y text-sm sm:hidden">
      {rows.map((row, index) => {
        const name = displayName(row.line.name, nicknames);
        const parts = feeParts(row, shown, threshold);
        return (
          <li key={index} className={cn("flex items-start gap-3 py-2.5", row.line.paid && onPaid && "text-muted-foreground")}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{name}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {parts.length === 0
                  ? "nichts"
                  : parts.map((part, i) => (
                      // Each fee stays on one line; the dot stays with the fee before it.
                      <span key={i}>
                        <span className="whitespace-nowrap">
                          {part}
                          {i < parts.length - 1 && " ·"}
                        </span>{" "}
                      </span>
                    ))}
              </p>
            </div>
            <span className="pt-px font-semibold whitespace-nowrap tabular-nums">{row.fees.sum > 0 ? formatEuro(row.fees.sum) : "–"}</span>
            {onPaid && (
              <Checkbox
                className="mt-0.5 size-5"
                checked={row.line.paid}
                disabled={row.fees.sum === 0}
                onCheckedChange={(checked) => onPaid(index, checked === true)}
                aria-label={`${name} hat bezahlt`}
              />
            )}
          </li>
        );
      })}
      <li className="flex items-baseline gap-3 py-2.5 font-semibold">
        <span className="flex-1">Summe</span>
        <span className="tabular-nums">{formatEuro(total)}</span>
        {onPaid && <span className="w-5" aria-hidden="true" />}
      </li>
    </ul>
  );
}

function FeeGrid({ rows, shown, threshold, rates, nicknames, onPaid }: Inner) {
  const total = rows.reduce((sum, row) => sum + row.fees.sum, 0);
  return (
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full border-collapse text-sm tabular-nums">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-2 text-left font-medium">
              Spieler
            </th>
            {shown.map((column) => (
              <th key={column.id} scope="col" className="px-1.5 py-2 text-right leading-tight font-medium">
                {columnLabel(column.id, column.label, threshold)}
                <span className="block font-normal whitespace-nowrap">{formatEuro(rates[column.id])}</span>
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
            <tr key={index} className={cn("border-b last:border-0", line.paid && onPaid && "text-muted-foreground")}>
              <th scope="row" className="py-2 pr-2 text-left font-medium whitespace-nowrap">
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
            <th scope="row" className="py-2 pr-2 text-left">
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
