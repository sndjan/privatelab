"use client";

import { SquareIcon, TimerIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { saveLogEntry } from "./actions";
import { phaseOn, type Phase } from "./data";
import { LogFields } from "./log-dialog";
import { countWords, formatWords, numbering, type Section } from "./writing";

const KEY = "thesis-writing-session";

// A running session: when it started and how many words each section had
// then. Kept in localStorage, so it survives reloads on this device.
type Session = { startedAt: string; words: Record<string, number> };

// A writing session: start it, write, end it. The words written per section
// and the time go into a prefilled entry for the Arbeitslog.
export function WritingSession({ sections, phases, today }: { sections: Section[]; phases: Phase[]; today: string }) {
  const [session, setSession] = useStoredSession();
  const [ending, setEnding] = useState(false);
  const now = useNow(session !== null);

  if (!session) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          setSession({
            startedAt: new Date().toISOString(),
            words: Object.fromEntries(sections.map((section) => [section.id, countWords(section.body)])),
          })
        }
        title="Zählt Wörter und Zeit und trägt sie am Ende ins Arbeitslog ein"
      >
        <TimerIcon /> <span className="hidden sm:inline">Session</span>
      </Button>
    );
  }

  const minutes = Math.max(0, Math.floor((now - Date.parse(session.startedAt)) / 60000));
  const numbers = numbering(sections);
  const written = sections
    .map((section, index) => ({
      label: `${numbers[index]} ${section.title || "Ohne Titel"}`,
      // Sections added during the session count from zero; ones whose id
      // changed from a temporary one aren't in the snapshot either.
      delta: countWords(section.body) - (session.words[section.id] ?? 0),
    }))
    .filter((entry) => entry.delta !== 0);
  const total = written.reduce((sum, entry) => sum + entry.delta, 0);
  // Quarter hours, at least one.
  const hours = Math.max(0.25, Math.round(minutes / 15) / 4);
  const text = [
    total > 0 ? `Geschrieben: ${formatWords(total)}` : "Am Text gearbeitet",
    written.length > 0 && `(${written.map((entry) => `${entry.label}: ${entry.delta > 0 ? "+" : ""}${entry.delta}`).join(", ")})`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setEnding(true)}
        title="Session beenden und ins Arbeitslog eintragen"
        className="font-mono"
      >
        <SquareIcon className="fill-current" />
        {formatDuration(minutes)} · {total >= 0 ? "+" : ""}
        {total}
      </Button>
      <Dialog open={ending} onOpenChange={setEnding}>
        <DialogContent className="sm:max-w-xl">
          <form
            action={async (formData) => {
              try {
                await saveLogEntry(formData);
                setSession(null);
                setEnding(false);
                toast.success("Ins Arbeitslog eingetragen");
              } catch {
                toast.error("Das hat nicht geklappt. Prüf deine Verbindung.");
              }
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Session beenden</DialogTitle>
              <DialogDescription>
                {formatDuration(minutes)} seit{" "}
                {new Date(session.startedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })},{" "}
                {total >= 0 ? `${formatWords(total)} mehr` : `${formatWords(-total)} weniger`}. Prüf den Eintrag fürs Arbeitslog.
              </DialogDescription>
            </DialogHeader>
            <LogFields draft={{ hours, text }} phases={phases} today={today} defaultPhaseId={phaseOn(phases, today)?.id ?? null} />
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive sm:mr-auto"
                onClick={() => {
                  if (!window.confirm("Session ohne Eintrag beenden?")) return;
                  setSession(null);
                  setEnding(false);
                }}
              >
                Verwerfen
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEnding(false)}>
                Weiterschreiben
              </Button>
              <SubmitButton>Eintragen</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

// The current time, updated every 15 seconds while `running`.
function useNow(running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 15000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [running]);
  return now;
}

function useStoredSession(): [Session | null, (next: Session | null) => void] {
  const raw = useSyncExternalStore(
    (callback) => {
      window.addEventListener("storage", callback);
      window.addEventListener(`${KEY}-change`, callback);
      return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener(`${KEY}-change`, callback);
      };
    },
    () => {
      try {
        return localStorage.getItem(KEY);
      } catch {
        return null;
      }
    },
    () => null,
  );
  return [
    parseSession(raw),
    (next) => {
      try {
        if (next) localStorage.setItem(KEY, JSON.stringify(next));
        else localStorage.removeItem(KEY);
      } catch {}
      window.dispatchEvent(new Event(`${KEY}-change`));
    },
  ];
}

let cached: { raw: string | null; session: Session | null } = { raw: null, session: null };
function parseSession(raw: string | null) {
  if (raw !== cached.raw) {
    let session: Session | null = null;
    try {
      const value = raw ? JSON.parse(raw) : null;
      if (value && typeof value.startedAt === "string" && typeof value.words === "object") session = value;
    } catch {}
    cached = { raw, session };
  }
  return cached.session;
}
