import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { dataQuery } from "@/lib/query/data";
import { Prefetch } from "@/lib/query/server";
import type { ModulePageProps } from "@/modules/registry";
import { KegelnApp } from "./app";

// Kegelkasse: photograph the Spielbericht (and for home matches the
// Wurfscheine), check what was read, and get the table of what every player
// pays, with a history per season. All views read the same query.
export default async function KegelnModule({ user, hasAccess }: ModulePageProps) {
  if (!user || !hasAccess) notFound();
  return (
    <Prefetch queries={[dataQuery("kegeln", "all")]}>
      <Suspense fallback={<Loading />}>
        <KegelnApp />
      </Suspense>
    </Prefetch>
  );
}
