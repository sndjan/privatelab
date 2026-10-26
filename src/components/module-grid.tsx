import Link from "next/link";
import type { ModuleDefinition } from "@/modules/registry";

export function ModuleGrid({ modules }: { modules: ModuleDefinition[] }) {
  if (modules.length === 0) {
    return <p className="opacity-70">No modules here yet.</p>;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {modules.map((module) => (
        <li key={module.id}>
          <Link
            href={`/m/${module.id}`}
            className="block rounded-lg border border-foreground/10 p-4 hover:border-foreground/30"
          >
            <div className="text-2xl">{module.icon}</div>
            <div className="mt-2 font-medium">{module.name}</div>
            <p className="text-sm opacity-70">{module.description}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
