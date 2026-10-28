import type { SVGProps } from "react";
import { cn } from "@/lib/utils";
import { court, isArrow, type Arrow, type Diagram, type DiagramItem, type Piece } from "./data";

// A clay court from above with the exercise drawn on it. Colors are fixed
// (it is a picture), so it looks the same in light and dark mode and in print.
// `mono` draws it black on white, for the printed sheet.

const viewBox = `${court.minX} ${court.minY} ${court.maxX - court.minX} ${court.maxY - court.minY}`;
export function Court({ diagram, className, mono = false }: { diagram: Diagram; className?: string; mono?: boolean }) {
  return (
    <CourtSvg className={className} mono={mono} role="img" aria-label="Skizze der Übung">
      {diagram.items.map((item, index) => (
        <DiagramShape key={index} item={item} mono={mono} />
      ))}
    </CourtSvg>
  );
}

export function CourtSvg({ className, children, mono = false, ...props }: SVGProps<SVGSVGElement> & { mono?: boolean }) {
  const line = mono ? { stroke: "#000", strokeWidth: 0.12 } : { stroke: "#fff", strokeWidth: 0.09 };
  return (
    <svg viewBox={viewBox} className={cn("block aspect-[16/29]", mono ? "rounded-none" : "rounded-lg", className)} {...props}>
      <rect x={court.minX} y={court.minY} width={court.maxX - court.minX} height={court.maxY - court.minY} fill={mono ? "#fff" : "#b4583a"} />
      <rect
        x={-court.doubles}
        y={-court.baseline}
        width={court.doubles * 2}
        height={court.baseline * 2}
        fill={mono ? "#fff" : "#c8683f"}
        {...line}
      />
      <line x1={-court.singles} y1={-court.baseline} x2={-court.singles} y2={court.baseline} {...line} />
      <line x1={court.singles} y1={-court.baseline} x2={court.singles} y2={court.baseline} {...line} />
      <line x1={-court.singles} y1={-court.service} x2={court.singles} y2={-court.service} {...line} />
      <line x1={-court.singles} y1={court.service} x2={court.singles} y2={court.service} {...line} />
      <line x1={0} y1={-court.service} x2={0} y2={court.service} {...line} />
      <line x1={0} y1={-court.baseline} x2={0} y2={-court.baseline + 0.3} {...line} />
      <line x1={0} y1={court.baseline} x2={0} y2={court.baseline - 0.3} {...line} />
      {/* Net with posts */}
      <line x1={-court.doubles - 0.9} y1={0} x2={court.doubles + 0.9} y2={0} stroke="#23302b" strokeWidth={0.16} />
      <circle cx={-court.doubles - 0.9} cy={0} r={0.18} fill="#23302b" />
      <circle cx={court.doubles + 0.9} cy={0} r={0.18} fill="#23302b" />
      {children}
    </svg>
  );
}

export function DiagramShape({ item, selected = false, mono = false }: { item: DiagramItem; selected?: boolean; mono?: boolean }) {
  if (mono) return isArrow(item) ? <ArrowShape arrow={item} selected={false} color="#000" /> : <MonoPiece piece={item} />;
  return isArrow(item) ? <ArrowShape arrow={item} selected={selected} /> : <PieceShape piece={item} selected={selected} />;
}

// Black on white: filled = trainer, outlined = kids.
function MonoPiece({ piece }: { piece: Piece }) {
  const { x, y } = piece;
  switch (piece.type) {
    case "coach":
      return (
        <g>
          <circle cx={x} cy={y} r={0.7} fill="#000" />
          <Label x={x} y={y} text={piece.label || "T"} color="#fff" />
        </g>
      );
    case "player":
      return (
        <g>
          <circle cx={x} cy={y} r={0.62} fill="#fff" stroke="#000" strokeWidth={0.12} />
          {piece.label && <Label x={x} y={y} text={piece.label} color="#000" />}
        </g>
      );
    case "cone":
      return <path d={`M${x} ${y - 0.5} L${x + 0.45} ${y + 0.35} L${x - 0.45} ${y + 0.35} Z`} fill="#000" />;
    case "target":
      return (
        <g>
          <circle cx={x} cy={y} r={0.7} fill="none" stroke="#000" strokeWidth={0.14} />
          <circle cx={x} cy={y} r={0.22} fill="#000" />
        </g>
      );
    case "basket":
      return <rect x={x - 0.5} y={y - 0.5} width={1} height={1} rx={0.15} fill="#fff" stroke="#000" strokeWidth={0.14} />;
    case "ball":
      return <circle cx={x} cy={y} r={0.28} fill="#fff" stroke="#000" strokeWidth={0.1} />;
  }
}

