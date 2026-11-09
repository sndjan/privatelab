import { Court } from "./court";
import { formatClock, showsMidcourt, timeline, type Exercise, type Stage } from "./data";

// The session on one A5 page in black and white, kept short to take along:
// per exercise the time, name, the session's note, one short sentence and a
// short "leichter / schwerer", with a small upright sketch. Only printed;
// the page itself is hidden in print.
export function PrintSheet({
  title,
  subtitle,
  startTime,
  items,
  notes,
  stage = null,
}: {
  title: string;
  subtitle: string;
  startTime: string;
  items: { exercise: Exercise; minutes: number; note?: string }[];
  notes: string;
  stage?: Stage | null;
}) {
  const ranges = timeline(startTime, items);

  return (
    <div className="hidden text-[8pt] leading-tight text-black print:block">
      {/* Only on this page: A5 with small margins. */}
      <style>{"@page { size: A5 portrait; margin: 7mm; }"}</style>
      <header className="mb-1 flex items-baseline justify-between gap-3 border-b-2 border-black pb-0.5">
        <h1 className="text-[11pt] font-bold">{title}</h1>
        <p className="text-right">{subtitle}</p>
      </header>
      <ol>
        {items.map(({ exercise, minutes, note }, index) => {
          const easier = shortText(exercise.variations.easier, 60);
          const harder = shortText(exercise.variations.harder, 60);
          return (
            <li key={index} className="flex break-inside-avoid gap-2 border-b border-black/40 py-1">
              <div className="w-9 shrink-0 font-mono">
                <div className="font-bold">{formatClock(ranges[index].start)}</div>
                <div>{minutes}′</div>
              </div>
              <div className="min-w-0 flex-1 space-y-px">
                <p className="text-[9pt] font-bold">{exercise.name}</p>
                {note && <p className="font-bold">» {note}</p>}
                {exercise.summary && <p>{shortText(exercise.summary, 110)}</p>}
                {(easier || harder) && (
                  <p>
                    {easier && (
                      <>
                        <span className="font-semibold">Leichter:</span> {easier}
                      </>
                    )}
                    {easier && harder && " · "}
                    {harder && (
                      <>
                        <span className="font-semibold">Schwerer:</span> {harder}
                      </>
                    )}
                  </p>
                )}
              </div>
              {exercise.diagram.items.length > 0 && (
                <Court diagram={exercise.diagram} mono midcourt={showsMidcourt(exercise, stage)} className="h-[17mm] w-auto shrink-0" />
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-1.5 break-inside-avoid">
        <p className="font-semibold">Notizen</p>
        {notes && <p className="whitespace-pre-line">{notes}</p>}
        <div className="mt-1 h-4 border-b border-black/60" />
        <div className="h-4 border-b border-black/60" />
      </div>
    </div>
  );
}

// The first sentence, cut at a word after `max` characters.
function shortText(text: string, max: number) {
  const sentence = text.trim().match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text.trim();
  if (sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max / 2)).replace(/[,;:\s–-]+$/, "")} …`;
}
