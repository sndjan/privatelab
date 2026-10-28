"use client";

import { useSuspenseQueries } from "@tanstack/react-query";
import type { LoaderResult } from "@/lib/query/data";
import { thesisQuery, type ThesisData } from "./query";

// The module's data from the browser cache, e.g. useThesis("todos", "people").
// Suspends until all of it is there; afterwards refreshes in the background.
export function useThesis<const N extends readonly ThesisData[]>(...names: N) {
  return useSuspenseQueries({ queries: names.map((name) => thesisQuery(name)) }).map((result) => result.data) as {
    -readonly [I in keyof N]: LoaderResult<"thesis", N[I]>;
  };
}
