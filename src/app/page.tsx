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
        <h1 className="text-3xl font-semibold tracking-tight">Private Lab</h1>
        <p className="text-muted-foreground">
          Eine private Spielwiese für kleine Apps und Prototypen. Zugang nur auf Einladung.
        </p>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Öffentliche Module</h2>
        <Suspense fallback={<p className="text-muted-foreground">Lädt …</p>}>
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
