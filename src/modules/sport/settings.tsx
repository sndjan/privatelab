"use client";

import { useQueryClient } from "@tanstack/react-query";
import { BellIcon, BellOffIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deletePushSubscription, savePushSubscription } from "./actions";
import { formatDate, mondayOf } from "./calc";
import { DEFAULT_PLAN_START } from "./plan";
import { useSaveSettings, useSportData } from "./store";
import type { Settings } from "./types";
import { Note, Panel } from "./ui";

export function SettingsTab() {
  const { settings } = useSportData();
  const save = useSaveSettings();

  return (
    <div className="space-y-4">
      <Panel title="Schlaf">
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField key={`Bereich von (Stunden)-${settings.sleepMinH}`} label="Bereich von (Stunden)" value={settings.sleepMinH} step={0.5} min={3} max={12} onSave={(value) => value != null && save({ sleepMinH: value }, "Gespeichert")} />
          <NumberField key={`Bereich bis (Stunden)-${settings.sleepMaxH}`} label="Bereich bis (Stunden)" value={settings.sleepMaxH} step={0.5} min={3} max={14} onSave={(value) => value != null && save({ sleepMaxH: value }, "Gespeichert")} />
          <NumberField key={`Ziel im Schnitt (Stunden)-${settings.sleepGoalH}`} label="Ziel im Schnitt (Stunden)" value={settings.sleepGoalH} step={0.25} min={3} max={12} onSave={(value) => value != null && save({ sleepGoalH: value }, "Gespeichert")} />
        </div>
        <Note>Der Bereich ist im Schlafdiagramm grün hinterlegt, das Ziel ist die gestrichelte Linie.</Note>
      </Panel>

      <Panel title="Training">
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField key={`Gym-Einheiten pro Woche-${settings.gymPerWeek}`} label="Gym-Einheiten pro Woche" value={settings.gymPerWeek} step={1} min={0} max={7} onSave={(value) => value != null && save({ gymPerWeek: value }, "Gespeichert")} />
          <NumberField key={`Zone 1 Ziel (%)-${settings.zone1GoalPct}`} label="Zone 1 Ziel (%)" value={settings.zone1GoalPct} step={5} min={0} max={100} onSave={(value) => value != null && save({ zone1GoalPct: value }, "Gespeichert")} />
          <NumberField
            key={`steps-${settings.stepsGoal}`}
            label="Schritte pro Tag"
            value={settings.stepsGoal}
            placeholder="wie in Garmin"
            step={500}
            min={1000}
            max={50000}
            onSave={(value) => save({ stepsGoal: value }, "Gespeichert")}
          />
        </div>
        <Note>Leer gelassen gilt bei den Schritten das Tagesziel aus Garmin.</Note>
      </Panel>

      <PlanStart key={settings.planStart} settings={settings} />
      <Reminders />
    </div>
  );
}

