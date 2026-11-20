"use client";

import { DownloadIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { formatClock } from "./analytics";
import { formatPace } from "./calc";
import type { YearReview } from "./wrapped";

// "Dein Sportjahr": a story of eight cards, tap right for next, left for back
// (or arrow keys), shown over the page. Colours are fixed (own look, like the design).

const n0 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const n1 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dateLong = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", timeZone: "UTC" });
const dateShort = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
const hm = (hours: number) => `${Math.floor(hours)}:${String(Math.round((hours % 1) * 60)).padStart(2, "0")}`;
const millions = (value: number) => (value >= 1_000_000 ? `${n1.format(value / 1_000_000)} Mio.` : n0.format(value));

const CARDS = [
  { bg: "#16201c", fg: "#f3f4f1" },
  { bg: "#a9471a", fg: "#ffffff" },
  { bg: "#7fd1ac", fg: "#0b1410" },
  { bg: "#1e6a4e", fg: "#ffffff" },
  { bg: "#16201c", fg: "#f3f4f1" },
  { bg: "#f3f4f1", fg: "#16201c" },
  { bg: "#e8d9c6", fg: "#16201c" },
  { bg: "#16201c", fg: "#f3f4f1" },
];

export function WrappedStory({ review, name, onClose }: { review: YearReview; name: string; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const card = CARDS[index];
  const light = card.fg === "#0b1410" || card.fg === "#16201c";
  const next = () => setIndex((value) => Math.min(CARDS.length - 1, value + 1));
  const prev = () => setIndex((value) => Math.max(0, value - 1));

  useEffect(() => {
    ref.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const summary = [
    { label: "Aktive Tage", value: n0.format(review.activeDays), bg: "#16201c", fg: "#f3f4f1" },
    { label: "Gelaufen", value: `${n0.format(review.runKm)} km`, bg: "#1e6a4e", fg: "#ffffff" },
    { label: "Gym", value: `${n0.format(review.tonnes)} t`, bg: "#a9471a", fg: "#ffffff" },
    { label: "Schritte", value: millions(review.steps), bg: "#7fd1ac", fg: "#0b1410" },
    { label: "Schlaf", value: review.sleepAvg ? `${hm(review.sleepAvg)} h` : "–", bg: "#e8d9c6", fg: "#16201c" },
    { label: "Bestwerte", value: n0.format(review.recordCount), bg: "#ffffff", fg: "#16201c" },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 sm:p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`Dein Sportjahr ${review.year}, Karte ${index + 1} von ${CARDS.length}`}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === " ") { event.preventDefault(); next(); }
          if (event.key === "ArrowLeft") { event.preventDefault(); prev(); }
          if (event.key === "Escape") onClose();
        }}
        className="relative h-dvh w-full overflow-hidden font-sans outline-none sm:h-[844px] sm:max-h-[94vh] sm:w-[390px] sm:rounded-[28px]"
        style={{ background: card.bg, color: card.fg }}
      >
        <div className="absolute top-[max(14px,env(safe-area-inset-top))] right-3.5 left-3.5 z-30 flex gap-1" aria-hidden="true">
          {CARDS.map((_, position) => (
            <span
              key={position}
              className="h-[3px] flex-1 rounded-full"
              style={{ background: position <= index ? (light ? "rgba(22,32,28,.85)" : "rgba(255,255,255,.95)") : light ? "rgba(22,32,28,.2)" : "rgba(255,255,255,.3)" }}
            />
          ))}
        </div>
        <div className="absolute top-[calc(max(14px,env(safe-area-inset-top))+12px)] right-3 left-[18px] z-30 flex items-center justify-between text-[13px] font-semibold">
          <span className="opacity-85">Dein Sportjahr {review.year}</span>
          <button type="button" onClick={onClose} aria-label="Schließen" className="flex size-10 cursor-pointer items-center justify-center rounded-full">
            <XIcon className="size-5" />
          </button>
        </div>

        <div className="absolute inset-0 px-7 pt-24 pb-[max(110px,calc(env(safe-area-inset-bottom)+90px))]">
          {index === 0 && <Intro review={review} />}
          {index === 1 && <Active review={review} />}
          {index === 2 && <Steps review={review} />}
          {index === 3 && <Running review={review} />}
          {index === 4 && <Gym review={review} />}
          {index === 5 && <Sleep review={review} />}
          {index === 6 && <Heart review={review} />}
          {index === 7 && <Summary review={review} name={name} items={summary} onRestart={() => setIndex(0)} />}
        </div>

        <button type="button" aria-label="Zurück" onClick={prev} className="absolute top-16 left-0 z-20 w-[35%] cursor-w-resize" style={{ bottom: index === 7 ? 120 : 0 }} />
        <button type="button" aria-label="Weiter" onClick={next} className="absolute top-16 right-0 z-20 w-[65%] cursor-e-resize" style={{ bottom: index === 7 ? 120 : 0 }} />
      </div>
    </div>
  );
}

