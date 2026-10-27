"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ModuleGrid } from "@/components/module-grid";
import { PlannedModules } from "@/components/planned-modules";
import { Loading } from "@/components/loading";
import { parseSessionHint, readSessionHint, writeSessionHint, type SessionHint } from "@/lib/session-hint";
import { moduleMeta } from "@/modules/meta";

// Stores what the server found out about the session (see lib/session-hint).
// `null` means signed out and clears it.
export function RememberSession({ hint }: { hint: Partial<SessionHint> | null }) {
  const serialized = JSON.stringify(hint);
  useEffect(() => writeSessionHint(JSON.parse(serialized)), [serialized]);
  return null;
}

const noSubscribe = () => () => {};

// Dashboard fallback: the modules from the last visit, so the grid is there
// at once and the server's answer usually swaps in the same thing. A spinner
// when there's nothing remembered yet.
export function RememberedDashboard() {
  const raw = useSyncExternalStore(noSubscribe, readSessionHint, () => null);
  const hint = useMemo(() => parseSessionHint(raw), [raw]);
  if (!hint?.moduleIds) return <Loading />;

  return (
    <div className="space-y-12">
      <ModuleGrid modules={moduleMeta.filter((meta) => meta.status === "live" && hint.moduleIds!.includes(meta.id))} />
      {hint.isAdmin && <PlannedModules modules={moduleMeta.filter((meta) => meta.status === "planned")} />}
    </div>
  );
}
