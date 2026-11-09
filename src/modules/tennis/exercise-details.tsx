import { Badge } from "@/components/ui/badge";
import { Court } from "./court";
import { hasVariations, phaseName, playersLabel, showsMidcourt, stageLabel, type Exercise, type Stage } from "./data";
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
        {exercise.tips.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Zum Zurufen</p>
            <ul className="flex flex-wrap gap-1.5">
              {exercise.tips.map((tip) => (
                <li key={tip} className="rounded-full bg-good px-2.5 py-0.5 text-sm text-good-foreground">
                  „{tip}“
                </li>
              ))}
            </ul>
          </div>
        )}
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
