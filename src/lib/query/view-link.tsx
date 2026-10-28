"use client";

import Link from "next/link";
import { useCallback } from "react";

// Switches between views of the same page (?tab=…, ?group=…) in the browser,
// without asking the server: the view renders from the query cache right away
// and refreshes its data in the background. Next keeps useSearchParams in
// sync with history.pushState. Links to other pages are normal <Link>s.
export function ViewLink({ href, onClick, replace, ...props }: React.ComponentProps<typeof Link> & { href: string }) {
  const navigate = useViewNavigate();
  return (
    <Link
      href={href}
      replace={replace}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (new URL(href, window.location.href).pathname !== window.location.pathname) return;
        event.preventDefault();
        navigate(href, { replace });
      }}
      {...props}
    />
  );
}

export function useViewNavigate() {
  return useCallback((href: string, { replace = false, scroll = true }: { replace?: boolean; scroll?: boolean } = {}) => {
    const url = new URL(href, window.location.href);
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    if (!scroll) return;
    // After the new view rendered: to the #anchor, or to the top.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const target = url.hash ? document.getElementById(decodeURIComponent(url.hash.slice(1))) : null;
        if (target) target.scrollIntoView({ block: "start" });
        else window.scrollTo({ top: 0 });
      }),
    );
  }, []);
}
