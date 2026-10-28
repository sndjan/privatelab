"use client";

import { useSuspenseQueries } from "@tanstack/react-query";
import type { LoaderResult } from "@/lib/query/data";
import { tennisQuery, type TennisData } from "./query";

// The module's data from the browser cache, e.g. useTennis("groups", "sessions").
export function useTennis<const N extends readonly TennisData[]>(...names: N) {
  return useSuspenseQueries({ queries: names.map((name) => tennisQuery(name)) }).map((result) => result.data) as {
    -readonly [I in keyof N]: LoaderResult<"tennis", N[I]>;
  };
}
