"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError(null);

    const callback = new URL("/auth/callback", window.location.origin);
    if (next) callback.searchParams.set("next", next);

    const { error } = await createClient().auth.signInWithOtp({
      email,
      // Invite-only: never create accounts from the login form.
      options: { shouldCreateUser: false, emailRedirectTo: callback.toString() },
    });

    if (error) {
      setStatus("idle");
      setError("Der Link konnte nicht gesendet werden. Ist diese Adresse eingeladen?");
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <Alert>
        <AlertDescription className="text-foreground">Schau in dein Postfach, dort wartet der Anmeldelink.</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="du@beispiel.de"
          aria-invalid={error ? true : undefined}
        />
      </div>
      <Button disabled={status === "sending"} className="w-full">
        {status === "sending" ? "Wird gesendet …" : "Anmeldelink senden"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
