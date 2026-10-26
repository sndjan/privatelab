// Every module of the app. To add one: add an entry here, a folder under
// src/modules/<id>/ with a default-exported page component, and a row in
// public.modules (see supabase/migrations).
import type { ComponentType } from "react";
import BooksModule from "./books";
import FireModule from "./fire";

export type ModuleDefinition = {
  id: string;
  name: string;
  description: string;
  icon: string;
  Page: ComponentType;
};

export const modules: ModuleDefinition[] = [
  {
    id: "books",
    name: "Books",
    description: "Reading list, progress and notes.",
    icon: "📚",
    Page: BooksModule,
  },
  {
    id: "fire",
    name: "FIRE",
    description: "Net worth, savings rate and the road to financial independence.",
    icon: "🔥",
    Page: FireModule,
  },
];

export function getModule(id: string) {
  return modules.find((module) => module.id === id);
}
