"use client";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { dataQuery, type LoaderResult } from "@/lib/query/data";

export const PATH = "/m/kegeln";
export type KegelnData = LoaderResult<"kegeln", "all">;

const query = dataQuery("kegeln", "all");

export function useKegelnData() {
  return useSuspenseQuery(query).data;
}

export function useRefresh() {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: ["kegeln"] }), [queryClient]);
}

// Changes the cached data at once (e.g. a "bezahlt" tick), then refreshes.
export function usePatch() {
  const queryClient = useQueryClient();
  return useCallback(
    (patch: (data: KegelnData) => KegelnData) => {
      void queryClient.cancelQueries({ queryKey: query.queryKey });
      queryClient.setQueryData(query.queryKey, (data) => (data ? patch(data) : data));
    },
    [queryClient],
  );
}
