"use client";

import { RotateCwIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Shown when a page or a form's server action throws. In production the
// message from the server is hidden, so it says what to do instead.
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div data-error-page className="mx-auto max-w-md space-y-4 py-12 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Das hat nicht geklappt</h1>
      <p className="text-sm text-muted-foreground">
        Beim Laden oder Speichern ist etwas schiefgegangen. Prüf deine Verbindung und versuch es noch einmal.
      </p>
      <div className="flex justify-center gap-2">
        <Button onClick={() => retry()}>
          <RotateCwIcon /> Nochmal versuchen
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Zur Übersicht</Link>
        </Button>
      </div>
    </div>
  );
}
