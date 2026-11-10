"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDownIcon, EllipsisVerticalIcon, EyeIcon, EyeOffIcon, PinIcon, PinOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { arrangeModules, useDashboardPrefs } from "@/lib/dashboard-prefs";
import { cn } from "@/lib/utils";
import type { ModuleMeta } from "@/modules/meta";

export function ModuleGrid({ modules }: { modules: ModuleMeta[] }) {
  const { prefs, setPinned, setHidden } = useDashboardPrefs();
  const [showHidden, setShowHidden] = useState(false);

  if (modules.length === 0) {
    return <p className="text-muted-foreground">Hier gibt es noch keine Module.</p>;
  }

  const { pinned, others, hidden } = arrangeModules(modules, prefs);
  const pinnedIds = new Set(pinned.map((module) => module.id));
  const card = (module: ModuleMeta, isHidden = false) => (
    <ModuleCard
      key={module.id}
      module={module}
      pinned={pinnedIds.has(module.id)}
      hidden={isHidden}
      onPin={(value) => setPinned(module.id, value)}
      onHide={(value) => setHidden(module.id, value)}
    />
  );

  return (
    <div className="space-y-6">
      {pinned.length + others.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {pinned.map((module) => card(module))}
          {others.map((module) => card(module))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Du hast alle Module ausgeblendet.</p>
      )}
      {hidden.length > 0 && (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setShowHidden(!showHidden)}
            aria-expanded={showHidden}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronDownIcon className={cn("size-4 transition-transform", !showHidden && "-rotate-90")} />
            Ausgeblendet ({hidden.length})
          </button>
          {showHidden && <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{hidden.map((module) => card(module, true))}</ul>}
        </section>
      )}
    </div>
  );
}

function ModuleCard({
  module,
  pinned,
  hidden,
  onPin,
  onHide,
}: {
  module: ModuleMeta;
  pinned: boolean;
  hidden: boolean;
  onPin: (pinned: boolean) => void;
  onHide: (hidden: boolean) => void;
}) {
  return (
    <li className={cn("relative", hidden && "opacity-60")}>
      <Link
        href={`/m/${module.id}`}
        className="flex h-full flex-col gap-1 rounded-xl border bg-card p-3 pr-9 text-card-foreground shadow-sm transition-colors hover:border-input focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-xl">
            {module.icon}
          </span>
          {pinned && <PinIcon aria-label="Angeheftet" className="size-3.5 text-muted-foreground" />}
        </div>
        <span className="leading-tight font-semibold">{module.name}</span>
        <span className="line-clamp-2 text-xs text-muted-foreground">{module.description}</span>
      </Link>
      {/* Outside the link, so opening the menu doesn't open the module. */}
      <div className="absolute top-1.5 right-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={`${module.name}: mehr`}>
              <EllipsisVerticalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!hidden && (
              <DropdownMenuItem onSelect={() => onPin(!pinned)}>
                {pinned ? <PinOffIcon /> : <PinIcon />} {pinned ? "Lösen" : "Anheften"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => onHide(!hidden)}>
              {hidden ? <EyeIcon /> : <EyeOffIcon />} {hidden ? "Einblenden" : "Ausblenden"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
