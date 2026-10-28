"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Phase } from "./data";

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Phase picker for forms; posts "none" for no phase.
export function PhaseSelect({ id, phases, defaultValue }: { id: string; phases: Phase[]; defaultValue: string | null }) {
  return (
    <Select name="phaseId" defaultValue={defaultValue ?? "none"}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Keine Phase</SelectItem>
        {phases.map((phase) => (
          <SelectItem key={phase.id} value={phase.id}>
            {phase.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Runs a form action, then closes the dialog.
export function closingAfter(action: (formData: FormData) => Promise<void>, close: () => void) {
  return async (formData: FormData) => {
    await action(formData);
    close();
  };
}
