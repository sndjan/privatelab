import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { dataQuery } from "@/lib/query/data";
import { Prefetch } from "@/lib/query/server";
import type { ModulePageProps } from "@/modules/registry";
import { PackingApp } from "./app";

// Packing lists used like a note with checkboxes. The server starts loading
// what the first view shows; the browser cache takes over (see app.tsx).
export default async function PackingModule({ user, hasAccess, searchParams }: ModulePageProps) {
  if (!user || !hasAccess) notFound();
  const params = await searchParams;
  const id = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const listId = id("list");
  const placeId = id("place");
  const query = listId
    ? dataQuery("packing", "list", { id: listId })
    : placeId
      ? dataQuery("packing", "place", { id: placeId })
      : dataQuery("packing", "overview");

  return (
    <Prefetch queries={[query]}>
      <Suspense fallback={<Loading />}>
        <PackingApp />
      </Suspense>
    </Prefetch>
  );
}
