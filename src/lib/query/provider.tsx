"use client";

import { isServer, QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The browser keeps one cache for the whole visit, so going back to a view
// shows its data right away and refreshes it in the background.
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data from the server render counts as fresh for a moment, so the
        // browser doesn't fetch it again right after hydrating.
        staleTime: 30_000,
        gcTime: 30 * 60_000,
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  // Each server render gets its own cache; the browser reuses one.
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