const Big = ({ children, size = 120 }: { children: React.ReactNode; size?: number }) => (
  <p className="m-0 leading-[.9] font-bold tracking-[-0.05em] tabular-nums" style={{ fontSize: `min(${size}px, ${size / 3.9}vw)` }}>
    {children}
  </p>
);
const Lead = ({ children }: { children: React.ReactNode }) => <p className="m-0 text-[22px] leading-tight font-semibold">{children}</p>;
const Text = ({ children }: { children: React.ReactNode }) => <p className="m-0 text-[19px] leading-snug font-medium">{children}</p>;

function Intro({ review }: { review: YearReview }) {
  return (
    <div className="flex h-full flex-col justify-end gap-4">
      <span className="text-[15px] font-semibold tracking-[.08em] text-[#7fd1ac] uppercase">Private Lab · Sport</span>
      <h2 className="m-0 text-[60px] leading-[.95] font-bold tracking-[-0.03em]">Dein Jahr in Zahlen.</h2>
      <p className="m-0 text-lg leading-snug text-[#b9c2bd]">
        Garmin und Hevy, 1. Januar bis {dateLong.format(toDate(review.to))}. Tippe rechts für weiter, links für zurück.
      </p>
      <div className="mt-3 flex gap-2" aria-hidden="true">
        <span className="size-14 rounded-full bg-[#1e6a4e]" />
        <span className="size-14 rounded-[14px] bg-[#a9471a]" />
        <span className="size-14 rounded-[50%_50%_14px_50%] bg-[#7fd1ac]" />
      </div>
    </div>
  );
}

