"use client";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext } from "react";
import { toast } from "sonner";
import { dataQuery, type LoaderResult } from "@/lib/query/data";
import type { Entry, EventType } from "./data";

type Data = LoaderResult<"events", "all">;

const query = dataQuery("events", "all");

export function useEventsData() {
  return useSuspenseQuery(query).data;
}

export const tempId = () => `temp-${Math.random().toString(36).slice(2)}`;
export const isTemp = (id: string) => id.startsWith("temp-");

// Changes the cached data at once and saves in the background, so tapping a
// tile never waits for the network. If saving fails, the data is loaded
// again from the server and a toast says so. Either way the module's data
// refreshes afterwards (real ids instead of temporary ones).
export function useChange() {
  const queryClient = useQueryClient();
  return useCallback(
    <T,>(patch: (data: Data) => Partial<Data>, action: () => Promise<T>): Promise<T | undefined> => {
      void queryClient.cancelQueries({ queryKey: query.queryKey });
      queryClient.setQueryData(query.queryKey, (data) => (data ? { ...data, ...patch(data) } : data));
      return action()
        .catch(() => {
          toast.error("Das hat nicht geklappt.");
          return undefined;
        })
        .finally(() => queryClient.invalidateQueries({ queryKey: ["events"] }));
    },
    [queryClient],
  );
}

// --- Dialogs ----------------------------------------------------------------

export type EntryDialogRequest = {
  // Edit this entry …
  entry?: Entry;
  // … or add one, optionally for a fixed type and date.
  typeId?: string;
  date?: string;
};

type Dialogs = {
  openEntry: (request: EntryDialogRequest) => void;
  // Without a type: a new one.
  openType: (type?: EventType) => void;
};

export const DialogsContext = createContext<Dialogs>({ openEntry: () => {}, openType: () => {} });
export const useDialogs = () => useContext(DialogsContext);
