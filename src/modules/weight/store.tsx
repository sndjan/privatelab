"use client";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext } from "react";
import { toast } from "sonner";
import { dataQuery, type LoaderResult } from "@/lib/query/data";

export type WeightData = LoaderResult<"weight", "all">;

const query = dataQuery("weight", "all");

export function useWeightData() {
  return useSuspenseQuery(query).data;
}

// Changes the cached data at once and saves in the background. If saving
// fails, a toast says so; either way the data refreshes afterwards.
export function useChange() {
  const queryClient = useQueryClient();
  return useCallback(
    <T,>(patch: (data: WeightData) => Partial<WeightData>, action: () => Promise<T>): Promise<T | undefined> => {
      void queryClient.cancelQueries({ queryKey: query.queryKey });
      queryClient.setQueryData(query.queryKey, (data) => (data ? { ...data, ...patch(data) } : data));
      return action()
        .catch(() => {
          toast.error("Nicht gespeichert.");
          return undefined;
        })
        .finally(() => queryClient.invalidateQueries({ queryKey: ["weight"] }));
    },
    [queryClient],
  );
}

// --- The entry sheet ----------------------------------------------------------

export type SheetRequest = {
  kind: "weight" | "measures";
  // Edit the measurement of this person and day; without, a new one.
  edit?: { participantId: string; date: string };
};

export const SheetContext = createContext<(request: SheetRequest) => void>(() => {});
export const useOpenSheet = () => useContext(SheetContext);
