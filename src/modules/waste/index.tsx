import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { dataQuery } from "@/lib/query/data";
import { Prefetch } from "@/lib/query/server";
import type { ModulePageProps } from "@/modules/registry";
import { WasteApp } from "./app";

// Mülltrenn-Hilfe: the server starts loading the saved places, the current
// place's rules and the latest scans; the browser cache takes over (app.tsx).
export default async function WasteModule({ user, hasAccess }: ModulePageProps) {
  if (!user || !hasAccess) notFound();
  return (
    <Prefetch queries={[dataQuery("waste", "home")]}>
      <Suspense fallback={<Loading />}>
        <WasteApp />
      </Suspense>
    </Prefetch>
  );
}
