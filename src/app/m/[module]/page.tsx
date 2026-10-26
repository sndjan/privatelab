import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getModule } from "@/modules/registry";

export default function ModulePage({ params }: PageProps<"/m/[module]">) {
  return (
    <Suspense fallback={<p className="opacity-70">Loading…</p>}>
      <ModuleContent params={params} />
    </Suspense>
  );
}

async function ModuleContent({ params }: Pick<PageProps<"/m/[module]">, "params">) {
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
        <span className="text-3xl">{definition.icon}</span>
        <h1 className="text-2xl font-semibold">{definition.name}</h1>
        {row.visibility === "public" && (
          <span className="rounded-full border border-foreground/20 px-2 py-0.5 text-xs">
            public
          </span>
        )}
      </header>
      <Page user={user} hasAccess={hasAccess} />
    </div>
  );
}
