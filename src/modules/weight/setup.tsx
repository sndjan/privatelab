"use client";

import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, PlusIcon, Trash2Icon, UserRoundIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createParticipant,
  createSite,
  deleteParticipant,
  moveParticipant,
  reorderSites,
  saveSettings,
  updateParticipant,
  updateSite,
} from "./actions";
import { formatDate, formatNumber, toField } from "./calc";
import { cleanParticipantInput, colorHex, colors, isDate, siteKey, type Participant, type Site } from "./data";
import { useChange, useWeightData } from "./store";
import { BottomSheet, Dot, Panel } from "./ui";

// Admins only (the tab is hidden for others, and RLS refuses their writes).
export function SetupTab() {
  const { settings, participants, sites, accounts, me } = useWeightData();
  const change = useChange();
  const [sheet, setSheet] = useState<
    { kind: "settings" } | { kind: "person"; participant?: Participant } | { kind: "site"; site?: Site } | null
  >(null);

  if (!me.isAdmin) return null;

  function move<T>(list: T[], index: number, delta: number) {
    const next = [...list];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    return next;
  }

  return (
    <div className="space-y-4">
      <Panel title="Challenge" className="space-y-0">
        <button type="button" onClick={() => setSheet({ kind: "settings" })} className="flex w-full cursor-pointer items-center justify-between gap-2 border-t py-2.5 text-left first:border-t-0">
          <span>Name</span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            {settings?.title ?? "–"} <ChevronRightIcon className="size-4" />
          </span>
        </button>
        <button type="button" onClick={() => setSheet({ kind: "settings" })} className="flex w-full cursor-pointer items-center justify-between gap-2 border-t py-2.5 text-left">
          <span>Zeitraum</span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
            {settings ? `${formatDate(settings.startDate)} – ${formatDate(settings.endDate)}` : "–"} <ChevronRightIcon className="size-4" />
          </span>
        </button>
      </Panel>

      <Panel
        title="Personen"
        className="space-y-0"
        aside={
          <button type="button" onClick={() => setSheet({ kind: "person" })} className="-my-1 flex size-8 cursor-pointer items-center justify-center rounded-full hover:bg-muted" aria-label="Person hinzufügen">
            <PlusIcon className="size-4" />
          </button>
        }
      >
        {participants.map((participant, index) => (
          <div key={participant.id} className="flex items-center gap-1 border-t py-1 first:border-t-0">
            <button type="button" onClick={() => setSheet({ kind: "person", participant })} className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 py-1.5 text-left">
              <span className="flex min-w-0 items-center gap-1.5 font-medium">
                <Dot color={participant.color} />
                <span className="truncate">{participant.name}</span>
              </span>
              <span className="flex items-center gap-1 text-sm whitespace-nowrap text-muted-foreground tabular-nums">
                {formatNumber(participant.startWeight)} → {formatNumber(participant.goalWeight)}
                {participant.userId && <UserRoundIcon className="size-3.5" aria-label="mit Konto" />}
                <ChevronRightIcon className="size-4" />
              </span>
            </button>
            <MoveButtons
              index={index}
              count={participants.length}
              onMove={(delta) => {
                const next = move(participants, index, delta);
                void change(() => ({ participants: next.map((p, position) => ({ ...p, position })) }), () => moveParticipant(next.map((p) => p.id)));
              }}
            />
          </div>
        ))}
      </Panel>

      <Panel
        title="Messstellen"
        className="space-y-0"
        aside={
          <button type="button" onClick={() => setSheet({ kind: "site" })} className="-my-1 flex size-8 cursor-pointer items-center justify-center rounded-full hover:bg-muted" aria-label="Messstelle hinzufügen">
            <PlusIcon className="size-4" />
          </button>
        }
      >
        {sites.map((site, index) => (
          <div key={site.key} className="flex items-center gap-1 border-t py-1 first:border-t-0">
            <button type="button" onClick={() => setSheet({ kind: "site", site })} className={cn("min-w-0 flex-1 cursor-pointer truncate py-1.5 text-left", !site.active && "text-muted-foreground")}>
              {site.label}
              {site.sided && <span className="ml-1.5 text-xs text-muted-foreground">L/R</span>}
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={site.active}
              aria-label={`${site.label} anzeigen`}
              onClick={() =>
                void change(
                  (data) => ({ sites: data.sites.map((other) => (other.key === site.key ? { ...other, active: !site.active } : other)) }),
                  () => updateSite(site.key, { label: site.label, active: !site.active }),
                )
              }
              className={cn("relative mx-1 h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors", site.active ? "bg-brand" : "bg-border")}
            >
              <span className={cn("absolute top-0.5 size-4 rounded-full bg-background transition-all", site.active ? "left-[1.125rem]" : "left-0.5")} />
            </button>
            <MoveButtons
              index={index}
              count={sites.length}
              onMove={(delta) => {
                const next = move(sites, index, delta);
                void change(() => ({ sites: next.map((s, position) => ({ ...s, position })) }), () => reorderSites(next.map((s) => s.key)));
              }}
            />
          </div>
        ))}
      </Panel>

      {sheet?.kind === "settings" && <SettingsSheet onClose={() => setSheet(null)} />}
      {sheet?.kind === "person" && (
        <PersonSheet participant={sheet.participant} accounts={accounts} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === "site" && <SiteSheet site={sheet.site} onClose={() => setSheet(null)} />}
    </div>
  );
}

function MoveButtons({ index, count, onMove }: { index: number; count: number; onMove: (delta: number) => void }) {
  return (
    <span className="flex shrink-0">
      <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Nach oben">
        <ArrowUpIcon />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Nach unten">
        <ArrowDownIcon />
      </Button>
    </span>
  );
}

function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { settings } = useWeightData();
  const change = useChange();
  const [title, setTitle] = useState(settings?.title ?? "Challenge");
  const [startDate, setStartDate] = useState(settings?.startDate ?? "");
  const [endDate, setEndDate] = useState(settings?.endDate ?? "");
  const valid = title.trim() !== "" && isDate(startDate) && isDate(endDate) && endDate > startDate;

  return (
    <BottomSheet title="Challenge" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          const next = { title: title.trim(), startDate, endDate };
          void change(() => ({ settings: next }), () => saveSettings(next));
          toast.success("Gespeichert");
          onClose();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="weight-title">Name</Label>
          <Input id="weight-title" value={title} maxLength={60} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="weight-start">Start</Label>
            <Input id="weight-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="weight-end">Ende</Label>
            <Input id="weight-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
        </div>
        <Button type="submit" disabled={!valid} className="h-12 w-full rounded-xl text-base">
          Speichern
        </Button>
      </form>
    </BottomSheet>
  );
}

