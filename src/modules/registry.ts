// Every module of the app. To add one: add an entry here, a folder under
// src/modules/<id>/ with a default-exported page component, and a row in
// public.modules (see supabase/migrations).
import type { ComponentType } from "react";
import type { CurrentUser } from "@/lib/auth";
import BooksModule from "./books";
import FireModule from "./fire";

export type ModulePageProps = {
  user: CurrentUser | null;
  // True for admins and users with a module_access row. False for visitors
  // of a public module.
  hasAccess: boolean;
};

export type ModuleDefinition = {
  id: string;
  name: string;
  description: string;
  icon: string;
  Page: ComponentType<ModulePageProps>;
};

export const modules: ModuleDefinition[] = [
  {
    id: "books",
    name: "Bücher",
    description: "Leseliste, Fortschritt und Notizen.",
    icon: "📚",
    Page: BooksModule,
  },
  {
    id: "fire",
    name: "FIRE",
    description: "Vermögen, Sparquote und der Weg zur finanziellen Unabhängigkeit.",
    icon: "🔥",
    Page: FireModule,
  },
];

export function getModule(id: string) {
  return modules.find((module) => module.id === id);
}
