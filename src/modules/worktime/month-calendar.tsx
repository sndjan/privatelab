"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { resetDay, saveDay } from "./actions";
import {
  dayKinds,
  formatDay,
  formatHours,
  formatTime,
  weekday,
  weekdayNames,
  workedMinutes,
  type DayInfo,
  type DayKind,
} from "./calc";

export type CalendarDay = {
  info: DayInfo;
  // The times the day counts with when nothing was entered.
  standard: { start: number; end: number; breakMinutes: number };
  // Part of the overtime balance (between the opening date and today).
  counted: boolean;
  inMonth: boolean;
};

type Props = {
  // Whole weeks, Monday to Sunday.
  days: CalendarDay[];
  initialDate: string;
  today: string;
};

const breakStep = 15;
const maxBreak = 180;

// Month grid with the selected day's editor above it. Tapping a day selects it.
export function MonthCalendar({ days, initialDate, today }: Props) {
  const [selected, setSelected] = useState(initialDate);
  const day = days.find((candidate) => candidate.info.date === selected) ?? days.find((d) => d.inMonth)!;

  return (
    <div className="space-y-5">
      <DayEditor key={JSON.stringify([day.info.date, day.info.entry, day.info.target])} day={day} />

      <div>
        <div aria-hidden="true" className="grid grid-cols-7 gap-1 pb-1 text-center text-xs text-muted-foreground">
          {weekdayNames.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
        <div role="grid" aria-label="Monat" className="grid grid-cols-7 gap-1">
          {days.map((cell) => (
            <DayCell
              key={cell.info.date}
              cell={cell}
              today={today}
              selected={cell.info.date === day.info.date}
              onSelect={() => setSelected(cell.info.date)}
            />
          ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-sm" style={item.style} />
              {item.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const tint = (color: string, percent = 22) => `color-mix(in oklab, ${color} ${percent}%, transparent)`;

// short: label inside a cell on phones (holidays only show their color there).
const statusStyle: Partial<Record<DayInfo["status"], { color: string; short: string; className?: string }>> = {
  vacation: { color: tint("var(--chart-2)", 35), short: "Urlaub" },
  holiday: { color: tint("var(--chart-4)", 30), short: "" },
  sick: { color: tint("var(--chart-5)", 25), short: "Krank" },
  overtime_off: { color: "transparent", short: "Gleit", className: "border-dashed border-brand/70" },
};

const legend = [
  { label: "Urlaub", style: { background: statusStyle.vacation!.color } },
  { label: "Feiertag", style: { background: statusStyle.holiday!.color } },
  { label: "Krank", style: { background: statusStyle.sick!.color } },
  { label: "Gleittag", style: { border: "1px dashed var(--brand)" } },
];

function DayCell({
  cell,
  today,
  selected,
  onSelect,
}: {
  cell: CalendarDay;
  today: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { info } = cell;
  const style = statusStyle[info.status];
  const delta = info.actual - info.target;
  const weekend = weekday(info.date) >= 5;
  const fullLabel =
    info.status === "holiday"
      ? info.holiday
      : info.status === "vacation"
        ? (info.vacation?.note ?? (info.vacation?.fromOvertime ? "Urlaub (Überstunden)" : "Urlaub"))
        : style?.short;

  return (
    <button
      type="button"
      role="gridcell"
      aria-selected={selected}
      aria-label={`${formatDay(info.date)}${fullLabel ? `, ${fullLabel}` : ""}${
        delta !== 0 ? `, ${formatHours(delta, { signed: true })}` : ""
      }`}
      onClick={onSelect}
      className={`flex h-14 min-w-0 flex-col items-start justify-between rounded-md border p-1 text-left transition-colors sm:h-20 sm:p-1.5 ${
        selected ? "border-brand ring-2 ring-brand/40" : (style?.className ?? "border-transparent hover:border-input")
      } ${cell.inMonth ? "" : "opacity-40"} ${!style && !weekend ? "bg-muted/50" : ""}`}
      style={style ? { background: style.color } : undefined}
    >
      <span
        className={`flex size-6 items-center justify-center rounded-full text-sm ${
          info.date === today ? "bg-brand font-semibold text-brand-foreground" : weekend ? "text-muted-foreground" : ""
        }`}
      >
        {Number(info.date.slice(8))}
      </span>
      <span className="w-full min-w-0 truncate text-[10px] leading-tight sm:text-xs">
        {info.entry?.kind === "work" || (delta !== 0 && !style) ? (
          <span className={`font-mono ${cell.counted ? deltaClass(delta) : "text-muted-foreground"}`}>
            {delta === 0 ? "±0" : formatHours(delta, { signed: true }).replace(" h", "")}
          </span>
        ) : style ? (
          <>
            {style.short && <span className="sm:hidden">{style.short}</span>}
            <span className="hidden sm:inline">{fullLabel}</span>
          </>
        ) : null}
      </span>
    </button>
  );
}

function deltaClass(minutes: number) {
  if (minutes > 0) return "text-good-foreground dark:text-brand";
  if (minutes < 0) return "text-debt";
  return "";
}

function describe(info: DayInfo) {
  if (info.status === "holiday") return info.holiday ?? "Feiertag";
  if (info.status === "vacation") {
    const label = info.vacation?.fromOvertime ? "Urlaub aus Überstunden" : "Urlaub";
    return info.vacation?.note ? `${label} · ${info.vacation.note}` : label;
  }
  if (info.entry) return "Geändert";
  return info.target > 0 ? "Standardtag" : "Frei";
}

// Work times on a 15-minute slider, or sick / overtime day off, for one day.
function DayEditor({ day }: { day: CalendarDay }) {
  const { info, standard } = day;
  const { entry, target } = info;
  const initial = {
    kind: entry?.kind ?? ("work" as DayKind),
    range: [entry?.start ?? standard.start, entry?.end ?? standard.end] as [number, number],
    breakMinutes: entry?.kind === "work" ? entry.breakMinutes : standard.breakMinutes,
  };
  const [kind, setKind] = useState<DayKind>(initial.kind);
  const [range, setRange] = useState<[number, number]>(initial.range);
  const [breakMinutes, setBreakMinutes] = useState(initial.breakMinutes);
  // Vacation, holidays and free days need no entry; the form opens on demand.
  const [editing, setEditing] = useState(Boolean(entry) || info.status === "standard");

  const min = Math.min(5 * 60, range[0] - (range[0] % 15));
  const max = Math.max(22 * 60, range[1]);
  const actual =
    kind === "work" ? workedMinutes({ start: range[0], end: range[1], breakMinutes }) : kind === "sick" ? target : 0;
  const changed =
    kind !== initial.kind ||
    (kind === "work" &&
      (range[0] !== initial.range[0] || range[1] !== initial.range[1] || breakMinutes !== initial.breakMinutes));
  // An untouched standard day can still be saved, e.g. to confirm a day off as worked.
  const canSave = changed || (!entry && info.status !== "standard");
  const delta = actual - target;

  return (
    <form action={saveDay} className="space-y-4 rounded-xl border bg-muted/40 p-4">
      <input type="hidden" name="day" value={info.date} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="start" value={range[0]} />
      <input type="hidden" name="end" value={range[1]} />
      <input type="hidden" name="break" value={breakMinutes} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{formatDay(info.date)}</h3>
          <p className="truncate text-sm text-muted-foreground">
            {describe(info)} · Soll {formatHours(target)}
          </p>
        </div>
        <div aria-live="polite" className="shrink-0 text-right font-mono">
          <div className="text-lg leading-tight font-medium">{formatHours(editing ? actual : info.actual)}</div>
          <div className={`text-sm ${deltaClass(editing ? delta : info.actual - target)}`}>
            {formatHours(editing ? delta : info.actual - target, { signed: true })}
          </div>
        </div>
      </div>

      {!editing ? (
        <Button type="button" variant="outline" className="w-full bg-card" onClick={() => setEditing(true)}>
          Trotzdem eintragen
        </Button>
      ) : (
        <>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            aria-label="Art des Tages"
            value={kind}
            onValueChange={(value) => value && setKind(value as DayKind)}
            className="w-full bg-card"
          >
            {dayKinds.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value} className="flex-1 px-2 text-[13px]">
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          {kind === "work" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span id="range-label" className="text-sm text-muted-foreground">
                    Arbeitszeit
                  </span>
                  <strong className="font-mono text-xl font-medium">
                    {formatTime(range[0])} – {formatTime(range[1])}
                  </strong>
                </div>
                <Slider
                  aria-labelledby="range-label"
                  min={min}
                  max={max}
                  step={15}
                  minStepsBetweenThumbs={1}
                  value={range}
                  onValueChange={(value) => setRange([value[0], value[1]])}
                  className="py-3"
                />
              </div>
              <div className="flex items-center gap-3">
                <span id="break-label" className="shrink-0 text-sm text-muted-foreground">
                  Pause
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Pause 15 Minuten kürzer"
                    disabled={breakMinutes <= 0}
                    onClick={() => setBreakMinutes(breakMinutes - breakStep)}
                    className="bg-card"
                  >
                    <MinusIcon />
                  </Button>
                  <output aria-labelledby="break-label" className="w-20 text-center font-mono">
                    {breakMinutes} min
                  </output>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Pause 15 Minuten länger"
                    disabled={breakMinutes + breakStep > maxBreak || breakMinutes + breakStep >= range[1] - range[0]}
                    onClick={() => setBreakMinutes(breakMinutes + breakStep)}
                    className="bg-card"
                  >
                    <PlusIcon />
                  </Button>
                </div>
              </div>
            </div>
          )}
          {kind === "sick" && <p className="text-sm text-muted-foreground">Zählt wie ein erfüllter Arbeitstag.</p>}
          {kind === "overtime_off" && (
            <p className="text-sm text-muted-foreground">Wird von den Überstunden abgezogen.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <SubmitButton disabled={!canSave} variant="brand" className="flex-1">
              Speichern
            </SubmitButton>
            {entry && (
              <SubmitButton formAction={resetDay} variant="outline" className="flex-1 bg-card">
                Zurück auf Standard
              </SubmitButton>
            )}
          </div>
        </>
      )}
    </form>
  );
}

function SubmitButton({ disabled, ...props }: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return <Button {...props} disabled={disabled || pending} />;
}
