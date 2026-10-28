import { dataQuery } from "@/lib/query/data";
import type { thesisLoaders } from "./loaders";

// Shared by the server (prefetch) and the browser (use-thesis.ts).
export type ThesisData = Exclude<keyof typeof thesisLoaders, "documentUrls">;

export function thesisQuery<N extends ThesisData>(name: N) {
  const query = dataQuery("thesis", name);
  // The writer keeps the text in the cache as it is typed (and saves it in
  // the background), so the cache is never older than the server.
  return name === "sections" ? { ...query, staleTime: Infinity, refetchOnWindowFocus: false } : query;
}
