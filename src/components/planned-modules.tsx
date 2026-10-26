import { Badge } from "@/components/ui/badge";
import { categories, type ModuleMeta } from "@/modules/meta";

// Module ideas that aren't built yet, grouped by category. Not clickable.
export function PlannedModules({ modules }: { modules: ModuleMeta[] }) {
  return (
    <section aria-labelledby="planned-heading" className="space-y-6">
      <div className="space-y-1">
        <h2 id="planned-heading" className="text-lg font-semibold">
          Geplant
        </h2>
        <p className="text-sm text-muted-foreground">Ideen für neue Module. Nur du als Admin siehst diese Liste.</p>
      </div>
      {categories.map((category) => {
        const list = modules.filter((module) => module.category === category.id);
        if (list.length === 0) return null;
        return (
          <div key={category.id} className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">{category.name}</h3>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((module) => (
                <li
                  key={module.id}
                  className="flex gap-3 rounded-xl border border-dashed border-input bg-card/50 p-4"
                >
                  <span aria-hidden="true" className="text-2xl opacity-60 grayscale">
                    {module.icon}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{module.name}</span>
                      <Badge variant="outline" className="text-muted-foreground">
                        Nicht umgesetzt
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{module.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
