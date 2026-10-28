import type { CurrentUser } from "@/lib/auth";
import { thesisLoaders } from "@/modules/thesis/loaders";

// Server only. Every server loader the browser cache can ask for, by module and name.
// A loader reads with the user's own Supabase client, so RLS decides what
// it returns. Params come from the query string; check them in the loader.
export type Loader = (params: Record<string, string>, user: CurrentUser) => Promise<unknown>;

export const loaders = {
  thesis: thesisLoaders,
} satisfies Record<string, Record<string, Loader>>;

export type Loaders = typeof loaders;
