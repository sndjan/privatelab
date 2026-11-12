"use client";

import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

// Submit button of the admin forms: disabled with a spinner while the action runs.
export function Submit({ className, children }: { className?: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn(className, "disabled:opacity-70")}>
      {pending && <Loader2Icon className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
