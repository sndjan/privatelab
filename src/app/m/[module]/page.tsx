import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getModule } from "@/modules/registry";

export default function ModulePage({ params, searchParams }: PageProps<"/m/[module]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Lädt …</p>}>
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
      <header className="flex items-center gap-3">
        <span aria-hidden="true" className="text-3xl">
          {definition.icon}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">{definition.name}</h1>
        {row.visibility === "public" && <Badge variant="outline">öffentlich</Badge>}
      </header>
      <Page user={user} hasAccess={hasAccess} searchParams={searchParams} />
    </div>
  );
}
