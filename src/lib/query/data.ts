import { queryOptions } from "@tanstack/react-query";
import type { Loaders } from "./loaders";

// Server data for the browser cache. Each query names a loader in
// src/lib/query/loaders.ts ("thesis", "todos"); the browser fetches it from
// /api/data/thesis/todos, a server render calls the loader directly (see
// Prefetch). The key starts with the module, so invalidating ["thesis"]
// refreshes everything of the module.

type Params = Record<string, string>;
type ModuleId = keyof Loaders;
type LoaderName<M extends ModuleId> = keyof Loaders[M] & string;
export type LoaderResult<M extends ModuleId, N extends LoaderName<M>> = Loaders[M][N] extends (...args: never[]) => Promise<infer R>
  ? R
  : never;

export type DataQueryMeta = { module: string; name: string; params: Params };

export function dataQuery<M extends ModuleId, N extends LoaderName<M>>(module: M, name: N, params: Params = {}) {
  const meta: DataQueryMeta = { module, name, params };
  return queryOptions({
    queryKey: Object.keys(params).length > 0 ? [module, name, params] : [module, name],
    queryFn: ({ signal }) => fetchData(module, name, params, signal) as Promise<LoaderResult<M, N>>,
    meta,
  });
}

async function fetchData(module: string, name: string, params: Params, signal: AbortSignal) {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`/api/data/${module}/${name}${query ? `?${query}` : ""}`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`Loading ${module}/${name} failed (${response.status})`);
  return response.json();
}
