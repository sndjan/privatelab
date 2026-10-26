"use client";

import { useState } from "react";
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
      setError("Could not send a link. Is this address invited?");
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return <p className="rounded border border-foreground/10 p-3">Check your inbox for the sign-in link.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="w-full rounded border border-foreground/20 bg-transparent px-3 py-2"
      />
      <button
        disabled={status === "sending"}
        className="w-full rounded bg-foreground px-3 py-2 text-background disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : "Send magic link"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
