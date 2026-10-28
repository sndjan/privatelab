import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
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

// Loads the queries the first view needs on the server and hands them to the
// browser cache, so the page renders with data and the client takes over.
export async function Prefetch({
  queries,
  children,
}: {
  queries: { queryKey: readonly unknown[]; meta?: Record<string, unknown> }[];
  children: React.ReactNode;
}) {
  const queryClient = new QueryClient();
  await Promise.all(
    queries.map((query) =>
      queryClient.prefetchQuery({ queryKey: query.queryKey, queryFn: () => runLoader(query.meta as DataQueryMeta) }),
    ),
  );
  return <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>;
}
