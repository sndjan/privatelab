import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ModuleGrid } from "@/components/module-grid";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { modules } from "@/modules/registry";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold">Private Lab</h1>
        <p className="opacity-70">
          A personal sandbox for small apps and prototypes. Access is invite-only.
        </p>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Public modules</h2>
        <Suspense fallback={<p className="opacity-70">Loading…</p>}>
          <PublicModules />
        </Suspense>
      </section>
    </div>
  );
}

async function PublicModules() {
  if (await getCurrentUser()) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase.from("modules").select("id").eq("visibility", "public");
  const publicIds = new Set((data ?? []).map((row) => row.id));

  return <ModuleGrid modules={modules.filter((module) => publicIds.has(module.id))} />;
}