function PersonSheet({
  participant,
  accounts,
  onClose,
}: {
  participant?: Participant;
  accounts: { id: string; email: string }[];
  onClose: () => void;
}) {
  const { participants, weighings } = useWeightData();
  const change = useChange();
  const used = new Set(participants.map((other) => other.color));
  const [name, setName] = useState(participant?.name ?? "");
  const [color, setColor] = useState<string>(participant?.color ?? colors.find((option) => !used.has(option.id))?.id ?? "blue");
  const [startWeight, setStartWeight] = useState(toField(participant?.startWeight));
  const [goalWeight, setGoalWeight] = useState(toField(participant?.goalWeight));
  const [userId, setUserId] = useState(participant?.userId ?? "");

  let input: ReturnType<typeof cleanParticipantInput> | null = null;
  try {
    input = cleanParticipantInput({ name, color, startWeight, goalWeight, userId });
  } catch {}

  async function remove() {
    if (!participant) return;
    const count = weighings.filter((weighing) => weighing.participantId === participant.id).length;
    if (!(await confirmDialog({ title: `${participant.name} löschen?`, description: `Mit allen Messungen (${count} Wiegungen).` }))) return;
    void change(
      (data) => ({
        participants: data.participants.filter((other) => other.id !== participant.id),
        weighings: data.weighings.filter((weighing) => weighing.participantId !== participant.id),
        circumferences: data.circumferences.filter((set) => set.participantId !== participant.id),
      }),
      () => deleteParticipant(participant.id),
    );
    onClose();
  }

  return (
    <BottomSheet title={participant ? participant.name : "Neue Person"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!input) return;
          const value = input;
          if (participant) {
            void change(
              (data) => ({
                participants: data.participants.map((other) =>
                  other.id === participant.id
                    ? { ...other, ...value }
                    : value.userId && other.userId === value.userId
                      ? { ...other, userId: null }
                      : other,
                ),
              }),
              () => updateParticipant(participant.id, value),
            );
          } else {
            void change(
              (data) => ({ participants: [...data.participants, { ...value, id: `temp-${Date.now()}`, position: data.participants.length }] }),
              () => createParticipant(value),
            );
          }
          onClose();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="person-name">Name</Label>
          <Input id="person-name" value={name} maxLength={30} onChange={(event) => setName(event.target.value)} autoFocus={!participant} />
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Farbe</span>
          <div role="radiogroup" aria-label="Farbe" className="flex flex-wrap gap-2">
            {colors.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={color === option.id}
                aria-label={option.name}
                onClick={() => setColor(option.id)}
                className={cn("size-8 cursor-pointer rounded-full ring-offset-2 ring-offset-background", color === option.id && "ring-2 ring-foreground")}
                style={{ backgroundColor: colorHex(option.id) }}
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="person-start">Start kg</Label>
            <Input id="person-start" inputMode="decimal" value={startWeight} onChange={(event) => setStartWeight(event.target.value)} className="tabular-nums" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="person-goal">Ziel kg</Label>
            <Input id="person-goal" inputMode="decimal" value={goalWeight} onChange={(event) => setGoalWeight(event.target.value)} className="tabular-nums" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="person-account">Konto</Label>
          <Select value={userId || "none"} onValueChange={(value) => setUserId(value === "none" ? "" : value)}>
            <SelectTrigger id="person-account" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Keins</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 pt-1">
          {participant && (
            <Button type="button" variant="outline" size="icon" className="size-12 rounded-xl" onClick={remove} aria-label="Löschen">
              <Trash2Icon className="size-5" />
            </Button>
          )}
          <Button type="submit" disabled={!input} className="h-12 flex-1 rounded-xl text-base">
            Speichern
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}

function SiteSheet({ site, onClose }: { site?: Site; onClose: () => void }) {
  const change = useChange();
  const [label, setLabel] = useState(site?.label ?? "");
  const [sided, setSided] = useState(site?.sided ?? false);
  const valid = label.trim() !== "";

  return (
    <BottomSheet title={site ? site.label : "Neue Messstelle"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          const clean = label.trim().slice(0, 30);
          if (site) {
            void change(
              (data) => ({ sites: data.sites.map((other) => (other.key === site.key ? { ...other, label: clean } : other)) }),
              () => updateSite(site.key, { label: clean, active: site.active }),
            );
          } else {
            void change(
              (data) => ({
                sites: [...data.sites, { key: siteKey(clean), label: clean, sided, active: true, position: data.sites.length }],
              }),
              () => createSite({ label: clean, sided }),
            );
          }
          onClose();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="site-label">Name</Label>
          <Input id="site-label" value={label} maxLength={30} onChange={(event) => setLabel(event.target.value)} autoFocus />
        </div>
        {!site && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={sided} onCheckedChange={(value) => setSided(value === true)} />
            Links und rechts
          </label>
        )}
        <Button type="submit" disabled={!valid} className="h-12 w-full rounded-xl text-base">
          Speichern
        </Button>
      </form>
    </BottomSheet>
  );
}
