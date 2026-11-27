import { notFound } from "next/navigation";
import { dataQuery } from "@/lib/query/data";
import { Prefetch } from "@/lib/query/server";
import type { ModulePageProps } from "@/modules/registry";
import { KanzleiApp } from "./app";

// Kanzlei-Planer: orders and tasks of a tax office, a day plan by Claude
// (or by rules without a key), a chat that proposes changes, the forecast of
// the next weeks and a history with undo. Every view reads the same query.
export default async function KanzleiModule({ user, hasAccess }: ModulePageProps) {
  if (!user || !hasAccess) notFound();
  return (
    <Prefetch queries={[dataQuery("kanzlei", "all")]}>
      <KanzleiApp />
    </Prefetch>
  );
}
