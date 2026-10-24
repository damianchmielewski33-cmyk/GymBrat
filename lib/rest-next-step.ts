/**
 * Model ekranu przerwy (ADR 0003, 4.5): zapisana seria i „Następnie”.
 * Cel następnego kroku z `resolveAdvanceAfterSet`, sugestia z `buildSetSuggestionView`
 * dla ćwiczenia docelowego — identyczna z tą na następnym ekranie serii.
 */

import type {
  WorkoutExerciseState,
  WorkoutSetState,
} from "@/components/workout/types";
import {
  buildSetSuggestionView,
  type SetSuggestionView,
} from "@/lib/set-suggestion-view";
import { isExerciseCompleted } from "@/lib/workout-session-progress";
import {
  isCompletedWorkoutSet,
  resolveAdvanceAfterSet,
} from "@/lib/workout-skipped-sets";

export type RestNextStep = {
  /** Ta sama vs następne ćwiczenie -> „Zacznij serię N” / „Zacznij ćwiczenie N”. */
  kind: "set" | "exercise";
  exerciseId: string;
  exerciseName: string;
  /** 1-based */
  exerciseOrdinal: number;
  setIndex: number;
  /** 1-based */
  setOrdinal: number;
  setsInExercise: number;
  targetReps: number | null;
  targetRir: number | null;
  /** buildSetSuggestionView(nextEx, setIndex) */
  suggestion: SetSuggestionView | null;
  lastSessionSet: WorkoutSetState | null;
};

export type RestCompletedSet = {
  weightKg: number;
  reps: number;
  rir: number | null;
  /** BR-3 dla ćwiczenia zapisanej serii; steruje „ćwiczenie ✓”. */
  exerciseCompleted: boolean;
};

/** null = koniec treningu (brak celu z resolveAdvanceAfterSet). */
export function buildRestNextStep(
  exercises: WorkoutExerciseState[],
  completed: { exerciseId: string; setIndex: number },
): RestNextStep | null {
  const target = resolveAdvanceAfterSet(
    exercises,
    completed.exerciseId,
    completed.setIndex,
  );
  if (!target) return null;
  const exerciseIndex = exercises.findIndex((e) => e.id === target.exerciseId);
  if (exerciseIndex < 0) return null;
  const nextEx = exercises[exerciseIndex]!;

  return {
    kind: target.exerciseId === completed.exerciseId ? "set" : "exercise",
    exerciseId: nextEx.id,
    exerciseName: nextEx.name,
    exerciseOrdinal: exerciseIndex + 1,
    setIndex: target.setIndex,
    setOrdinal: target.setIndex + 1,
    setsInExercise: nextEx.sets.length,
    targetReps:
      nextEx.targetReps != null && nextEx.targetReps > 0
        ? nextEx.targetReps
        : null,
    targetRir: nextEx.targetRir ?? null,
    suggestion: buildSetSuggestionView(nextEx, target.setIndex),
    lastSessionSet: nextEx.lastSessionSets?.[target.setIndex] ?? null,
  };
}

/**
 * Karta „Zapisano” na przerwie. null, gdy seria nie istnieje albo nie jest
 * zapisana (`isCompletedWorkoutSet`), np. po pominięciu.
 */
export function buildRestCompletedSet(
  exercises: WorkoutExerciseState[],
  completed: { exerciseId: string; setIndex: number },
): RestCompletedSet | null {
  const ex = exercises.find((e) => e.id === completed.exerciseId);
  const set = ex?.sets[completed.setIndex];
  if (!ex || !set || !isCompletedWorkoutSet(set)) return null;
  return {
    weightKg: set.weight,
    reps: set.reps!,
    rir: set.rir ?? null,
    exerciseCompleted: isExerciseCompleted(ex),
  };
}