function Active({ review }: { review: YearReview }) {
  const max = Math.max(1, ...review.mix.map((entry) => entry.count));
  return (
    <div className="flex h-full flex-col gap-4">
      <Lead>Du warst an</Lead>
      <Big>{n0.format(review.activeDays)}</Big>
      <Lead>
        Tagen aktiv. Zusammen <strong>{n0.format(review.hours)} Stunden</strong> Training.
      </Lead>
      <div className="mt-auto flex flex-col gap-2.5">
        {review.mix.map((entry) => (
          <div key={entry.label} className="grid grid-cols-[84px_1fr_56px] items-center gap-2.5 text-[15px] font-semibold">
            <span>{entry.label}</span>
            <span className="h-3.5 overflow-hidden rounded-full bg-white/20">
              <span className="block h-full rounded-full bg-white" style={{ width: `${(entry.count / max) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums">{entry.count}×</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Steps({ review }: { review: YearReview }) {
  const max = Math.max(1, ...review.stepsByMonth);
  return (
    <div className="flex h-full flex-col gap-3.5">
      <Lead>Schritte</Lead>
      <Big size={92}>{millions(review.steps)}</Big>
      <Text>
        Das sind etwa <strong>{n0.format(review.stepsKm)} km</strong>, {review.stepsComparison}.
      </Text>
      <div className="mt-auto flex flex-col gap-2">
        <span className="text-sm font-semibold text-[#3d4943]">Schritte pro Monat</span>
        <div className="flex h-36 items-end gap-1.5">
          {review.stepsByMonth.map((value, month) => (
            <div key={month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="w-full rounded-t-md rounded-b-sm" style={{ height: `${(value / max) * 100}%`, background: value === max ? "#16201c" : "#1e6a4e" }} />
              <span className="text-[11px] font-semibold text-[#3d4943]">{monthNames[month][0]}</span>
            </div>
          ))}
        </div>
        {review.bestStepDay && (
          <p className="m-0 text-[15px] font-semibold">
            Bester Tag: {n0.format(review.bestStepDay.steps)} Schritte am {dateLong.format(toDate(review.bestStepDay.day))}.
          </p>
        )}
      </div>
    </div>
  );
}

function Running({ review }: { review: YearReview }) {
  return (
    <div className="flex h-full flex-col gap-3.5">
      <Lead>Gelaufen</Lead>
      <Big>
        {n0.format(review.runKm)}
        <span className="text-[40px] tracking-normal"> km</span>
      </Big>
      <Text>
        in {review.runCount} Läufen.{review.longestRun ? <> Dein längster: <strong>{n1.format(review.longestRun.km)} km</strong> am {dateLong.format(toDate(review.longestRun.day))}.</> : null}
      </Text>
      <div className="mt-auto grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-[18px] bg-black/20 p-4">
          <span className="text-[13px] font-semibold text-[#cfe9dc]">In Zone 1</span>
          <span className="text-[34px] font-bold tabular-nums">{review.zone1 != null ? `${n0.format(review.zone1)} %` : "–"}</span>
          <span className="text-[13px] text-[#cfe9dc]">der Laufzeit</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[18px] bg-black/20 p-4">
          <span className="text-[13px] font-semibold text-[#cfe9dc]">Pace bei 140 bpm</span>
          <span className="text-[34px] font-bold tabular-nums">
            {review.aerobicFrom && review.aerobicTo ? `${review.aerobicTo < review.aerobicFrom ? "−" : "+"}${formatPace(Math.abs(review.aerobicFrom - review.aerobicTo)).replace("/km", "")}` : "–"}
          </span>
          <span className="text-[13px] text-[#cfe9dc]">
            {review.aerobicFrom && review.aerobicTo ? `von ${formatPace(review.aerobicFrom)} auf ${formatPace(review.aerobicTo)}` : "zu wenige Läufe mit Puls"}
          </span>
        </div>
      </div>
    </div>
  );
}

function Gym({ review }: { review: YearReview }) {
  const rows = [
    { label: "Lieblingsübung", value: review.favourite ? `${review.favourite.exercise}, ${review.favourite.count}×` : "–" },
    { label: "Größter Sprung", value: review.jump ? `${review.jump.exercise.replace(/\s*\(.*\)/, "")} ${n1.format(review.jump.from)} → ${n1.format(review.jump.to)} kg` : "–" },
    { label: "Bestwerte", value: n0.format(review.recordCount) },
    { label: "Meiste Sätze", value: review.topMuscle ? `${review.topMuscle.label}, ${n0.format(review.topMuscle.sets)}` : "–" },
  ];
  return (
    <div className="flex h-full flex-col gap-3.5">
      <Lead>Im Gym bewegt</Lead>
      <Big>
        {n0.format(review.tonnes)}
        <span className="text-[40px] tracking-normal"> t</span>
      </Big>
      <Text>
        So schwer wie <strong>{n0.format(review.elephants)} Elefanten</strong>, in {review.gymSessions} Einheiten.
      </Text>
      <ul className="mt-auto flex flex-col gap-2.5">
        {rows.map((row) => (
          <li key={row.label} className="flex justify-between gap-3 rounded-2xl bg-white/[.08] px-4 py-3.5">
            <span className="font-semibold">{row.label}</span>
            <span className="text-right font-semibold text-[#7fd1ac]">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sleep({ review }: { review: YearReview }) {
  return (
    <div className="flex h-full flex-col gap-3.5">
      <Lead>Geschlafen</Lead>
      <Big size={104}>
        {review.sleepAvg ? hm(review.sleepAvg) : "–"}
        <span className="text-[40px] tracking-normal"> h</span>
      </Big>
      <Text>
        pro Nacht. <strong>{review.inRange} von {review.nights} Nächten</strong> lagen in deinem Bereich.
      </Text>
      <div className="mt-auto flex flex-col gap-1.5 rounded-[20px] bg-[#1e6a4e] p-[18px] text-white">
        <span className="text-[13px] font-semibold tracking-[.06em] text-[#b8ecd3] uppercase">Dein Schlaftyp</span>
        <span className="text-[30px] font-bold">{review.sleepType}</span>
        <span className="text-[15px] text-[#d6efe3]">
          Im Schnitt eingeschlafen um {review.bedAvg != null ? formatClock(review.bedAvg, 18) : "–"}, aufgewacht um{" "}
          {review.wakeAvg != null ? formatClock(review.wakeAvg, 0) : "–"}
          {review.wakeSpread != null ? `, meist auf ± ${n0.format(review.wakeSpread)} Minuten genau` : ""}.
        </span>
      </div>
    </div>
  );
}

function Heart({ review }: { review: YearReview }) {
  const rows = [
    { label: "Ruhepuls", from: review.heart.rhrFrom, to: review.heart.rhrTo, digits: 0, note: "bpm, erster Monat gegen die letzten 30 Tage" },
    { label: "VO2max", from: review.heart.vo2From, to: review.heart.vo2To, digits: 1, note: "laut Garmin" },
    { label: "HRV", from: review.heart.hrvFrom, to: review.heart.hrvTo, digits: 0, note: "ms, erster Monat gegen die letzten 30 Tage" },
  ];
  return (
    <div className="flex h-full flex-col gap-3.5">
      <Lead>Dein Herz</Lead>
      <div className="flex flex-col">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5 border-b-2 border-[#16201c]/15 py-3.5">
            <span className="text-[15px] font-semibold">{row.label}</span>
            <span className="flex items-baseline gap-3 tabular-nums">
              <span className="text-[30px] font-semibold text-[#5b6660]">{row.from != null ? (row.digits ? n1 : n0).format(row.from) : "–"}</span>
              <span className="text-[26px] font-bold">→</span>
              <span className="text-[52px] font-bold tracking-[-0.03em]">{row.to != null ? (row.digits ? n1 : n0).format(row.to) : "–"}</span>
            </span>
            <span className="text-sm text-[#3d4943]">{row.note}</span>
          </div>
        ))}
      </div>
      {review.bestMonth && (
        <p className="m-0 mt-auto text-lg leading-snug font-semibold">
          Dein stärkster Monat war der <strong>{monthNames[review.bestMonth.month]}</strong>: {review.bestMonth.days} aktive Tage.
          {review.longestGymStreak > 1 ? ` Längste Serie: ${review.longestGymStreak} Wochen in Folge dein Gym-Ziel.` : ""}
        </p>
      )}
    </div>
  );
}

type SummaryItem = { label: string; value: string; bg: string; fg: string };

function Summary({ review, name, items, onRestart }: { review: YearReview; name: string; items: SummaryItem[]; onRestart: () => void }) {
  const goal = review.raceDay ? `Nächstes Ziel: Halbmarathon am ${dateShort.format(toDate(review.raceDay))}.` : "";
  return (
    <div className="-mx-1.5 -mb-[70px] flex h-[calc(100%+70px)] flex-col gap-3.5">
      <div className="flex flex-1 flex-col gap-3.5 rounded-3xl bg-[#f3f4f1] p-5 text-[#16201c]">
        <div className="flex items-baseline justify-between">
          <span className="text-[26px] font-bold tracking-[-0.02em]">
            {name} · {review.year}
          </span>
          <span className="text-xs font-semibold text-[#1e6a4e]">PRIVATE LAB</span>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2.5">
          {items.map((item) => (
            <div key={item.label} className="flex flex-col justify-between rounded-2xl p-3.5" style={{ background: item.bg, color: item.fg }}>
              <span className="text-xs font-semibold opacity-90">{item.label}</span>
              <span className="text-[28px] font-bold tracking-[-0.02em] tabular-nums">{item.value}</span>
            </div>
          ))}
        </div>
        {goal && <p className="m-0 text-sm font-semibold text-[#3d4943]">{goal}</p>}
      </div>
      <div className="relative z-30 flex gap-2.5">
        <button
          type="button"
          onClick={() => void saveImage(review, name, items, goal)}
          className="flex min-h-[52px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#7fd1ac] text-base font-bold text-[#0b1410]"
        >
          <DownloadIcon className="size-5" /> Als Bild speichern
        </button>
        <button type="button" onClick={onRestart} className="min-h-[52px] cursor-pointer rounded-full border-2 border-[#f3f4f1]/40 px-5 text-base font-semibold">
          Nochmal
        </button>
      </div>
    </div>
  );
}

// Draws the summary card on a canvas (1080 × 1350) and shares or downloads it.
async function saveImage(review: YearReview, name: string, items: SummaryItem[], goal: string) {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const round = (x: number, y: number, w: number, h: number, r: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  };
  round(0, 0, W, H, 0, "#16201c");
  round(48, 48, W - 96, H - 96, 56, "#f3f4f1");
  ctx.fillStyle = "#16201c";
  ctx.font = `700 64px ${font}`;
  ctx.fillText(`${name} · ${review.year}`, 104, 170);
  ctx.fillStyle = "#1e6a4e";
  ctx.font = `600 28px ${font}`;
  ctx.textAlign = "right";
  ctx.fillText("PRIVATE LAB", W - 104, 166);
  ctx.textAlign = "left";
  const gap = 24;
  const cellW = (W - 208 - gap) / 2;
  const cellH = 300;
  items.forEach((item, index) => {
    const x = 104 + (index % 2) * (cellW + gap);
    const y = 220 + Math.floor(index / 2) * (cellH + gap);
    round(x, y, cellW, cellH, 36, item.bg);
    ctx.fillStyle = item.fg;
    ctx.font = `600 30px ${font}`;
    ctx.fillText(item.label, x + 36, y + 64);
    ctx.font = `700 76px ${font}`;
    ctx.fillText(item.value, x + 36, y + cellH - 44);
  });
  if (goal) {
    ctx.fillStyle = "#3d4943";
    ctx.font = `600 30px ${font}`;
    ctx.fillText(goal, 104, H - 100);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return toast.error("Bild konnte nicht erstellt werden.");
  const file = new File([blob], `sportjahr-${review.year}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Mein Sportjahr ${review.year}` });
      return;
    } catch {
      // cancelled: fall back to download
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function WrappedBanner({ review, onOpen, onLater }: { review: YearReview; onOpen: () => void; onLater?: () => void }) {
  const tiles = [
    { label: "Aktive Tage", value: n0.format(review.activeDays), bg: "#a9471a", fg: "#ffffff" },
    { label: "Schritte", value: millions(review.steps), bg: "#7fd1ac", fg: "#0b1410" },
    { label: "Gelaufen", value: `${n0.format(review.runKm)} km`, bg: "#1e6a4e", fg: "#ffffff" },
    { label: "Schlaf", value: review.sleepAvg ? `${hm(review.sleepAvg)} h` : "–", bg: "#e8d9c6", fg: "#16201c" },
    { label: "Gym", value: `${n0.format(review.tonnes)} t`, bg: "#f3f4f1", fg: "#16201c" },
    {
      label: "VO2max",
      value: review.heart.vo2From != null && review.heart.vo2To != null ? `${review.heart.vo2To - review.heart.vo2From >= 0 ? "+" : "−"}${n1.format(Math.abs(review.heart.vo2To - review.heart.vo2From))}` : "–",
      bg: "#2c3832",
      fg: "#f3f4f1",
    },
  ];
  return (
    <section className="flex flex-wrap overflow-hidden rounded-2xl bg-[#16201c] text-[#f3f4f1]">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col justify-between gap-4 p-6 sm:p-8">
        <div className="space-y-2">
          <span className="text-[13px] font-semibold tracking-[.08em] text-[#7fd1ac] uppercase">Jahresrückblick</span>
          <h2 className="text-3xl leading-none font-bold tracking-tight sm:text-[40px]">Dein Sportjahr {review.year} ist da.</h2>
          <p className="max-w-[46ch] text-[#b9c2bd]">
            {n0.format(review.activeDays)} aktive Tage, {n0.format(review.runKm)} km gelaufen, {n0.format(review.tonnes)} t im Gym. Acht Karten, eine Minute.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" onClick={onOpen} className="min-h-12 cursor-pointer rounded-full bg-[#7fd1ac] px-6 font-bold text-[#0b1410]">
            Ansehen
          </button>
          {onLater && (
            <button type="button" onClick={onLater} className="min-h-12 cursor-pointer rounded-full border-2 border-[#f3f4f1]/35 px-5 font-semibold">
              Später
            </button>
          )}
        </div>
      </div>
      <div className="hidden flex-[0_0_480px] grid-cols-3 content-center gap-2.5 p-6 md:grid" aria-hidden="true">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex h-28 flex-col justify-end rounded-2xl p-3.5" style={{ background: tile.bg, color: tile.fg }}>
            <span className="text-xs font-semibold">{tile.label}</span>
            <span className="text-2xl font-bold tabular-nums">{tile.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
