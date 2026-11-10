"use client";

import { useSyncExternalStore } from "react";

// Which modules are pinned to the top of the dashboard or hidden from it.
// Kept in localStorage, so every device has its own arrangement.

const KEY = "dashboard-modules";
const CHANGE_EVENT = `${KEY}-change`;

export type DashboardPrefs = {
  // In pin order: the first pinned module comes first.
  pinned: string[];
  hidden: string[];
};

const empty: DashboardPrefs = { pinned: [], hidden: [] };

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function read() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// useSyncExternalStore needs the same object for the same stored string.
let cachedRaw: string | null = null;
let cachedPrefs = empty;
function parse(raw: string | null): DashboardPrefs {
  if (raw === cachedRaw) return cachedPrefs;
  let prefs = empty;
  try {
    const value = raw ? (JSON.parse(raw) as Partial<DashboardPrefs>) : null;
    if (value) prefs = { pinned: strings(value.pinned), hidden: strings(value.hidden) };
  } catch {}
  cachedRaw = raw;
  cachedPrefs = prefs;
  return prefs;
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function write(prefs: DashboardPrefs) {
  try {
    if (prefs.pinned.length === 0 && prefs.hidden.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useDashboardPrefs() {
  const prefs = parse(useSyncExternalStore(subscribe, read, () => null));

  return {
    prefs,
    setPinned(id: string, pinned: boolean) {
      const current = parse(read());
      const rest = current.pinned.filter((item) => item !== id);
      // Pinning also shows the module again.
      write({
        pinned: pinned ? [...rest, id] : rest,
        hidden: pinned ? current.hidden.filter((item) => item !== id) : current.hidden,
      });
    },
    setHidden(id: string, hidden: boolean) {
      const current = parse(read());
      const rest = current.hidden.filter((item) => item !== id);
      // A hidden module can't stay pinned.
      write({
        pinned: hidden ? current.pinned.filter((item) => item !== id) : current.pinned,
        hidden: hidden ? [...rest, id] : rest,
      });
    },
  };
}

// Splits modules into the shown ones (pinned first, in pin order, then the
// rest in their usual order) and the hidden ones.
export function arrangeModules<T extends { id: string }>(modules: T[], prefs: DashboardPrefs) {
  const hidden = new Set(prefs.hidden);
  const pinned = prefs.pinned.flatMap((id) => modules.filter((module) => module.id === id && !hidden.has(id)));
  const pinnedIds = new Set(pinned.map((module) => module.id));
  return {
    pinned,
    others: modules.filter((module) => !pinnedIds.has(module.id) && !hidden.has(module.id)),
    hidden: modules.filter((module) => hidden.has(module.id)),
  };
}
