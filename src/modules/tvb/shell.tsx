"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { fontVariables } from "./fonts";
import "./tvb.css";

// The club site covers the whole window, over the app's header, so it looks
// like the real website. It scrolls on its own, so a switch to another page
// (?seite=…) scrolls it back up (or to the #anchor), and closes the menu.
export function Shell({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const search = useSearchParams().toString();
  const lastSearch = useRef(search);
  const farbe = useFarbe();

  useEffect(() => {
    if (search === lastSearch.current) return;
    lastSearch.current = search;
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll("details[open]").forEach((details) => details.removeAttribute("open"));
    const target = window.location.hash ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : null;
    if (target) target.scrollIntoView({ block: "start" });
    else root.scrollTo({ top: 0 });
  }, [search]);

  return (
    <div
      ref={ref}
      data-farbe={farbe}
      className={cn(
        "tvb fixed inset-0 z-40 overflow-y-auto bg-(--tvb-page) font-[family-name:var(--font-tvb-body)] text-(--tvb-ink) antialiased",
        fontVariables,
      )}
    >
      {children}
    </div>
  );
}

// Prototype only: green or red design, remembered per device.
type Farbe = "gruen" | "rot";
const STORAGE_KEY = "tvb-farbe";
const listeners = new Set<() => void>();

function readFarbe(): Farbe {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "rot" ? "rot" : "gruen";
  } catch {
    return "gruen";
  }
}

function setFarbe(farbe: Farbe) {
  try {
    window.localStorage.setItem(STORAGE_KEY, farbe);
  } catch {}
  listeners.forEach((listener) => listener());
}

function useFarbe() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readFarbe,
    () => "gruen" as Farbe,
  );
}

export function ColorSwitch() {
  const farbe = useFarbe();
  return (
    <span className="flex items-center gap-2">
      <span className="opacity-80">Farbe:</span>
      {(["gruen", "rot"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setFarbe(option)}
          aria-pressed={farbe === option}
          className={cn(
            "flex min-h-9 items-center gap-1.5 rounded-full border border-white/30 px-3 text-sm",
            farbe === option && "border-white bg-white/15 font-semibold",
          )}
        >
          <span aria-hidden className={cn("size-3 rounded-full", option === "gruen" ? "bg-[#2f7a55]" : "bg-[#c8383b]")} />
          {option === "gruen" ? "Grün" : "Rot"}
        </button>
      ))}
    </span>
  );
}
