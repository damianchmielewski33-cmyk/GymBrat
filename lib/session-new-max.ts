import type { WorkoutExerciseState } from "@/components/workout/types";
import { estimated1RM } from "@/lib/workout-history";
import type { LastPlanHintsMap } from "@/lib/last-workout-hints";

export type NewMaxHit = {
  exerciseName: string;
  kind: "e1rm" | "weight";
  value: number;
};

/** Porównuje ukończoną sesję z podpowiedziami z poprzedniej — wykrywa NOWY MAX. */
export function detectSessionNewMaxes(
  exercises: WorkoutExerciseState[],
  hints: LastPlanHintsMap,
): NewMaxHit[] {
  const hits: NewMaxHit[] = [];
  for (const ex of exercises) {
    let bestE1rm = 0;
    let bestWeight = 0;
    for (const s of ex.sets) {
      if (!s.done || s.reps == null || s.reps <= 0 || s.weight <= 0) continue;
      bestWeight = Math.max(bestWeight, s.weight);
      bestE1rm = Math.max(bestE1rm, estimated1RM(s.weight, s.reps));
    }
    if (bestWeight <= 0) continue;
    const prev = hints[ex.id]?.sets ?? [];
    let prevE1rm = 0;
    let prevWeight = 0;
    for (const s of prev) {
      if (s.reps == null || s.reps <= 0 || s.weight <= 0) continue;
      prevWeight = Math.max(prevWeight, s.weight);
      prevE1rm = Math.max(prevE1rm, estimated1RM(s.weight, s.reps));
    }
    if (prev.length === 0) continue;
    if (bestE1rm > prevE1rm + 0.05) {
      hits.push({
        exerciseName: ex.name,
        kind: "e1rm",
        value: Math.round(bestE1rm * 10) / 10,
      });
    } else if (bestWeight > prevWeight + 0.05) {
      hits.push({
        exerciseName: ex.name,
        kind: "weight",
        value: Math.round(bestWeight * 10) / 10,
      });
    }
  }
  return hits;
}
