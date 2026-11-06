"use client";

import { addMonths, countIn, formatMonth, formatNumber, formatShortMonth, monthEnd, periodRange } from "./calc";
import { colorHex, unitName, type Entry, type EventType } from "./data";
import { useEventsData } from "./store";
import { TypeIcon } from "./ui";

// Per type: this week / month / year (moments count entries, spans days),
// the average amount and rating this year, and the last 12 months as bars.
export function StatsTab({ today }: { today: string }) {
  const { types, entries } = useEventsData();
  if (types.length === 0) return <p className="text-sm text-muted-foreground">Noch keine Typen angelegt.</p>;
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {types.map((type) => (
        <li key={type.id}>
          <TypeStats type={type} entries={entries} today={today} />
        </li>
      ))}
    </ul>
  );
}

function TypeStats({ type, entries, today }: { type: EventType; entries: Entry[]; today: string }) {
  const count = (period: "week" | "month" | "year") => {
    const { from, to } = periodRange(period, today);
    return countIn(type, entries, from, to, today);
  };
  const tiles = [
    { label: "Diese Woche", value: count("week") },
    { label: "Dieser Monat", value: count("month") },
    { label: "Dieses Jahr", value: count("year") },
  ];

  const yearEntries = entries.filter((entry) => entry.typeId === type.id && entry.startDate.startsWith(today.slice(0, 4)));
  const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
  const amounts = type.trackAmount ? yearEntries.flatMap((entry) => (entry.amount === null ? [] : [entry.amount])) : [];
  const ratings = type.trackRating ? yearEntries.flatMap((entry) => (entry.rating === null ? [] : [entry.rating])) : [];
  const averageAmount = average(amounts);
  const averageRating = average(ratings);
  const totalAmount = amounts.reduce((sum, value) => sum + value, 0);

  const thisMonth = today.slice(0, 7);
  const months = Array.from({ length: 12 }, (_, index) => addMonths(thisMonth, index - 11)).map((month) => ({
    month,
    value: countIn(type, entries, `${month}-01`, monthEnd(`${month}-01`), today),
  }));

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <TypeIcon type={type} className="size-8 text-base" />
        {type.name}
        <span className="ml-auto text-xs font-normal text-muted-foreground">{type.kind === "span" ? "in Tagen" : "Anzahl"}</span>
      </h2>
      <dl className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg bg-muted/60 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{tile.label}</dt>
            <dd className="text-xl font-semibold tabular-nums">
              {tile.value}
              <span className="ml-1 text-xs font-normal text-muted-foreground">{unitName(type.kind, tile.value)}</span>
            </dd>
          </div>
        ))}
      </dl>
      {(averageAmount !== null || averageRating !== null) && (
        <p className="text-sm text-muted-foreground">
          {[
            averageAmount !== null &&
              `Ø ${formatNumber(averageAmount)} ${type.amountUnit} (insgesamt ${formatNumber(totalAmount)} ${type.amountUnit})`.replace(/\s+\)/, ")"),
            averageRating !== null && `Ø Bewertung ${formatNumber(Math.round(averageRating * 10) / 10)} von 5`,
          ]
            .filter(Boolean)
            .join(" · ")}{" "}
          in {today.slice(0, 4)}
        </p>
      )}
      <MonthBars months={months} color={colorHex(type.color)} type={type} />
    </section>
  );
}

// Twelve thin bars on a shared baseline, rounded at the top, with the value
// on hover / focus and in a table for screen readers.
function MonthBars({ months, color, type }: { months: { month: string; value: number }[]; color: string; type: EventType }) {
  const max = Math.max(1, ...months.map((month) => month.value));
  return (
    <figure>
      <figcaption className="mb-2 text-xs text-muted-foreground">Letzte 12 Monate</figcaption>
      <div aria-hidden="true" className="flex h-24 items-end gap-0.5 border-b border-border">
        {months.map(({ month, value }) => (
          <div key={month} className="group relative flex h-full flex-1 items-end justify-center">
            <div
              className="w-full max-w-5 rounded-t-[4px]"
              style={{ height: value ? `${Math.max(4, (value / max) * 100)}%` : 0, backgroundColor: color }}
            />
            <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-sm group-hover:block">
              {formatMonth(month)}: {value} {unitName(type.kind, value)}
            </span>
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="mt-1 flex gap-0.5 text-center text-[10px] text-muted-foreground">
        {months.map(({ month }, index) => (
          <span key={month} className="flex-1 truncate">
            {index % 2 === 1 ? formatShortMonth(month).replace(".", "") : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>
          {type.name}, letzte 12 Monate
        </caption>
        <tbody>
          {months.map(({ month, value }) => (
            <tr key={month}>
              <th scope="row">{formatMonth(month)}</th>
              <td>
                {value} {unitName(type.kind, value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