const highlight = "#fde047";

function PieceShape({ piece, selected }: { piece: Piece; selected: boolean }) {
  const { x, y } = piece;
  const ring = selected && <circle cx={x} cy={y} r={0.95} fill="none" stroke={highlight} strokeWidth={0.14} />;
  switch (piece.type) {
    case "coach":
      return (
        <g>
          {ring}
          <circle cx={x} cy={y} r={0.7} fill="#16201c" stroke="#fff" strokeWidth={0.1} />
          <Label x={x} y={y} text={piece.label || "T"} color="#fff" />
        </g>
      );
    case "player":
      return (
        <g>
          {ring}
          <circle cx={x} cy={y} r={0.62} fill="#2563eb" stroke="#fff" strokeWidth={0.1} />
          {piece.label && <Label x={x} y={y} text={piece.label} color="#fff" />}
        </g>
      );
    case "cone":
      return (
        <g>
          {ring}
          <path d={`M${x} ${y - 0.5} L${x + 0.45} ${y + 0.35} L${x - 0.45} ${y + 0.35} Z`} fill="#facc15" stroke="#422006" strokeWidth={0.07} />
        </g>
      );
    case "target":
      return (
        <g>
          {ring}
          <circle cx={x} cy={y} r={0.7} fill="none" stroke="#fff" strokeWidth={0.16} />
          <circle cx={x} cy={y} r={0.25} fill="#fff" />
        </g>
      );
    case "basket":
      return (
        <g>
          {ring}
          <rect x={x - 0.5} y={y - 0.5} width={1} height={1} rx={0.15} fill="#475569" stroke="#fff" strokeWidth={0.08} />
          <circle cx={x - 0.18} cy={y - 0.15} r={0.17} fill="#d9f99d" />
          <circle cx={x + 0.2} cy={y - 0.1} r={0.17} fill="#d9f99d" />
          <circle cx={x} cy={y + 0.18} r={0.17} fill="#d9f99d" />
        </g>
      );
    case "ball":
      return (
        <g>
          {ring}
          <circle cx={x} cy={y} r={0.28} fill="#d9f99d" stroke="#365314" strokeWidth={0.05} />
        </g>
      );
  }
}

function Label({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  return (
    <text
      x={x}
      y={y}
      fill={color}
      fontSize={text.length > 1 ? 0.6 : 0.8}
      fontWeight={700}
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fontFamily: "var(--font-sans), sans-serif", userSelect: "none" }}
    >
      {text}
    </text>
  );
}

// Arrowheads are drawn as triangles (no <marker>), so several diagrams on one
// page don't need unique ids.
function ArrowShape({ arrow, selected, color: forced }: { arrow: Arrow; selected: boolean; color?: string }) {
  const { x, y, x2, y2 } = arrow;
  const length = Math.hypot(x2 - x, y2 - y) || 1;
  const ux = (x2 - x) / length;
  const uy = (y2 - y) / length;
  const head = Math.min(0.7, length / 2);
  const baseX = x2 - ux * head;
  const baseY = y2 - uy * head;
  const color = forced ?? (arrow.type === "shot" ? "#fef08a" : "#1e293b");
  return (
    <g>
      {selected && <line x1={x} y1={y} x2={x2} y2={y2} stroke={highlight} strokeWidth={0.45} strokeLinecap="round" opacity={0.6} />}
      <line
        x1={x}
        y1={y}
        x2={baseX}
        y2={baseY}
        stroke={color}
        strokeWidth={0.14}
        strokeDasharray={arrow.type === "run" ? "0.45 0.3" : undefined}
      />
      <path
        d={`M${x2} ${y2} L${baseX - uy * head * 0.45} ${baseY + ux * head * 0.45} L${baseX + uy * head * 0.45} ${baseY - ux * head * 0.45} Z`}
        fill={color}
      />
    </g>
  );
}
