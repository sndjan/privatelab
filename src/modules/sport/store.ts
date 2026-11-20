"use client";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { dataQuery } from "@/lib/query/data";
import { saveSettings } from "./actions";
import type { Settings, SportData } from "./types";

const query = dataQuery("sport", "all");

export function useSportData() {
  return useSuspenseQuery(query).data;
}

// Changes the cached settings at once and saves in the background; on an
// error a toast says so, and either way the data refreshes afterwards.
export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useCallback(
    async (patch: Partial<Settings>, done?: string) => {
      void queryClient.cancelQueries({ queryKey: query.queryKey });
      queryClient.setQueryData(query.queryKey, (data: SportData | undefined) => (data ? { ...data, settings: { ...data.settings, ...patch } } : data));
      try {
        await saveSettings(patch);
        if (done) toast.success(done);
      } catch {
        toast.error("Nicht gespeichert.");
      } finally {
        void queryClient.invalidateQueries({ queryKey: ["sport"] });
      }
    },
    [queryClient],
  );
}
