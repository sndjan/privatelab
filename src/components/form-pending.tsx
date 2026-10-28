"use client";

import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

// A spinner for forms without a submit button (an input sent with Enter):
// shows while the form's action runs. The form needs `relative`.
export function FormPending({ className }: { className?: string }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <span role="status" className={cn("pointer-events-none absolute top-1/2 right-4 -translate-y-1/2", className)}>
      <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
      <span className="sr-only">Wird gespeichert …</span>
    </span>
  );
}
