import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { Prefetch } from "@/lib/query/server";
import type { ModulePageProps } from "@/modules/registry";
import { TennisApp } from "./app";
import { tennisQuery, type TennisData } from "./query";

// Kids' tennis sessions. The server starts loading what the views read; the
// browser cache takes over (see app.tsx). The tables are small, so every
// view reads whole lists.
const everything: TennisData[] = ["groups", "exercises", "sessions", "players", "holidays", "standIns", "favorites", "principles"];

export default async function TennisModule({ user, hasAccess }: ModulePageProps) {
  if (!user || !hasAccess) notFound();
  return (
    <Prefetch queries={everything.map(tennisQuery)}>
      <Suspense fallback={<Loading />}>
        <TennisApp />
      </Suspense>
    </Prefetch>
  );
}
