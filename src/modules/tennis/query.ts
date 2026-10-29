import { dataQuery } from "@/lib/query/data";
import type { tennisLoaders } from "./loaders";

// Shared by the server (prefetch) and the browser (use-tennis.ts).
export type TennisData = keyof typeof tennisLoaders;

export const tennisQuery = <N extends TennisData>(name: N) => dataQuery("tennis", name);
