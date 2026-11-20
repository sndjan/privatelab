// Server only. What the browser cache loads for the Sport module (see
// src/lib/query/data.ts): everything the Garmin/Hevy sync stored, shaped by
// the database function public.sport_dashboard(), which checks module access.
import type { Loader } from "@/lib/query/loaders";
import { createClient } from "@/lib/supabase/server";
import type { SportData } from "./types";

export const sportLoaders = {
  all: async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("sport_dashboard");
    if (error) throw new Error(`sport_dashboard: ${error.message}`);
    return data as SportData;
  },
} satisfies Record<string, Loader>;
