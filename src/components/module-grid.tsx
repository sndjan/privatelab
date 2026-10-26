import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ModuleDefinition } from "@/modules/registry";

export function ModuleGrid({ modules }: { modules: ModuleDefinition[] }) {
  if (modules.length === 0) {
    return <p className="text-muted-foreground">No modules here yet.</p>;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {modules.map((module) => (
        <li key={module.id}>
          <Link href={`/m/${module.id}`} className="group block rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
            <Card className="transition-colors group-hover:border-input">
              <CardHeader>
                <div aria-hidden="true" className="text-2xl">
                  {module.icon}
                </div>
                <CardTitle className="mt-2">{module.name}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
