"use client";

import { GiftIcon, Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { joinNames, type GuestClaim } from "./data";
import { release, reserve } from "./guest-actions";

// What a guest can do with one wish: reserve it (with an optional name, so
// the others know who brings it) or undo their own reservation.
export function GuestButtons({
  token,
  wishId,
  claims,
  free,
  savedName,
}: {
  token: string;
  wishId: string;
  claims: GuestClaim[];
  free: number;
  savedName: string;
}) {
  const [asking, setAsking] = useState(false);
  const [name, setName] = useState(savedName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error: string } | undefined>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result?.error) setError(result.error);
        else setAsking(false);
      } catch {
        setError("Das hat nicht geklappt. Bitte versuch es noch einmal.");
      }
    });
  }

  function confirm(event: React.FormEvent) {
    event.preventDefault();
    run(() => reserve(token, wishId, name));
  }

  return (
    <div className="space-y-2">
      {claims.map((claim) => (
        <div key={claim.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <GiftIcon className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            {claim.mine ? "Von dir reserviert" : `Reserviert von ${joinNames(claim.names)}`}
          </span>
          {claim.mine && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => release(token, claim.id))}>
              Freigeben
            </Button>
          )}
        </div>
      ))}

      {free > 0 &&
        (asking ? (
          <form onSubmit={confirm} className="space-y-2 rounded-lg border p-3">
            <Label htmlFor={`guest-name-${wishId}`}>Dein Name (freiwillig)</Label>
            <div className="flex gap-2">
              <Input
                id={`guest-name-${wishId}`}
                value={name}
                maxLength={60}
                autoComplete="given-name"
                placeholder="z. B. Mama"
                autoFocus
                onChange={(event) => setName(event.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={pending}>
                {pending && <Loader2Icon className="animate-spin" />}
                Reservieren
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Die anderen Gäste sehen, dass es vergeben ist. Freigeben geht später in diesem Browser.
            </p>
          </form>
        ) : (
          <Button size="sm" disabled={pending} onClick={() => setAsking(true)}>
            <GiftIcon /> Ich schenke das
          </Button>
        ))}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
