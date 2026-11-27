"use client";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo } from "react";
import { toast } from "sonner";
import { dataQuery, type LoaderResult } from "@/lib/query/data";
import type { Item, Kind } from "./data";
import type { PlanData } from "./plan";

export type KanzleiData = LoaderResult<"kanzlei", "all">;

const query = dataQuery("kanzlei", "all");

export function useKanzleiData() {
  return useSuspenseQuery(query).data;
}

export function usePlanData(): PlanData {
  const data = useKanzleiData();
  return useMemo(
    () => ({ settings: data.settings, types: data.types, items: data.items, recurring: data.recurring, absences: data.absences }),
    [data],
  );
}

// Runs a server action and loads the module's data again afterwards; a
// failing action shows a toast instead of throwing.
export function useRun() {
  const queryClient = useQueryClient();
  return useCallback(
    async <T,>(action: () => Promise<T>, done?: string): Promise<T | undefined> => {
      try {
        const result = await action();
        if (result && typeof result === "object" && "error" in result && typeof result.error === "string") {
          toast.error(result.error);
          return result;
        }
        if (done) toast.success(done);
        return result;
      } catch {
        toast.error("Das hat nicht geklappt.");
        return undefined;
      } finally {
        await queryClient.invalidateQueries({ queryKey: ["kanzlei"] });
      }
    },
    [queryClient],
  );
}

export type ItemDialogRequest = { item?: Item; kind?: Kind; parentId?: string; client?: string };

type Dialogs = { openItem: (request: ItemDialogRequest) => void };

export const DialogsContext = createContext<Dialogs>({ openItem: () => {} });
export const useDialogs = () => useContext(DialogsContext);
