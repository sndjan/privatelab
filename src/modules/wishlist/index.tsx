import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { dataQuery } from "@/lib/query/data";
import { Prefetch } from "@/lib/query/server";
import type { ModulePageProps } from "@/modules/registry";
import { WishlistApp } from "./app";

// The owner's wishlists. The server starts loading what the first view
// shows; the browser cache takes over (see app.tsx). The guests' page is
// /w/<token> and stays server-rendered.
export default async function WishlistModule({ user, hasAccess, searchParams }: ModulePageProps) {
  if (!user || !hasAccess) notFound();
  const params = await searchParams;
  const listId = typeof params.list === "string" ? params.list : undefined;
  return (
    <Prefetch queries={[listId ? dataQuery("wishlist", "list", { id: listId }) : dataQuery("wishlist", "lists")]}>
      <Suspense fallback={<Loading />}>
        <WishlistApp />
      </Suspense>
    </Prefetch>
  );
}
