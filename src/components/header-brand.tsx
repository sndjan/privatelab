"use client";

import { LayoutGridIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { moduleMeta } from "@/modules/meta";

function useCurrentModule() {
  const pathname = usePathname();
  const moduleId = pathname.match(/^\/m\/([^/]+)/)?.[1];
  return moduleMeta.find((meta) => meta.id === moduleId && meta.status === "live");
}

// Logo and app name. On module pages the module's icon and name take their
// place, so the module feels like an app of its own.
export function HeaderBrand() {
  const current = useCurrentModule();
  if (!current) return <HeaderBrandFallback />;

  return (
    <Link href={`/m/${current.id}`} aria-current="page" className="flex min-w-0 items-center gap-2 font-semibold">
      <span aria-hidden="true" className="w-6 shrink-0 text-center text-xl leading-none">
        {current.icon}
      </span>
      <span className="truncate">{current.name}</span>
    </Link>
  );
}

// Shown while the current module is not known yet.
export function HeaderBrandFallback() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
      <Logo />
      Private Lab
    </Link>
  );
}

// Way back to all modules, shown on module pages only (elsewhere the logo
// already leads there).
export function AllModulesLink() {
  if (!useCurrentModule()) return null;
  return (
    <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
      <Link href="/" aria-label="Alle Module" title="Alle Module">
        <LayoutGridIcon />
      </Link>
    </Button>
  );
}
