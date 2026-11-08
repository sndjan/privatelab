"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Minimize2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatShortDate, formatSigned, type Standing } from "./calc";
import { WeightChart } from "./chart";
import type { Settings, Weighing } from "./data";
import { PersonName, Segmented } from "./ui";

// SVG units per CSS pixel are 1/SCALE, so the 9-unit labels show at ~13px.
const SCALE = 1.5;

type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
};

// The chart across the whole screen, like a video in full screen: where the
// browser allows it, real full screen locked to landscape; otherwise (iPhone)
// the page turned on its side while the phone is held upright.
export function ChartFullscreen({
  standings,
  weighings,
  settings,
  today,
  mode,
  onModeChange,
  onClose,
}: {
  standings: Standing[];
  weighings: Weighing[];
  settings: Settings;
  today: string;
  mode: "delta" | "absolute";
  onModeChange: (mode: "delta" | "absolute") => void;
  onClose: () => void;
}) {
  // A state, not a ref: the portal mounts the box after this component.
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [portrait, setPortrait] = useState(false);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  // Enter real full screen and turn to landscape; both may be refused.
  useEffect(() => {
    let entered = false;
    const root = document.documentElement;
    const orientation = screen.orientation as ScreenOrientationWithLock | undefined;
    if (root.requestFullscreen && !document.fullscreenElement) {
      root
        .requestFullscreen({ navigationUI: "hide" })
        .then(() => {
          entered = true;
          return orientation?.lock?.("landscape");
        })
        .catch(() => {});
    }
    // Leaving full screen with the back gesture or Esc closes the view too.
    const onFullscreenChange = () => {
      if (entered && !document.fullscreenElement) close.current();
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      try {
        orientation?.unlock?.();
      } catch {}
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(orientation: portrait)");
    const update = () => setPortrait(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const element = box;
    if (!element) return;
    // Layout size, unaffected by the rotation.
    const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, [box]);

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed top-0 left-0 z-50 flex flex-col gap-2 bg-background p-3 outline-none",
            portrait
              ? "h-[100dvw] w-[100dvh] origin-top-left translate-x-[100dvw] rotate-90"
              : "h-dvh w-dvw pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))]",
          )}
        >
          <div className="flex shrink-0 items-center gap-3">
            <DialogPrimitive.Title className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Verlauf
            </DialogPrimitive.Title>
            <ul className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-0.5 text-sm whitespace-nowrap">
              {standings.map(({ participant, trend }) => (
                <li key={participant.id} className="flex items-center gap-1.5">
                  <PersonName participant={participant} className="font-normal" />
                  <span className="text-muted-foreground tabular-nums">
                    {trend ? `${formatSigned(trend.slope * 7)}/Wo` : "–"}
                    {trend?.goalDate && ` · Ziel ~${formatShortDate(trend.goalDate)}`}
                  </span>
                </li>
              ))}
            </ul>
            <Segmented
              label="Darstellung"
              value={mode}
              onChange={onModeChange}
              options={[
                { id: "delta", label: "Δ" },
                { id: "absolute", label: "kg" },
              ]}
              className="w-24 shrink-0 [&_button]:h-7"
            />
            <DialogPrimitive.Close className="-mr-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
              <Minimize2Icon className="size-5" />
              <span className="sr-only">Vollbild verlassen</span>
            </DialogPrimitive.Close>
          </div>
          <div ref={setBox} className="min-h-0 flex-1">
            {size && size.width > 0 && size.height > 0 && (
              <WeightChart
                standings={standings}
                weighings={weighings}
                settings={settings}
                today={today}
                mode={mode}
                width={size.width / SCALE}
                height={size.height / SCALE}
                className="block size-full"
              />
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
