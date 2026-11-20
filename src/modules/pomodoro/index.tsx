import { notFound } from "next/navigation";
import type { ModulePageProps } from "@/modules/registry";
import { PomodoroApp } from "./app";

// Pomodoro: a plain focus timer with adjustable times, optional 20-20-20 and
// drinking reminders, and a small window that shows only the timer. Everything
// runs and is stored in the browser (see store.ts), so there is nothing to load.
export default function PomodoroModule({ user, hasAccess }: ModulePageProps) {
  if (!user || !hasAccess) notFound();
  return <PomodoroApp />;
}
