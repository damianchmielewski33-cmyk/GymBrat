import type { WorkoutExerciseState } from "@/components/workout/types";

export type SkippedWorkoutTarget = {
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
};

/** Seria zaliczona bez realnego wykonania (pomiń / pusty ciężar lub powtórzenia). */
export function isSkippedWorkoutSet(set: {
  done: boolean;
  skipped?: boolean;
  reps: number | null;
  weight: number;
}): boolean {
  if (!set.done) return false;
  if (set.skipped) return true;
  const repsOk = set.reps != null && Number.isFinite(set.reps) && set.reps > 0;
  const weightOk = Number.isFinite(set.weight) && set.weight > 0;
  return !repsOk || !weightOk;
}

/** Prawdziwie wykonana seria (zielona kropka) — nie pominięta, z ciężarem i powtórzeniami. */
export function isCompletedWorkoutSet(set: {
  done: boolean;
  skipped?: boolean;
  reps: number | null;
  weight: number;
}): boolean {
  return set.done && !isSkippedWorkoutSet(set);
}

/** Czy dane wystarczą do zielonego zaliczenia (nie pominięcia). */
export function canCompleteWorkoutSet(weight: number, reps: number | null): boolean {
  return (
    Number.isFinite(weight) &&
    weight > 0 &&
    reps != null &&
    Number.isFinite(reps) &&
    reps > 0
  );
}

/**
 * Pierwsza pominięta seria albo pierwsze niedokończone ćwiczenie —
 * do powrotu z dialogu „wszystkie serie”.
 */
export function findFirstSkippedWorkoutTarget(
  exercises: WorkoutExerciseState[],
): SkippedWorkoutTarget | null {
  for (const ex of exercises) {
    for (let i = 0; i < ex.sets.length; i++) {
      const s = ex.sets[i]!;
      if (isSkippedWorkoutSet(s)) {
        return {
          exerciseId: ex.id,
          exerciseName: ex.name,
          setIndex: i,
        };
      }
    }
  }
  for (const ex of exercises) {
    const setIndex = ex.sets.findIndex((s) => !s.done);
    if (setIndex >= 0) {
      return {
        exerciseId: ex.id,
        exerciseName: ex.name,
        setIndex,
      };
    }
  }
  return null;
}

export function countSkippedWorkoutSets(exercises: WorkoutExerciseState[]): number {
  let n = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (isSkippedWorkoutSet(s)) n += 1;
    }
  }
  return n;
}
