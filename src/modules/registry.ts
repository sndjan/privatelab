// Every module of the app. To add one: add its name and icon in meta.ts, a
// folder under src/modules/<id>/ with a default-exported page component
// (attached below), and a row in public.modules (see supabase/migrations).
import type { ComponentType } from "react";
import type { CurrentUser } from "@/lib/auth";
import BooksModule from "./books";
import FireModule from "./fire";
import { moduleMeta, type ModuleId, type ModuleMeta } from "./meta";
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

const pages: Record<ModuleId, ComponentType<ModulePageProps>> = {
  books: BooksModule,
  fire: FireModule,
  packing: PackingModule,
};

export const modules: ModuleDefinition[] = moduleMeta.map((meta) => ({ ...meta, Page: pages[meta.id] }));

export function getModule(id: string) {
  return modules.find((module) => module.id === id);
}
