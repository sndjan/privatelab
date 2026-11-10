import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ModuleGrid } from "@/components/module-grid";
import { PlannedModules } from "@/components/planned-modules";
import { RememberedDashboard, RememberSession } from "@/components/session-hint";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { moduleMeta } from "@/modules/meta";
import { plannedModules } from "@/modules/registry";

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
  // Plain metadata, not the registry entries: ModuleGrid is a client
  // component and can't receive their Page components.
  const visible = moduleMeta.filter((meta) => meta.status === "live" && visibleIds.has(meta.id));

  return (
    <div className="space-y-12">
      <RememberSession hint={{ isAdmin: user.isAdmin, moduleIds: visible.map((module) => module.id) }} />
      <ModuleGrid modules={visible} />
      {user.isAdmin && <PlannedModules modules={plannedModules} />}
    </div>
  );
}
