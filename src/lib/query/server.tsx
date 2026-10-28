import { defaultShouldDehydrateQuery, dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { getCurrentUser } from "@/lib/auth";
import type { DataQueryMeta } from "./data";
import { loaders, type Loader } from "./loaders";

// Server only: runs loaders with the signed-in user.
export async function runLoader({ module, name, params }: DataQueryMeta) {
  const loader = (loaders as Record<string, Record<string, Loader>>)[module]?.[name];
  if (!loader) throw new Error(`Unknown loader ${module}/${name}`);
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return loader(params, user);
}

// Starts the queries the first view needs on the server and streams them
// into the browser cache: the page shell comes right away, and a browser that
// still has the data from an earlier visit shows it until the fresh data is
// there. Views read it with useSuspenseQuery.
export function Prefetch({
  queries,
  children,
}: {
  queries: { queryKey: readonly unknown[]; meta?: Record<string, unknown> }[];
  children: React.ReactNode;
}) {
  const queryClient = new QueryClient();
  for (const query of queries) {
    void queryClient.prefetchQuery({ queryKey: query.queryKey, queryFn: () => runLoader(query.meta as DataQueryMeta) });
  }
  return (
    <HydrationBoundary
      state={dehydrate(queryClient, {
        shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      })}
    >
      {children}
    </HydrationBoundary>
  );
}
