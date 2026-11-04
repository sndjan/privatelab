"use client";

import { Redo2Icon, Undo2Icon } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { ArtPanel } from "./art";
import { blocksOf, checks, colors, columnPoints, EMPTY, letter, limits, maxScore, type ArtSlot, type Sheet } from "./data";
import { SheetSvg } from "./sheet-svg";
import { display, Heading, Panel, Stepper } from "./ui";

type Mark = "stars" | "gold" | "diamonds";
type Tool = number | Mark;

const marks: { id: Mark; name: string; hint: string; show: (sheet: Sheet) => boolean }[] = [
  { id: "stars", name: "Stern", hint: "Kästchen antippen setzt oder entfernt einen Stern.", show: () => true },
  {
    id: "gold",
    name: "Goldwürfel",
    hint: "Kästchen antippen setzt oder entfernt ein goldenes Würfelfeld.",
    show: (sheet) => sheet.variant === "sogut" || sheet.gold.length > 0,
  },
  {
    id: "diamonds",
    name: "Diamant",
    hint: "Kästchen antippen setzt oder entfernt einen Diamanten.",
    show: (sheet) => sheet.variant === "xmal" || sheet.diamonds.length > 0,
  },
];

// Paint boxes by hand: pick a colour (or "Ohne Farbe" to clear) and tap or
// drag over boxes, or a mark (star, golden die, diamond) to set and remove it. Tapping a column letter
// makes it the start column. The panel says whether the sheet still plays well.
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
    if (typeof tool !== "number") {
      const list = current[tool];
      const next = list.includes(cell) ? list.filter((entry) => entry !== cell) : [...list, cell].sort((a, b) => a - b);
      commit({ ...current, [tool]: next });
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
  const counts = colors.map((_, c) => sheet.cells.filter((value) => value === c).length);
  const fair = Math.floor(sheet.cells.length / colors.length);
  const toolButton = (active: boolean) =>
    cn(
      "flex h-[46px] cursor-pointer items-center gap-2 rounded-xl border-2 pr-3.5 pl-2 text-sm font-extrabold transition-colors",
      active ? "border-[#ff9a2e] bg-(--nm-chosen)" : "border-(--nm-line) bg-(--nm-field) hover:border-(--nm-line-hover)",
    );
  const set = (patch: Partial<Sheet>) => commit({ ...sheet, ...patch });
  const artSlots: ArtSlot[] = [
    "star",
    ...(marks[1].show(sheet) ? (["gold"] as const) : []),
    ...(marks[2].show(sheet) ? (["diamond"] as const) : []),
    "background",
  ];

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-2 rounded-[18px] border border-(--nm-line) bg-(--nm-panel) p-2.5">
          <div role="toolbar" aria-label="Werkzeuge" className="flex flex-wrap gap-2">
            {colors.map((color, c) => (
              <button key={color.name} type="button" aria-pressed={tool === c} onClick={() => setTool(c)} className={toolButton(tool === c)}>
                <span className="size-7 rounded-[7px]" style={{ background: color.fill }} />
                {color.name}
              </button>
            ))}
            <button type="button" aria-pressed={tool === EMPTY} onClick={() => setTool(EMPTY)} className={toolButton(tool === EMPTY)}>
              <span className="size-7 rounded-[7px] border-2 border-dashed border-(--nm-faint) bg-white" />
              Ohne Farbe
            </button>
            {marks
              .filter((mark) => mark.show(sheet))
              .map((mark) => (
                <button key={mark.id} type="button" aria-pressed={tool === mark.id} onClick={() => setTool(mark.id)} className={toolButton(tool === mark.id)}>
                  <span className="flex size-7 items-center justify-center rounded-[7px] bg-[#2f363d]">
                    <MarkIcon mark={mark.id} />
                  </span>
                  {mark.name}
                </button>
              ))}
          </div>
          <div className="ml-auto flex gap-1.5">
            <button type="button" aria-label="Rückgängig" onClick={undo} disabled={past.length === 0} className={historyButton}>
              <Undo2Icon />
            </button>
            <button type="button" aria-label="Wiederholen" onClick={redo} disabled={future.length === 0} className={historyButton}>
              <Redo2Icon />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[22px] border border-(--nm-line) bg-(--nm-well) p-3 sm:p-5">
          <SheetSvg
            sheet={sheet}
            highlight={tooBig}
            className="block h-auto w-full touch-none select-none"
            style={{ minWidth: `${sheet.cols * 2.6}rem` }}
            onCellDown={onCellDown}
            onHeaderDown={(col) => setStart(col)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        </div>
        <p className="text-sm font-semibold text-(--nm-muted)">
          {tool === EMPTY
            ? "Über Kästchen wischen nimmt ihnen die Farbe."
            : typeof tool === "number"
              ? "Farbe wählen und über Kästchen wischen."
              : marks.find((mark) => mark.id === tool)!.hint} Ein Buchstabe oben
          macht die Spalte zur Startspalte (Punkte passen sich an). Zu große Blöcke sind rot umrandet.
        </p>
      </div>

      <aside className="flex flex-[1_1_320px] flex-col gap-3.5">
        <Panel>
          <Heading className="mb-3">Spielbar?</Heading>
          <ul className="flex flex-col gap-2.5">
            {results.map((result) => (
              <li key={result.text} className="flex items-start gap-2.5 text-[14.5px] leading-snug">
                <span
                  className={cn(
                    "flex size-[22px] shrink-0 items-center justify-center rounded-full text-[13px] font-black text-[#111417]",
                    result.ok ? "bg-[#8cc63f]" : "bg-[#ffcf2e]",
                  )}
                >
                  {result.ok ? "✓" : "!"}
                </span>
                {result.text}
              </li>
            ))}
            <li className="text-sm font-bold text-(--nm-muted)">
              Startspalte {letter(sheet.start)} · höchstens {maxScore(sheet)} Punkte
            </li>
          </ul>
        </Panel>

        <Panel>
          <Heading className="mb-3">Farben</Heading>
          <div className="grid grid-cols-5 gap-1.5">
            {colors.map((color, c) => (
              <div key={color.name} className="flex flex-col items-center gap-1.5 rounded-xl bg-(--nm-field) py-2.5">
                <span className="size-[26px] rounded-[7px]" style={{ background: color.fill }} />
                <span className={cn(display, "text-xl", Math.abs(counts[c] - fair) > 1 && "text-(--nm-warn)")}>{counts[c]}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="grid grid-cols-2 gap-3">
          <Stepper label="Farbe zuerst" value={sheet.bonus[0]} min={0} max={20} onChange={(value) => set({ bonus: [value, sheet.bonus[1]] })} />
          <Stepper label="Farbe später" value={sheet.bonus[1]} min={0} max={20} onChange={(value) => set({ bonus: [sheet.bonus[0], value] })} />
          <Stepper label="Joker" value={sheet.jokers} {...limits.jokers} onChange={(jokers) => set({ jokers })} />
          <Stepper label="Stern leer" value={sheet.starPenalty} min={0} max={10} shown={`−${sheet.starPenalty}`} onChange={(starPenalty) => set({ starPenalty })} />
          {sheet.variant === "sogut" && (
            <>
              <Stepper label="Herzen" value={sheet.hearts} {...limits.hearts} onChange={(hearts) => set({ hearts })} />
              <Stepper label="Sonderwürfel" value={sheet.specials} {...limits.specials} onChange={(specials) => set({ specials })} />
              <Stepper label="Volle Zeile" value={sheet.rowScore} min={0} max={20} onChange={(rowScore) => set({ rowScore })} />
            </>
          )}
          {sheet.variant === "xmal" && (
            <>
              <Stepper label="Pass-Felder" value={sheet.passes} {...limits.passes} onChange={(passes) => set({ passes })} />
              <Stepper label="X-Chips" value={sheet.chips} {...limits.chips} onChange={(chips) => set({ chips })} />
            </>
          )}
        </Panel>

        <ArtPanel sheet={sheet} slots={artSlots} onChange={(next) => commit(next)} />
      </aside>
    </div>
  );
}

const historyButton =
  "flex size-[46px] cursor-pointer items-center justify-center rounded-xl border border-(--nm-line-strong) bg-(--nm-field) text-(--nm-text-soft) hover:bg-(--nm-hover) disabled:cursor-default disabled:text-(--nm-faint) [&_svg]:size-5";

function MarkIcon({ mark }: { mark: Mark }) {
  if (mark === "gold")
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" fill="#e3a640" stroke="#9a6418" strokeWidth="1.4" />
      </svg>
    );
  if (mark === "diamonds")
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2l8 8-8 12-8-12z" fill="#ffffff" />
      </svg>
    );
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17l-5.7 3 1.2-6.3-4.7-4.4 6.4-.8z" fill="#ffffff" />
    </svg>
  );
}
