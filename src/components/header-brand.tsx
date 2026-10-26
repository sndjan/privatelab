"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { moduleMeta } from "@/modules/meta";

// Logo and app name, followed by the current module's name on module pages.
export function HeaderBrand() {
  const pathname = usePathname();
  const moduleId = pathname.match(/^\/m\/([^/]+)/)?.[1];
  const current = moduleMeta.find((meta) => meta.id === moduleId && meta.status === "live");

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
        <Logo />
        <span className={current ? "hidden sm:inline" : undefined}>Private Lab</span>
      </Link>
      {current && (
        <>
          <span aria-hidden="true" className="hidden text-muted-foreground sm:inline">
            /
          </span>
          <Link href={`/m/${current.id}`} aria-current="page" className="flex min-w-0 items-center gap-1.5 font-semibold">
            <span aria-hidden="true">{current.icon}</span>
            <span className="truncate">{current.name}</span>
          </Link>
        </>
      )}
    </div>
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
