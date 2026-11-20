import { notFound } from "next/navigation";
import { dataQuery } from "@/lib/query/data";
import { Prefetch } from "@/lib/query/server";
import type { ModulePageProps } from "@/modules/registry";
import { SportApp } from "./app";

// Sport: Garmin Connect and Hevy, synced every 6 hours by the edge function
// sport-sync. Private: the data belongs to the owner of the API keys, so only
// admins (and users given access on /admin) can open it. All tabs read the
// same query; the browser cache takes over (see app.tsx).
export default async function SportModule({ user, hasAccess }: ModulePageProps) {
  if (!user || !hasAccess) notFound();
  return (
    <Prefetch queries={[dataQuery("sport", "all")]}>
      <SportApp />
    </Prefetch>
  );
}
