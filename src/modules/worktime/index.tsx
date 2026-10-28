import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { dataQuery } from "@/lib/query/data";
import { Prefetch } from "@/lib/query/server";
import type { ModulePageProps } from "@/modules/registry";
import { WorktimeApp } from "./app";

// Overtime balance, calendar and vacation. The server starts loading the
// data; the browser cache takes over (see app.tsx).
export default async function WorktimeModule({ user, hasAccess }: ModulePageProps) {
  if (!user || !hasAccess) notFound();
  return (
    <Prefetch queries={[dataQuery("worktime", "overview")]}>
      <Suspense fallback={<Loading />}>
        <WorktimeApp />
      </Suspense>
    </Prefetch>
  );
}
