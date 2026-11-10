import type { CurrentUser } from "@/lib/auth";
import { eventsLoaders } from "@/modules/events/loaders";
import { fireLoaders } from "@/modules/fire/loaders";
import { fokusLoaders } from "@/modules/fokus/loaders";
import { nochmalLoaders } from "@/modules/nochmal/loaders";
import { packingLoaders } from "@/modules/packing/loaders";
import { tennisLoaders } from "@/modules/tennis/loaders";
import { thesisLoaders } from "@/modules/thesis/loaders";
import { wasteLoaders } from "@/modules/waste/loaders";
import { weightLoaders } from "@/modules/weight/loaders";
import { wishlistLoaders } from "@/modules/wishlist/loaders";
import { worktimeLoaders } from "@/modules/worktime/loaders";

// Server only. Every server loader the browser cache can ask for, by module and name.
// A loader reads with the user's own Supabase client, so RLS decides what
// it returns. Params come from the query string; check them in the loader.
export type Loader = (params: Record<string, string>, user: CurrentUser) => Promise<unknown>;

export const loaders = {
  events: eventsLoaders,
  fire: fireLoaders,
  fokus: fokusLoaders,
  nochmal: nochmalLoaders,
  packing: packingLoaders,
  tennis: tennisLoaders,
  thesis: thesisLoaders,
  waste: wasteLoaders,
  weight: weightLoaders,
  wishlist: wishlistLoaders,
  worktime: worktimeLoaders,
} satisfies Record<string, Record<string, Loader>>;

export type Loaders = typeof loaders;
