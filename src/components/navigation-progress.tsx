"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// A thin bar at the top of the screen from the click on a link until the next
// page is there. Module pages switch views with search params (?group=…),
// which keeps the old view on screen while the server renders the new one;
// without the bar a tap looks like it did nothing.
//
// Starts on clicks on same-origin links (Next's <Link> included) and ends when
// the URL changes, which Next does once the new page is ready. Uses URL hooks,
// so it has to sit inside a Suspense boundary in the prerendered layout.
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = `${pathname}?${searchParams}`;
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [lastUrl, setLastUrl] = useState(url);
  if (url !== lastUrl) {
    setLastUrl(url);
    if (state === "loading") setState("done");
  }

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;
      const target = new URL(link.href, window.location.href);
      if (target.origin !== window.location.origin) return;
      // Same page, or only a different #hash: nothing loads.
      if (target.pathname === window.location.pathname && target.search === window.location.search) return;
      setState("loading");
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (state === "idle") return;
    // "done" fades out; a navigation that never finishes (offline, an error
    // page at the same URL) gives up after a while.
    const timer = setTimeout(() => setState("idle"), state === "done" ? 400 : 15_000);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 origin-left bg-brand print:hidden",
        state === "idle" && "scale-x-0 opacity-0",
        // Grows quickly at first and slows down; shows only after a short
        // delay, so navigations that are instant don't flash it.
        state === "loading" && "animate-[navigation-progress_8s_cubic-bezier(0.1,0.7,0.3,1)_150ms_both]",
        state === "done" && "scale-x-100 opacity-0 transition-[transform,opacity] duration-300 ease-out",
      )}
    />
  );
}
