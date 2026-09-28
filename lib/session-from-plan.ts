import type { WorkoutExerciseState } from "@/components/workout/types";
import type { WorkoutPlanExercise } from "@/lib/workout-plan-types";

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Domyślnie 3 serie: puste powtórzenia (null); z planu można wypełnić przy starcie. */
export function planExercisesToSession(exercises: WorkoutPlanExercise[]): WorkoutExerciseState[] {
  return exercises.map((ex) => ({
    id: ex.id,
    name: ex.name,
    targetReps:
      typeof ex.reps === "number" && Number.isFinite(ex.reps) && ex.reps > 0
        ? clampInt(ex.reps, 1, 99)
        : 10,
    sets: Array.from({ length: 3 }, () => ({
      reps:
        typeof ex.reps === "number" && Number.isFinite(ex.reps) && ex.reps > 0
          ? clampInt(ex.reps, 1, 99)
          : null,
      weight: 0,
      done: false,
      rpe: null,
    })),
  }));
}
