import { notFound } from "next/navigation";
import { dataQuery } from "@/lib/query/data";
import { Prefetch } from "@/lib/query/server";
import type { ModulePageProps } from "@/modules/registry";
import { WeightApp } from "./app";

// Gewicht-Challenge: a weight challenge between friends. Everyone with access
// sees all participants and enters measurements for anyone; admins set it up.
// Every tab reads the same query; the browser cache takes over (see app.tsx).
export default async function WeightModule({ user, hasAccess }: ModulePageProps) {
  if (!user || !hasAccess) notFound();
  return (
    <Prefetch queries={[dataQuery("weight", "all")]}>
      <WeightApp />
    </Prefetch>
  );
}
