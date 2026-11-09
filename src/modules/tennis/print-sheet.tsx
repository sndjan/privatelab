import { cn } from "@/lib/utils";
import { Court } from "./court";
import { formatClock, formatSessionDate, showsMidcourt, timeline, type Exercise, type Group, type Session, type Stage } from "./data";

type SheetProps = {
  title: string;
  subtitle: string;
  startTime: string;
  items: { exercise: Exercise; minutes: number; note?: string }[];
  notes: string;
  stage?: Stage | null;
};

// What a session's sheet shows: its group, date and time, and its exercises
// with the session's notes (exercises deleted since are left out).
export function sheetFor(session: Session, groups: Group[], exercises: Exercise[]): SheetProps {
  const group = groups.find((entry) => entry.id === session.groupId);
  const items = session.plan.flatMap((item) => {
    const exercise = exercises.find((entry) => entry.id === item.exerciseId);
    return exercise ? [{ exercise, minutes: item.minutes, note: item.note ?? "" }] : [];
  });
  const end = formatClock(timeline(session.startTime, session.plan).at(-1)?.end ?? 0);
  return {
    title: `${group?.name ?? "Training"} · Tennistraining`,
    subtitle: `${formatSessionDate(session.date)} · ${session.startTime}–${end}${session.focus ? ` · ${session.focus}` : ""}`,
    startTime: session.startTime,
    items,
    notes: session.notes,
    stage: group?.stage ?? null,
  };
}

// The session on one A5 page in black and white, kept short to take along:
// per exercise the time, name, the session's note, one short sentence and a
// short "leichter / schwerer", with a small upright sketch. Only printed;
// the page itself is hidden in print.
export function PrintSheet(props: SheetProps) {
  return (
    <div className="hidden print:block">
      {/* Only on this page: A5 with small margins. */}
      <style>{"@page { size: A5 portrait; margin: 7mm; }"}</style>
      <Sheet {...props} />
    </div>
  );
}

// Several sessions to save paper: two A5 sheets side by side on each A4
// landscape page, with a dashed line to cut along. Only printed.
export function PrintSheets({ sheets }: { sheets: (SheetProps & { key: string })[] }) {
  const pages = Array.from({ length: Math.ceil(sheets.length / 2) }, (_, index) => sheets.slice(index * 2, index * 2 + 2));
  return (
    <div className="hidden print:block">
      <style>{"@page { size: A4 landscape; margin: 0; }"}</style>
      {pages.map((page, index) => (
        // Slightly under 210 mm, so rounding never spills onto an empty page.
        <div key={index} className="flex h-[209mm] w-[297mm] overflow-hidden break-after-page last:break-after-auto">
          {page.map(({ key, ...sheet }, at) => (
            <div key={key} className={cn("h-full w-1/2 overflow-hidden p-[7mm]", at === 0 && "border-r border-dashed border-black/50")}>
              <Sheet {...sheet} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Sheet({
  title,
  subtitle,
  startTime,
  items,
  notes,
  stage = null,
}: SheetProps) {
  const ranges = timeline(startTime, items);

  return (
    <div className="text-[8pt] leading-tight text-black">
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
