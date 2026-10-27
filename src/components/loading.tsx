import { Loader2Icon } from "lucide-react";

// Suspense fallback for pages: a spinner in the middle of the screen. It fades
// in after a moment, so fast loads don't flash it.
export function Loading() {
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-0 flex items-center justify-center animate-in fade-in fill-mode-backwards delay-300 duration-300"
    >
      <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      <span className="sr-only">Lädt …</span>
    </div>
  );
}
