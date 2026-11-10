import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { dataQuery } from "@/lib/query/data";
import { Prefetch } from "@/lib/query/server";
import type { ModulePageProps } from "@/modules/registry";
import { FokusApp } from "./app";

// Fokusküche: a focus timer that cooks a three-course menu while you work,
// 3 × 45 minutes with 15 minutes of tea in between. The server starts loading
// the evening that is going on; the browser keeps the clock (see app.tsx).
export default async function FokusModule({ user, hasAccess }: ModulePageProps) {
  if (!user || !hasAccess) notFound();
  return (
    <Prefetch queries={[dataQuery("fokus", "state")]}>
      <Suspense fallback={<Loading />}>
        <FokusApp />
      </Suspense>
    </Prefetch>
  );
}
