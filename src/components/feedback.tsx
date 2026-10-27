"use client";

import { MessageSquareIcon } from "lucide-react";
import { useState } from "react";
import { sendFeedback } from "@/app/feedback/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const kinds = [
  { value: "bug", label: "Fehler" },
  { value: "idea", label: "Idee" },
  { value: "other", label: "Sonstiges" },
];

// Header button that opens a form for bugs, ideas and other feedback.
// The current page is sent along so it's clear what the feedback is about.
// It's read on sending, not with usePathname: the button is also part of the
// prerendered header, where the URL isn't known yet.
export function Feedback() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("idea");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(formData: FormData) {
    setError(null);
    formData.set("page", window.location.pathname);
    formData.set("userAgent", navigator.userAgent);
    try {
      const result = await sendFeedback(formData);
      if (result.error) setError(result.error);
      else setSent(true);
    } catch {
      setError("Keine Verbindung zum Server. Versuch es bitte noch einmal.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setSent(false);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Feedback geben" title="Feedback">
          <MessageSquareIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {sent ? (
          <>
            <DialogHeader>
              <DialogTitle>Danke!</DialogTitle>
              <DialogDescription>Dein Feedback ist angekommen.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button>Schließen</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form action={send} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Feedback</DialogTitle>
              <DialogDescription>Was funktioniert nicht, was fehlt dir, was wünschst du dir?</DialogDescription>
            </DialogHeader>
            <input type="hidden" name="kind" value={kind} />
            <ToggleGroup
              type="single"
              variant="outline"
              value={kind}
              onValueChange={(value) => value && setKind(value)}
              aria-label="Art"
              className="w-full"
            >
              {kinds.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value} className="h-10">
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <div className="space-y-2">
              <Label htmlFor="feedback-message">Nachricht</Label>
              <Textarea
                id="feedback-message"
                name="message"
                required
                maxLength={4000}
                rows={5}
                className="min-h-32"
                placeholder={kind === "bug" ? "Was ist passiert, und was hättest du erwartet?" : "Erzähl …"}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Abbrechen
                </Button>
              </DialogClose>
              <SubmitButton>Senden</SubmitButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
