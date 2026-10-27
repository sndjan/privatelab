"use client";

import { GiftIcon, Loader2Icon, UsersIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { joinNames, type GuestClaim } from "./data";
import { joinGroup, release, reserve } from "./guest-actions";

type Ask = { kind: "alone" } | { kind: "group" } | { kind: "join"; claim: GuestClaim };

// What a guest can do with one wish: reserve it alone, start a group gift,
// join a group or undo their own reservation.
export function GuestButtons({
  token,
  wishId,
  title,
  claims,
  free,
  savedName,
  readOnly,
}: {
  token: string;
  wishId: string;
  title: string;
  claims: GuestClaim[];
  free: number;
  savedName: string;
  // The owner looking at their own link.
  readOnly: boolean;
}) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [name, setName] = useState(savedName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error: string } | undefined>, close = true) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result?.error) setError(result.error);
        else if (close) setAsk(null);
      } catch {
        setError("Das hat nicht geklappt. Bitte versuch es noch einmal.");
      }
    });
  }

  function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (!ask) return;
    if (ask.kind === "join") run(() => joinGroup(token, ask.claim.id, name));
    else run(() => reserve(token, wishId, ask.kind === "group", name));
  }

  const groupKind = ask?.kind === "group" || ask?.kind === "join";

  return (
    <div className="space-y-2">
      {claims.map((claim) => (
        <div key={claim.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          {claim.isGroup ? <UsersIcon className="size-4 shrink-0" /> : <GiftIcon className="size-4 shrink-0" />}
          <span className="min-w-0 flex-1">
            {readOnly
              ? claim.isGroup
                ? `Gruppengeschenk (${claim.names.length})`
                : "Reserviert"
              : claim.isGroup
                ? `${joinNames(claim.names)} ${claim.names.length === 1 ? "schenkt" : "schenken"} zusammen`
                : claim.mine
                  ? "Von dir reserviert"
                  : `Reserviert von ${joinNames(claim.names)}`}
          </span>
          {!readOnly &&
            (claim.mine ? (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => release(token, claim.id), false)}>
                {claim.isGroup ? "Austreten" : "Freigeben"}
              </Button>
            ) : (
              claim.isGroup && (
                <Button size="sm" variant="outline" className="bg-card" disabled={pending} onClick={() => setAsk({ kind: "join", claim })}>
                  Mitmachen
                </Button>
              )
            ))}
        </div>
      ))}

      {!readOnly && free > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pending} onClick={() => setAsk({ kind: "alone" })}>
            <GiftIcon /> Ich schenke das
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setAsk({ kind: "group" })}>
            <UsersIcon /> Zusammen schenken
          </Button>
        </div>
      )}

      {error && !ask && <p className="text-sm text-destructive">{error}</p>}

      <Dialog
        open={ask !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAsk(null);
            setError(null);
          }
        }}
      >
        <DialogContent>
          <form onSubmit={confirm} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {ask?.kind === "join" ? "Beim Gruppengeschenk mitmachen" : ask?.kind === "group" ? "Gruppengeschenk starten" : "Reservieren"}
              </DialogTitle>
              <DialogDescription>
                {groupKind
                  ? `„${title}“: andere können sich anschließen und sehen, wer dabei ist. Absprechen müsst ihr euch selbst.`
                  : `„${title}“ wird für alle anderen als reserviert angezeigt. Du kannst es in diesem Browser wieder freigeben.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor={`guest-name-${wishId}`}>{groupKind ? "Dein Name" : "Dein Name (freiwillig)"}</Label>
              <Input
                id={`guest-name-${wishId}`}
                value={name}
                required={groupKind}
                maxLength={60}
                autoComplete="given-name"
                placeholder="z. B. Mama"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2Icon className="animate-spin" />}
                {ask?.kind === "join" ? "Mitmachen" : "Reservieren"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
