// Every live module of the app. To add one: add (or switch to "live") its
// entry in meta.ts, a folder under src/modules/<id>/ with a default-exported
// page component (attached below), and a row in public.modules (see
// supabase/migrations).
import type { ComponentType } from "react";
import type { CurrentUser } from "@/lib/auth";
import FireModule from "./fire";
import { moduleMeta, type ModuleMeta } from "./meta";
import PackingModule from "./packing";

export type ModulePageProps = {
  user: CurrentUser | null;
  // True for admins and users with a module_access row. False for visitors
  // of a public module.
  hasAccess: boolean;
  // The page's query string, for modules with several views.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export type ModuleDefinition = ModuleMeta & {
  Page: ComponentType<ModulePageProps>;
};

const pages: Record<string, ComponentType<ModulePageProps>> = {
  fire: FireModule,
  packing: PackingModule,
};

export const modules: ModuleDefinition[] = moduleMeta
  .filter((meta) => meta.status === "live")
  .map((meta) => {
    const Page = pages[meta.id];
    if (!Page) throw new Error(`Live module "${meta.id}" has no page in registry.ts`);
    return { ...meta, Page };
  });

// Ideas that aren't built yet, shown to admins on the dashboard.
export const plannedModules = moduleMeta.filter((meta) => meta.status === "planned");

export function getModule(id: string) {
  return modules.find((module) => module.id === id);
}
