"use client";

import { CalendarClockIcon, CheckIcon, MoreHorizontalIcon, PinIcon, PlayIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quickAction, type QuickAction } from "./actions";
import { colorHex, formatDate, formatMinutes, parseMinutes, type Item, type TypeDef } from "./data";
import { addWorkdays } from "./plan";
import { useDialogs, useKanzleiData, useRun } from "./store";

// The type of an item as a small coloured label.
export function TypeTag({ typeId, types }: { typeId: string | null; types: TypeDef[] }) {
  const type = types.find((entry) => entry.id === typeId);
  if (!type) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium whitespace-nowrap">
      <span aria-hidden className="size-2 rounded-full" style={{ background: colorHex(type.color) }} />
      {type.name}
    </span>
  );
}

// The buttons for the usual steps of an item; the first one or two are
// shown, the rest sit in a menu.
export function QuickActions({ item, size = "sm" }: { item: Item; size?: "sm" | "default" }) {
  const run = useRun();
  const { openItem } = useDialogs();
  const { today } = useKanzleiData();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"followup" | "remaining" | null>(null);
  const task = item.kind === "aufgabe";

  async function act(action: QuickAction, value?: string | number | null, done?: string) {
    setBusy(true);
    await run(() => quickAction(item.id, action, value), done);
    setBusy(false);
  }

  if (item.status === "erledigt") {
    return (
      <Button size={size} variant="outline" disabled={busy} onClick={() => act("reopen")}>
        Wieder öffnen
      </Button>
    );
  }

  const waitingDocs = item.status === "warte_unterlagen";
  const primary = waitingDocs ? (
    <Button size={size} variant="outline" disabled={busy} onClick={() => act("docs", null, "Unterlagen eingegangen")}>
      Unterlagen da
    </Button>
  ) : item.status === "in_bearbeitung" || (task && item.status === "offen") ? null : (
    <Button size={size} variant="outline" disabled={busy} onClick={() => act("begin")}>
      <PlayIcon /> Beginnen
    </Button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {primary}
      <Button size={size} variant="brand" disabled={busy} onClick={() => act("done", null, "Erledigt")}>
        <CheckIcon /> Erledigt
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size={size === "sm" ? "icon-sm" : "icon"} variant="ghost" aria-label="Weitere Aktionen" disabled={busy}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {waitingDocs && <DropdownMenuItem onSelect={() => act("docs_partial")}>Unterlagen teilweise da</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => act("query", null, "Rückfrage gestellt, Wiedervorlage gesetzt")}>Rückfrage gestellt</DropdownMenuItem>
          {!task && <DropdownMenuItem onSelect={() => act("control", null, "Zur Kontrolle, Wiedervorlage gesetzt")}>Zur Kontrolle</DropdownMenuItem>}
          {item.status === "kontrolle" && <DropdownMenuItem onSelect={() => act("rework")}>Nachbearbeitung nötig</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => setDialog("followup")}>
            <CalendarClockIcon /> Wiedervorlage …
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("remaining")}>Restaufwand …</DropdownMenuItem>
          {item.plannedFor === today ? (
            <DropdownMenuItem onSelect={() => act("unpin")}>
              <PinIcon /> Nicht mehr fest für heute
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => act("pin", today)}>
              <PinIcon /> Fest für heute einplanen
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => openItem({ item })}>Bearbeiten …</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog === "followup" && <FollowUpDialog item={item} onClose={() => setDialog(null)} onSave={(date) => act("followup", date)} />}
      {dialog === "remaining" && <RemainingDialog item={item} onClose={() => setDialog(null)} onSave={(minutes) => act("remaining", minutes)} />}
    </div>
  );
}

function FollowUpDialog({ item, onClose, onSave }: { item: Item; onClose: () => void; onSave: (date: string | null) => void }) {
  const { today, settings, absences } = useKanzleiData();
  const [date, setDate] = useState(item.followUp ?? addWorkdays(today, settings.followupWorkdays, settings, absences));
  const presets = [5, 10, 20].map((days) => ({ days, date: addWorkdays(today, days, settings, absences) }));
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Wiedervorlage</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Bis dahin taucht der Eintrag nicht im Tagesplan auf. Sein Aufwand zählt weiter in der Vorschau.</p>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <Button key={preset.days} type="button" size="sm" variant={date === preset.date ? "secondary" : "outline"} onClick={() => setDate(preset.date)}>
              {preset.days} Arbeitstage · {formatDate(preset.date)}
            </Button>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="followup-date">Datum</Label>
          <Input id="followup-date" type="date" value={date} min={today} onChange={(event) => setDate(event.target.value)} />
        </div>
        <DialogFooter className="flex-row justify-between gap-2">
          {item.followUp ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onSave(null);
                onClose();
              }}
            >
              Entfernen
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            variant="brand"
            disabled={!date}
            onClick={() => {
              onSave(date);
              onClose();
            }}
          >
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemainingDialog({ item, onClose, onSave }: { item: Item; onClose: () => void; onSave: (minutes: number) => void }) {
  const [text, setText] = useState(item.remaining ? `${item.remaining} min` : "");
  const minutes = parseMinutes(text.replace(/\s+/g, " "));
  const presets = [15, 30, 60, 120, 180, 240];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Restaufwand</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Grob reicht. Geschätzt waren {formatMinutes(item.estimate)}, bisher eingetragen {formatMinutes(item.remaining)}.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <Button key={preset} type="button" size="sm" variant={minutes === preset ? "secondary" : "outline"} onClick={() => setText(`${preset} min`)}>
              {formatMinutes(preset)}
            </Button>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="remaining">Noch zu tun</Label>
          <Input id="remaining" value={text} placeholder="z. B. 1,5 h oder 90" onChange={(event) => setText(event.target.value)} />
          {minutes !== null && <p className="text-xs text-muted-foreground">= {formatMinutes(minutes)}</p>}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="brand"
            disabled={minutes === null}
            onClick={() => {
              if (minutes !== null) onSave(minutes);
              onClose();
            }}
          >
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
