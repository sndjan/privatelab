import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { dataQuery } from "@/lib/query/data";
import { Prefetch } from "@/lib/query/server";
import type { ModulePageProps } from "@/modules/registry";
import { NochmalApp } from "./app";

// Noch-mal-Blätter: the list of sheets, a new one, or one sheet in the
// editor. The server starts loading what the first view shows; the browser
// cache takes over (see app.tsx).
export default async function NochmalModule({ user, hasAccess, searchParams }: ModulePageProps) {
  if (!user || !hasAccess) notFound();
  const params = await searchParams;
  const sheetId = typeof params.sheet === "string" ? params.sheet : undefined;
  return (
    <Prefetch queries={[sheetId ? dataQuery("nochmal", "sheet", { id: sheetId }) : dataQuery("nochmal", "list")]}>
      <Suspense fallback={<Loading />}>
        <NochmalApp />
      </Suspense>
    </Prefetch>
  );
}
