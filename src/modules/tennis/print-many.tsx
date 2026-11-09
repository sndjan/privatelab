"use client";

import { PrinterIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatSessionDate, type Group, type Session } from "./data";

// "Drucken" next to the upcoming sessions: pick the sessions (preset: all of
// the next day with sessions), then they print two A5 sheets per A4 page
// (PrintSheets, rendered by the overview outside its print:hidden part).
export function PrintPicker({
  sessions,
  groups,
  today,
  onPrint,
}: {
  // Upcoming sessions, earliest first.
  sessions: Session[];
  groups: Group[];
  today: string;
  onPrint: (sessionIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  if (sessions.length === 0) return null;

  function start() {
    const first = sessions[0].date;
    setSelected(new Set(sessions.filter((session) => session.date === first).map((session) => session.id)));
    setOpen(true);
  }

  function print() {
    // In list order, so the sheets come out by date and time.
    onPrint(sessions.filter((session) => selected.has(session.id)).map((session) => session.id));
    setOpen(false);
    // After the sheets have rendered and the dialog has closed.
    setTimeout(() => window.print(), 350);
  }

  const groupName = (id: string | null) => groups.find((group) => group.id === id)?.name ?? "Ohne Gruppe";
  const pages = Math.ceil(selected.size / 2);

  return (
    <>
      <Button variant="ghost" size="sm" className="-my-1 h-8 text-muted-foreground" onClick={start}>
        <PrinterIcon /> Drucken
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85dvh] flex-col print:hidden">
          <DialogHeader>
            <DialogTitle>Stunden drucken</DialogTitle>
            <DialogDescription>Zwei Stunden nebeneinander auf einem A4-Blatt (quer), zum Durchschneiden in A5.</DialogDescription>
          </DialogHeader>
          <ul className="-mx-2 min-h-0 flex-1 overflow-y-auto">
            {sessions.map((session) => (
              <li key={session.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-accent">
                  <Checkbox
                    checked={selected.has(session.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selected);
                      if (checked) next.add(session.id);
                      else next.delete(session.id);
                      setSelected(next);
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    {session.date === today ? "Heute" : formatSessionDate(session.date)}, {session.startTime} · {groupName(session.groupId)}
                  </span>
                  <span className="text-xs text-muted-foreground">{session.plan.length} Übungen</span>
                </label>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button onClick={print} disabled={selected.size === 0}>
              <PrinterIcon />
              {selected.size === 0 ? "Drucken" : `${selected.size} ${selected.size === 1 ? "Stunde" : "Stunden"} auf ${pages} ${pages === 1 ? "Blatt" : "Blättern"} drucken`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
