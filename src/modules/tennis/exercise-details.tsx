import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Court } from "./court";
import { hasVariations, phaseName, playersLabel, showsMidcourt, stageLabel, type Exercise, type Stage } from "./data";
import { findTeilziel } from "./teilziele";
import { VariationList } from "./variations";

// Everything about an exercise: badges, sketch, how it works, cues and
// variations. Shown on the exercise page and in the planner's detail dialog.
// `groupStage` decides whether the sketch shows the midcourt line; the notes
// are only shown where they can't be edited.
export function ExerciseDetails({
  exercise,
  groupStage,
  showNotes = false,
}: {
  exercise: Exercise;
  groupStage?: Stage | null;
  showNotes?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{phaseName(exercise.phase)}</Badge>
        <Badge variant="secondary">{exercise.minutes} Min.</Badge>
        {playersLabel(exercise) && <Badge variant="secondary">{playersLabel(exercise)}</Badge>}
        {exercise.stages.map((stage) => (
          <Badge key={stage} variant="secondary">
            {stageLabel(stage)}
          </Badge>
        ))}
        {exercise.focus.map((tag) => (
          <Badge key={tag} variant="outline">
            {tag}
          </Badge>
        ))}
      </div>

      <Court diagram={exercise.diagram} horizontal midcourt={showsMidcourt(exercise, groupStage)} className="w-full" />
      <div className="space-y-3">
        {exercise.summary && <p className="font-medium">{exercise.summary}</p>}
        {exercise.description && <p className="text-sm whitespace-pre-line">{exercise.description}</p>}
        {exercise.teilziel && <TeilzielBox teilziel={exercise.teilziel} />}
        {hasVariations(exercise.variations) && (
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Variationen</p>
            <VariationList variations={exercise.variations} />
          </div>
        )}
        {showNotes && exercise.notes && (
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Notizen</p>
            <p className="text-sm whitespace-pre-line">{exercise.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// The Teilziel with how to say it and what helps when it doesn't work (from
// the catalog, for the ones in it).
export function TeilzielBox({ teilziel, className }: { teilziel: string; className?: string }) {
  const known = findTeilziel(teilziel);
  return (
    <div className={cn("space-y-1 rounded-lg bg-good px-3 py-2 text-good-foreground", className)}>
      <p className="text-xs font-medium tracking-wide uppercase opacity-75">Teilziel</p>
      <p className="font-semibold">{teilziel}</p>
      {known && (
        <>
          <p className="text-sm">
            <span className="opacity-75">So sagst du’s: </span>„{known.say}“
          </p>
          {known.fix && (
            <p className="text-sm">
              <span className="opacity-75">Wenn’s nicht klappt: </span>
              {known.fix}
            </p>
          )}
        </>
      )}
    </div>
  );
}
