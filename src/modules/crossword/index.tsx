import { notFound } from "next/navigation";
import type { ModulePageProps } from "@/modules/registry";
import { CrosswordOverview } from "./overview";
import { puzzles } from "./puzzles";

// Kreuzworträtsel: the admin view. Lists every puzzle with its secret link
// and QR code and prints the QR codes. Solvers never see this page; they only
// get the link to one puzzle (/k/<code>), which works without signing in.
export default async function CrosswordModule({ user, hasAccess }: ModulePageProps) {
  if (!user || !hasAccess) notFound();
  return <CrosswordOverview puzzles={puzzles} />;
}
