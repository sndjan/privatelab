import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ModuleGrid } from "@/components/module-grid";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { modules } from "@/modules/registry";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Your modules</h1>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <VisibleModules />
      </Suspense>
    </div>
  );
}

async function VisibleModules() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // RLS only returns modules that are public or that this user has access to.
  const supabase = await createClient();
  const { data } = await supabase.from("modules").select("id");
  const visibleIds = new Set((data ?? []).map((row) => row.id));

  return <ModuleGrid modules={modules.filter((module) => visibleIds.has(module.id))} />;
}
