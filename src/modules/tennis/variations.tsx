import { cn } from "@/lib/utils";
import { variationKinds, type Variations } from "./data";

// Leichter / Schwerer / Weniger Kinder / Mehr Kinder, the ones that are set.
// Switching to "Schwerer" after a few minutes keeps a block from getting boring.
export function VariationList({ variations, className }: { variations: Variations; className?: string }) {
  const shown = variationKinds.filter((kind) => variations[kind.id]);
  if (shown.length === 0) return null;
  return (
    <dl className={cn("grid gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]", className)}>
      {shown.map((kind) => (
        <div key={kind.id} className="contents">
          <dt className="font-medium text-muted-foreground">{kind.name}</dt>
          <dd className="-mt-1 mb-1 sm:m-0">{variations[kind.id]}</dd>
        </div>
      ))}
    </dl>
  );
}
