// Server only. What the browser cache loads for the Kanzlei-Planer (see
// src/lib/query/data.ts): every view reads the same data.
import type { Loader } from "@/lib/query/loaders";
import { createClient } from "@/lib/supabase/server";
import { loadAll } from "./server";

export const kanzleiLoaders = {
  all: async () => loadAll(await createClient()),
} satisfies Record<string, Loader>;
