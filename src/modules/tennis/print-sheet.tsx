import { Court } from "./court";
import { formatClock, phaseName, timeline, type Exercise, type Player } from "./data";

// The session on one A5 page in black and white: per exercise the time, name,
// one sentence and the cues to call out, with a small sketch. Only printed;
// the page itself is hidden in print.
export function PrintSheet({
  title,
  subtitle,
  startTime,
  items,
  players,
  absent,
  notes,
}: {
  title: string;
  subtitle: string;
  startTime: string;
  items: { exercise: Exercise; minutes: number }[];
  players: Player[];
  absent: string[];
  notes: string;
}) {
  const ranges = timeline(startTime, items);
  const present = players.filter((player) => !absent.includes(player.id));

  return (
    <div className="hidden text-[9pt] leading-snug text-black print:block">
      {/* Only on this page: A5 with small margins. */}
      <style>{"@page { size: A5 portrait; margin: 8mm; }"}</style>
      <header className="mb-2 flex items-baseline justify-between gap-3 border-b-2 border-black pb-1">
        <h1 className="text-[12pt] font-bold">{title}</h1>
        <p className="text-right">{subtitle}</p>
      </header>
      {players.length > 0 && (
        <p className="mb-2">
          <span className="font-semibold">Da ({present.length}):</span> {present.map((player) => player.name).join(", ")}
          {absent.length > 0 && (
            <span>
              {" "}
              · <span className="font-semibold">Fehlt:</span>{" "}
              {players
                .filter((player) => absent.includes(player.id))
                .map((player) => player.name)
                .join(", ")}
            </span>
          )}
        </p>
      )}
      <ol>
        {items.map(({ exercise, minutes }, index) => (
          <li key={index} className="flex break-inside-avoid gap-2 border-b border-black/40 py-1.5">
            <div className="w-11 shrink-0 font-mono">
              <div className="font-bold">{formatClock(ranges[index].start)}</div>
              <div>{minutes}′</div>
            </div>
            <div className="min-w-0 flex-1">
              <p>
                <span className="font-bold">{exercise.name}</span> <span>· {phaseName(exercise.phase)}</span>
              </p>
              {exercise.summary && <p>{exercise.summary}</p>}
              {exercise.tips.length > 0 && <p className="italic">„{exercise.tips.join("“ · „")}“</p>}
              {exercise.variations.easier && <p>Leichter: {exercise.variations.easier}</p>}
              {exercise.variations.harder && <p>Schwerer: {exercise.variations.harder}</p>}
            </div>
            {exercise.diagram.items.length > 0 && <Court diagram={exercise.diagram} mono horizontal className="h-[22mm] w-auto shrink-0" />}
          </li>
        ))}
      </ol>
      <div className="mt-2 break-inside-avoid">
        <p className="font-semibold">Notizen</p>
        {notes && <p className="whitespace-pre-line">{notes}</p>}
        <div className="mt-1 h-5 border-b border-black/60" />
        <div className="h-5 border-b border-black/60" />
      </div>
    </div>
  );
}
