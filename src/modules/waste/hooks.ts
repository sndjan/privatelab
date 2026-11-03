"use client";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { dataQuery } from "@/lib/query/data";

export const PATH = "/m/waste";

// The home data, polled every few seconds while the current place's rules
// are still being looked up.
export function useHome() {
  return useSuspenseQuery({
    ...dataQuery("waste", "home"),
    refetchInterval: (query) => {
      const rules = query.state.data?.rules;
      return rules?.status === "pending" && !rules.stuck ? 5000 : false;
    },
  });
}

export function useRefresh() {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: ["waste"] }), [queryClient]);
}
