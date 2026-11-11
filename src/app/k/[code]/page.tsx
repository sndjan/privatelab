import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { CrosswordPlayer } from "@/modules/crossword/player";
import { getPuzzle, toPublic } from "@/modules/crossword/puzzles";

// One crossword of the module "crossword", opened by its secret link (or QR
// code). Works without signing in; there is no list of the other puzzles.

export const metadata: Metadata = {
  title: "Kreuzworträtsel",
  robots: { index: false, follow: false },
};

// The puzzle is always shown light. This runs before the first paint, so a
// dark device doesn't flash dark first; the player keeps it light after.
const lightScript = `document.documentElement.dataset.theme="light";`;

export default function CrosswordPage({ params }: PageProps<"/k/[code]">) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: lightScript }} />
      <Suspense fallback={<Loading />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/k/[code]">["params"] }) {
  const puzzle = getPuzzle((await params).code);
  if (!puzzle) notFound();
  return <CrosswordPlayer puzzle={toPublic(puzzle)} />;
}
