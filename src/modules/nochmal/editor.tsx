"use client";

import { CheckCircle2Icon, Redo2Icon, StarIcon, TriangleAlertIcon, Undo2Icon } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { blocksOf, checks, colors, columnPoints, letter, limits, maxScore, type Sheet } from "./data";
import { SheetSvg } from "./sheet-svg";

type Tool = number | "star";

// Paint boxes by hand: pick a colour and tap or drag over boxes, or the star
// tool to set and remove stars. Tapping a column letter makes it the start
// column. The checks below say whether the sheet still plays well.
export function SheetEditor({ sheet, onChange }: { sheet: Sheet; onChange: (sheet: Sheet) => void }) {
  const [tool, setTool] = useState<Tool>(0);
  const [past, setPast] = useState<Sheet[]>([]);
  const [future, setFuture] = useState<Sheet[]>([]);
  const latest = useRef(sheet);
  const painting = useRef<Sheet | null>(null);
  useLayoutEffect(() => {
    latest.current = sheet;
  }, [sheet]);

  const commit = useCallback(
    (next: Sheet, remember = true) => {
      if (remember) {
        setPast((list) => [...list.slice(-59), latest.current]);
        setFuture([]);
      }
      latest.current = next;
      onChange(next);
    },
    [onChange],
  );

  const undo = useCallback(() => {
    const previous = past.at(-1);
    if (!previous) return;
    setPast(past.slice(0, -1));
    setFuture([latest.current, ...future].slice(0, 60));
    latest.current = previous;
    onChange(previous);
  }, [past, future, onChange]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!next) return;
    setFuture(future.slice(1));
    setPast([...past, latest.current].slice(-60));
    latest.current = next;
    onChange(next);
  }, [past, future, onChange]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.target as HTMLElement).closest("input, textarea, select")) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" || key === "y") {
        event.preventDefault();
        if (key === "y" || event.shiftKey) redo();
        else undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  function paint(cell: number) {
    const current = latest.current;
    if (typeof tool !== "number" || current.cells[cell] === tool) return;
    commit({ ...current, cells: current.cells.map((value, i) => (i === cell ? tool : value)) }, false);
  }

  function onCellDown(cell: number, event: PointerEvent) {
    if (event.button !== 0) return;
    const current = latest.current;
    if (tool === "star") {
      const stars = current.stars.includes(cell) ? current.stars.filter((entry) => entry !== cell) : [...current.stars, cell].sort((a, b) => a - b);
      commit({ ...current, stars });
      return;
    }
    painting.current = current;
    (event.currentTarget as SVGElement).ownerSVGElement?.setPointerCapture(event.pointerId);
    paint(cell);
  }

  function onMove(event: PointerEvent<SVGSVGElement>) {
    if (!painting.current) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-cell]");
    if (target) paint(Number(target.getAttribute("data-cell")));
  }

  function onUp() {
    // One stroke is one undo step.
    const before = painting.current;
    painting.current = null;
    if (before && before !== latest.current) {
      setPast((list) => [...list.slice(-59), before]);
      setFuture([]);
    }
  }

  function setStart(col: number) {
    if (col === sheet.start) return;
    commit({ ...sheet, start: col, points: columnPoints(sheet.cols, col) });
  }

  const results = useMemo(() => checks(sheet), [sheet]);
  const tooBig = useMemo(
    () => new Set(blocksOf(sheet).filter((block) => block.cells.length > 6).flatMap((block) => block.cells)),
    [sheet],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <div role="toolbar" aria-label="Werkzeuge" className="flex flex-wrap gap-1.5">
          {colors.map((color, c) => (
            <button
              key={color.name}
              type="button"
              aria-pressed={tool === c}
              onClick={() => setTool(c)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
                tool === c ? "border-brand ring-2 ring-brand/30" : "bg-card text-muted-foreground hover:bg-accent",
              )}
            >
              <span className="size-4 rounded border border-black/30" style={{ background: color.fill }} />
              {color.name}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={tool === "star"}
            onClick={() => setTool("star")}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors [&_svg]:size-4",
              tool === "star" ? "border-brand ring-2 ring-brand/30" : "bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            <StarIcon /> Stern
          </button>
        </div>
        <div className="ml-auto flex gap-1.5">
          <Button type="button" variant="outline" size="icon" onClick={undo} disabled={past.length === 0} aria-label="Rückgängig">
            <Undo2Icon />
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={redo} disabled={future.length === 0} aria-label="Wiederholen">
            <Redo2Icon />
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {tool === "star" ? "Kästchen antippen setzt oder entfernt einen Stern." : "Kästchen antippen oder darüber ziehen färbt sie ein."} Ein
        Buchstabe oben macht die Spalte zur Startspalte (Punkte passen sich an).
      </p>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <SheetSvg
          sheet={sheet}
          highlight={tooBig}
          className="block h-auto w-full touch-none select-none"
          style={{ minWidth: `${sheet.cols * 2.2}rem` }}
          onCellDown={onCellDown}
          onHeaderDown={(col) => setStart(col)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ul className="space-y-1.5 text-sm">
          {results.map((result) => (
            <li key={result.text} className="flex items-start gap-2">
              {result.ok ? (
                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-brand" />
              ) : (
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
              )}
              {result.text}
            </li>
          ))}
          <li className="text-muted-foreground">
            Startspalte {letter(sheet.start)} · höchstens {maxScore(sheet)} Punkte möglich
          </li>
        </ul>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberField label="Farbe zuerst" value={sheet.bonus[0]} min={0} max={20} onChange={(value) => commit({ ...sheet, bonus: [value, sheet.bonus[1]] })} />
          <NumberField label="Farbe später" value={sheet.bonus[1]} min={0} max={20} onChange={(value) => commit({ ...sheet, bonus: [sheet.bonus[0], value] })} />
          <NumberField label="Joker (!)" value={sheet.jokers} {...limits.jokers} onChange={(jokers) => commit({ ...sheet, jokers })} />
          <NumberField label="Stern leer −" value={sheet.starPenalty} min={0} max={10} onChange={(starPenalty) => commit({ ...sheet, starPenalty })} />
        </div>
      </div>
    </div>
  );
}

// A number input that only commits valid values (on blur or Enter).
export function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setText(String(value));
  }
  const apply = () => {
    const number = Math.round(Number(text));
    if (text !== "" && Number.isFinite(number) && number >= min && number <= max) {
      if (number !== value) onChange(number);
    } else setText(String(value));
  };
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={apply}
        onKeyDown={(event) => event.key === "Enter" && apply()}
      />
    </div>
  );
}
