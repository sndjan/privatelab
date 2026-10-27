import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getModule } from "@/modules/registry";

export default function ModulePage({ params, searchParams }: PageProps<"/m/[module]">) {
  return (
    <Suspense fallback={<Loading />}>
      <ModuleContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ModuleContent({ params, searchParams }: PageProps<"/m/[module]">) {
  const { module: moduleId } = await params;
  const definition = getModule(moduleId);
  if (!definition) notFound();

  // RLS hides the row unless the module is public or the user has access.
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("modules")
    .select("id, visibility")
    .eq("id", moduleId)
    .maybeSingle();

  const user = await getCurrentUser();
  if (!row) {
    if (!user) redirect(`/login?next=/m/${moduleId}`);
    notFound();
  }

  let hasAccess = user?.isAdmin ?? false;
  if (user && !hasAccess) {
    const { data: access } = await supabase
      .from("module_access")
      .select("module_id")
      .eq("user_id", user.id)
      .eq("module_id", moduleId)
      .maybeSingle();
    hasAccess = Boolean(access);
  }

  const { Page } = definition;

  return (
    <div className="space-y-6">
      {/* The module's name is shown in the site header. */}
      <h1 className="sr-only">{definition.name}</h1>
      <Page user={user} hasAccess={hasAccess} searchParams={searchParams} />
    </div>
  );
}
