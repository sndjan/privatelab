"use client";

import { ArrowLeftIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useViewNavigate, ViewLink } from "@/lib/query/view-link";
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

// Search field that filters the list in the URL (?q=…), without the server.
export function SearchForm({
  query,
  href,
  placeholder,
  label,
  className,
}: {
  query?: string;
  href: (query: string) => string;
  placeholder: string;
  label: string;
  className?: string;
}) {
  const navigate = useViewNavigate();
  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const value = String(new FormData(event.currentTarget).get("q") ?? "").trim();
        navigate(href(value), { replace: true, scroll: false });
      }}
      className={className ?? "relative"}
    >
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        name="q"
        defaultValue={query ?? ""}
        onChange={(event) => {
          // Clearing the field shows everything again.
          if (!event.target.value && query) navigate(href(""), { replace: true, scroll: false });
        }}
        placeholder={placeholder}
        aria-label={label}
        className="pl-8"
      />
    </form>
  );
}

// For an id in the URL that doesn't exist (anymore).
export function NotFoundNote({ what, back }: { what: string; back: string }) {
  return (
    <div className="space-y-3 rounded-xl border border-dashed p-6 text-center">
      <p className="text-sm text-muted-foreground">{what} gibt es nicht (mehr).</p>
      <Button asChild variant="outline" size="sm">
        <ViewLink href={back}>
          <ArrowLeftIcon /> Zurück
        </ViewLink>
      </Button>
    </div>
  );
}
