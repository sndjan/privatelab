import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ModuleGrid } from "@/components/module-grid";
import { PlannedModules } from "@/components/planned-modules";
import { RememberedDashboard, RememberSession } from "@/components/session-hint";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { modules, plannedModules } from "@/modules/registry";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Deine Module</h1>
      <Suspense fallback={<RememberedDashboard />}>
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
  const visible = modules.filter((module) => visibleIds.has(module.id));

  return (
    <div className="space-y-12">
      <RememberSession hint={{ isAdmin: user.isAdmin, moduleIds: visible.map((module) => module.id) }} />
      <ModuleGrid modules={visible} />
      {user.isAdmin && <PlannedModules modules={plannedModules} />}
    </div>
  );
}
