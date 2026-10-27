"use client";

import { Trash2Icon, Undo2Icon } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CourtSvg, DiagramShape } from "./court";
import { clampX, clampY, isArrow, type ArrowType, type Diagram, type DiagramItem, type PieceType } from "./data";

type Tool = PieceType | ArrowType;

const tools: { id: Tool; name: string }[] = [
  { id: "coach", name: "Trainer" },
  { id: "player", name: "Kind" },
  { id: "cone", name: "Hütchen" },
  { id: "target", name: "Ziel" },
  { id: "basket", name: "Korb" },
  { id: "ball", name: "Ball" },
  { id: "run", name: "Laufweg" },
  { id: "shot", name: "Ballweg" },
];

// What a pointer is dragging: a whole item, or one end of an arrow. Moves are
// relative to where the drag started, so a missed pointer event loses nothing.
type Drag = {
  index: number;
  part: "all" | "start" | "end";
  origin: DiagramItem;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  created: boolean;
};

// Drag-and-drop court: pick a tool and tap the court to place it (arrows are
// drawn by dragging), drag anything to move it, tap it to select and delete.
export function DiagramEditor({
  value,
  onChange,
}: {
  value: Diagram;
  onChange: (update: (diagram: Diagram) => Diagram) => void;
}) {
  const [tool, setTool] = useState<Tool | null>("player");
  const [selected, setSelected] = useState<number | null>(null);
  const [history, setHistory] = useState<Diagram[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const items = value.items;

  function point(event: PointerEvent) {
    const matrix = svgRef.current!.getScreenCTM()!.inverse();
    const { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
    return { x: clampX(x), y: clampY(y) };
  }

  function change(update: (items: DiagramItem[]) => DiagramItem[], remember = true) {
    if (remember) setHistory((past) => [...past.slice(-30), value]);
    onChange((diagram) => ({ items: update(diagram.items) }));
  }

  function nextLabel() {
    const used = new Set(items.map((item) => item.type === "player" && "label" in item && item.label));
    let number = 1;
    while (used.has(String(number))) number++;
    return String(number);
  }

  function startDrag(event: PointerEvent, target: Omit<Drag, "startX" | "startY" | "lastX" | "lastY">) {
    const { x, y } = point(event);
    drag.current = { ...target, startX: x, startY: y, lastX: x, lastY: y };
    svgRef.current!.setPointerCapture(event.pointerId);
  }

  function onCourtDown(event: PointerEvent<SVGSVGElement>) {
    if (!tool) {
      setSelected(null);
      return;
    }
    const { x, y } = point(event);
    const index = items.length;
    if (tool === "run" || tool === "shot") {
      const arrow: DiagramItem = { type: tool, x, y, x2: x, y2: y };
      change((current) => [...current, arrow]);
      startDrag(event, { index, part: "end", origin: arrow, created: true });
    } else {
      const piece: DiagramItem = { type: tool, x, y, ...(tool === "player" && { label: nextLabel() }) };
      change((current) => [...current, piece]);
    }
    setSelected(index);
  }

  function onItemDown(event: PointerEvent, index: number, part: Drag["part"] = "all") {
    event.stopPropagation();
    setSelected(index);
    setHistory((past) => [...past.slice(-30), value]);
    startDrag(event, { index, part, origin: items[index], created: false });
  }

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current;
    if (!current) return;
    const { x, y } = point(event);
    current.lastX = x;
    current.lastY = y;
    const { index, part, origin } = current;
    const dx = x - current.startX;
    const dy = y - current.startY;
    let moved: DiagramItem;
    if (!isArrow(origin)) moved = { ...origin, x: clampX(origin.x + dx), y: clampY(origin.y + dy) };
    else if (part === "end") moved = { ...origin, x2: x, y2: y };
    else if (part === "start") moved = { ...origin, x, y };
    else
      moved = {
        ...origin,
        x: clampX(origin.x + dx),
        y: clampY(origin.y + dy),
        x2: clampX(origin.x2 + dx),
        y2: clampY(origin.y2 + dy),
      };
    change((all) => all.map((item, at) => (at === index ? moved : item)), false);
  }

  function onUp() {
    const current = drag.current;
    drag.current = null;
    // A tap with an arrow tool draws nothing.
    if (current?.created && Math.hypot(current.lastX - current.startX, current.lastY - current.startY) < 0.8) {
      change((all) => all.filter((_, at) => at !== current.index), false);
      setHistory((past) => past.slice(0, -1));
      setSelected(null);
    }
  }

  function remove() {
    if (selected === null) return;
    change((all) => all.filter((_, at) => at !== selected));
    setSelected(null);
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((past) => past.slice(0, -1));
    setSelected(null);
    onChange(() => previous);
  }

  const selectedItem = selected !== null ? items[selected] : undefined;
  const labelled = selectedItem && (selectedItem.type === "player" || selectedItem.type === "coach");

  return (
    <div className="space-y-3">
      <div role="toolbar" aria-label="Werkzeuge" className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        {tools.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={tool === entry.id}
            onClick={() => setTool(tool === entry.id ? null : entry.id)}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-1.5 text-xs transition-colors",
              tool === entry.id ? "border-brand bg-good text-good-foreground" : "bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            <ToolIcon tool={entry.id} />
            {entry.name}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        {tool === "run" || tool === "shot"
          ? "Ziehe auf dem Platz vom Start zum Ziel."
          : tool
            ? "Tippe auf den Platz, um es zu setzen. Ziehen verschiebt."
            : "Tippe etwas an, um es auszuwählen, oder ziehe es an eine andere Stelle."}
      </p>

      <div className="flex justify-center">
        <CourtSvg
          ref={svgRef}
          className="max-h-[70vh] w-full max-w-sm touch-none select-none"
          onPointerDown={onCourtDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {items.map((item, index) => (
            <g key={index} className="cursor-grab" onPointerDown={(event) => onItemDown(event, index)}>
              <DiagramShape item={item} selected={index === selected} />
              {isArrow(item) ? (
                <line x1={item.x} y1={item.y} x2={item.x2} y2={item.y2} stroke="transparent" strokeWidth={1.2} />
              ) : (
                <circle cx={item.x} cy={item.y} r={1} fill="transparent" />
              )}
            </g>
          ))}
          {selectedItem && isArrow(selectedItem) && (
            <>
              <Handle x={selectedItem.x} y={selectedItem.y} onPointerDown={(event) => onItemDown(event, selected!, "start")} />
              <Handle x={selectedItem.x2} y={selectedItem.y2} onPointerDown={(event) => onItemDown(event, selected!, "end")} />
            </>
          )}
        </CourtSvg>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={undo} disabled={history.length === 0}>
          <Undo2Icon /> Rückgängig
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={remove}
          disabled={selected === null}
          className="text-destructive hover:text-destructive"
        >
          <Trash2Icon /> Löschen
        </Button>
        {labelled && (
          <Input
            aria-label="Beschriftung"
            placeholder="Text"
            maxLength={3}
            value={("label" in selectedItem && selectedItem.label) || ""}
            onChange={(event) =>
              change((all) => all.map((item, at) => (at === selected ? { ...item, label: event.target.value } : item)), false)
            }
            className="h-8 w-20"
          />
        )}
        {items.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto text-muted-foreground"
            onClick={() => {
              change(() => []);
              setSelected(null);
            }}
          >
            Alles leeren
          </Button>
        )}
      </div>
    </div>
  );
}

function Handle({ x, y, onPointerDown }: { x: number; y: number; onPointerDown: (event: PointerEvent) => void }) {
  return (
    <circle cx={x} cy={y} r={0.5} fill="#fde047" stroke="#422006" strokeWidth={0.08} className="cursor-move" onPointerDown={onPointerDown} />
  );
}

function ToolIcon({ tool }: { tool: Tool }) {
  const item: DiagramItem =
    tool === "run" || tool === "shot" ? { type: tool, x: -0.9, y: 0.9, x2: 0.9, y2: -0.9 } : { type: tool, x: 0, y: 0, ...(tool === "player" && { label: "1" }) };
  return (
    <svg viewBox="-1.25 -1.25 2.5 2.5" aria-hidden="true" className="size-7 rounded-md bg-[#c8683f]">
      <DiagramShape item={item} />
    </svg>
  );
}