function NumberField({
  label,
  value,
  onSave,
  step,
  min,
  max,
  placeholder,
}: {
  label: string;
  value: number | null;
  onSave: (value: number | null) => void;
  step: number;
  min: number;
  max: number;
  placeholder?: string;
}) {
  // Reset by the parent's key when the saved value changes.
  const [text, setText] = useState(value == null ? "" : String(value).replace(".", ","));
  const id = `sport-${label.replace(/\W+/g, "-")}`;
  const commit = () => {
    const trimmed = text.trim().replace(",", ".");
    if (trimmed === "") {
      if (placeholder && value != null) onSave(null);
      return;
    }
    const number = Number(trimmed);
    if (!Number.isFinite(number) || number < min || number > max) {
      toast.error(`Bitte eine Zahl zwischen ${min} und ${max}.`);
      setText(value == null ? "" : String(value).replace(".", ","));
      return;
    }
    if (number !== value) onSave(number);
  };
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        step={step}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

function PlanStart({ settings }: { settings: Settings }) {
  const save = useSaveSettings();
  const [date, setDate] = useState(settings.planStart);
  return (
    <Panel title="Laufplan">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sport-plan-start">Woche 1 beginnt am</Label>
          <Input id="sport-plan-start" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-44" />
        </div>
        <Button
          variant="outline"
          disabled={!date || mondayOf(date) === settings.planStart}
          onClick={() => save({ planStart: mondayOf(date) }, `Plan beginnt jetzt am ${formatDate(mondayOf(date))}`)}
        >
          Übernehmen
        </Button>
        {settings.planStart !== DEFAULT_PLAN_START && (
          <Button variant="ghost" onClick={() => save({ planStart: DEFAULT_PLAN_START }, "Zurück auf 23.11.")}>
            Zurück auf 23.11.
          </Button>
        )}
      </div>
      <Note>
        Der Start wird auf den Montag der Woche gelegt. Einzelne Wochen wiederholen oder überspringen kannst du im Tab Plan.
        {settings.planChanges.length > 0 && ` Aktuell ${settings.planChanges.length} Änderung${settings.planChanges.length === 1 ? "" : "en"}.`}
      </Note>
    </Panel>
  );
}

const noop = () => () => {};

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

function Reminders() {
  const { settings, pushEndpoints } = useSportData();
  const save = useSaveSettings();
  const queryClient = useQueryClient();
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const support = useSyncExternalStore(
    noop,
    () => ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window ? "ok" : "unsupported"),
    () => "checking" as const,
  );
  const [busy, setBusy] = useState(false);
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    void navigator.serviceWorker.getRegistration("/").then(async (reg) => setEndpoint((await reg?.pushManager.getSubscription())?.endpoint ?? null));
  }, []);

  const active = endpoint != null && pushEndpoints.includes(endpoint);

  async function enable() {
    if (!vapidPublicKey) return toast.error("NEXT_PUBLIC_VAPID_PUBLIC_KEY fehlt.");
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== "granted") throw new Error("Benachrichtigungen sind für diese Seite blockiert.");
      const reg = await registration();
      const subscription =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }));
      const json = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await savePushSubscription(json, window.location.origin);
      setEndpoint(subscription.endpoint);
      if (!settings.notifyMorning && !settings.notifyWeekly) await save({ notifyMorning: true, notifyWeekly: true });
      toast.success("Erinnerungen auf diesem Gerät an");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nicht geklappt.");
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: ["sport"] });
    }
  }

  async function disable() {
    if (!endpoint) return;
    setBusy(true);
    try {
      await deletePushSubscription(endpoint);
      toast.success("Auf diesem Gerät aus");
    } catch {
      toast.error("Nicht geklappt.");
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: ["sport"] });
    }
  }

  return (
    <Panel title="Erinnerungen">
      <div className="space-y-3">
        <label className="flex items-start gap-3">
          <Checkbox checked={settings.notifyMorning} onCheckedChange={(checked) => save({ notifyMorning: checked === true })} className="mt-0.5" />
          <span>
            <span className="font-medium">Morgens: was heute im Plan steht</span>
            <span className="block text-sm text-muted-foreground">mit HRV und Schlaf der Nacht, gegen {settings.notifyMorningHour}:00 Uhr</span>
          </span>
        </label>
        <div className="flex items-center gap-2 pl-7">
          <Label htmlFor="sport-morning-hour" className="text-sm font-normal text-muted-foreground">
            Uhrzeit
          </Label>
          <select
            id="sport-morning-hour"
            value={settings.notifyMorningHour}
            onChange={(event) => save({ notifyMorningHour: Number(event.target.value) })}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {[5, 6, 7, 8, 9, 10].map((hour) => (
              <option key={hour} value={hour}>
                {hour}:00
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-start gap-3">
          <Checkbox checked={settings.notifyWeekly} onCheckedChange={(checked) => save({ notifyWeekly: checked === true })} className="mt-0.5" />
          <span>
            <span className="font-medium">Sonntagabend: Wochenrückblick</span>
            <span className="block text-sm text-muted-foreground">Plan gegen Ist, Schlaf und Gym, kurz zusammengefasst von Claude Haiku</span>
          </span>
        </label>
      </div>
      {support === "unsupported" ? (
        <Note>Dieser Browser kann keine Push-Nachrichten. Auf dem iPhone geht es nur in der installierten App (zum Home-Bildschirm).</Note>
      ) : active ? (
        <Button variant="outline" disabled={busy} onClick={disable}>
          <BellOffIcon /> Auf diesem Gerät ausschalten
        </Button>
      ) : (
        <Button disabled={busy || support === "checking"} onClick={enable}>
          <BellIcon /> Auf diesem Gerät einschalten
        </Button>
      )}
      <Note>
        {pushEndpoints.length > 0 ? `Aktiv auf ${pushEndpoints.length} Gerät${pushEndpoints.length === 1 ? "" : "en"}.` : "Noch auf keinem Gerät aktiv."} Die Nachrichten
        kommen über den stündlichen Abgleich, kurz nach der vollen Stunde.
      </Note>
    </Panel>
  );
}
