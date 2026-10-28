"use client";

import { HydrationBoundary, useQueryClient, type DehydratedState } from "@tanstack/react-query";
import { useEffect } from "react";

// Hands the server's data to the browser cache. Each server render of the
// page brings a new state, also the one after a server action changed
// something; then the module's other cached views may be outdated too, so
// they are marked stale and refresh the next time they show.
export function CacheBoundary({ state, modules, children }: { state: DehydratedState; modules: string[]; children: React.ReactNode }) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const fresh = new Set(state.queries.map((query) => query.queryHash));
    for (const moduleId of modules) {
      void queryClient.invalidateQueries({
        queryKey: [moduleId],
        refetchType: "none",
        predicate: (query) => !fresh.has(query.queryHash),
      });
    }
  }, [queryClient, state, modules]);
  return <HydrationBoundary state={state}>{children}</HydrationBoundary>;
}
