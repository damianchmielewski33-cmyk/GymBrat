/**
 * Model postępu sesji (ADR 0003, D2): jeden wynik dla paska, pigułek, listy ćwiczeń
 * i nagłówka „seria X/Y”. Stany wyłącznie z `isCompletedWorkoutSet` / `isSkippedWorkoutSet`.
 */

import type { WorkoutExerciseState } from "@/components/workout/types";
import {
  isCompletedWorkoutSet,
  isSkippedWorkoutSet,
} from "@/lib/workout-skipped-sets";

export type SetSegmentState = "saved" | "skipped" | "current" | "todo";

export type SessionProgressSegment = {
  exerciseId: string;
  setIndex: number;
  /** "current" tylko dla bieżącej niezapisanej; bieżąca zapisana = "saved" + isCurrent. */
  state: SetSegmentState;
  isCurrent: boolean;
};

export type SessionProgressGroup = {
  exerciseId: string;
  /** 0-based */
  exerciseIndex: number;
  segments: SessionProgressSegment[];
  /** BR-3: wszystkie serie zapisane, żadna pominięta. */
  completed: boolean;
  /** Wszystkie serie done (zapisane lub pominięte). */
  finished: boolean;
};

export type SessionProgress = {
  groups: SessionProgressGroup[];
  /** isCompletedWorkoutSet (P-5) */
  savedSets: number;
  /** isSkippedWorkoutSet */
  skippedSets: number;
  totalSets: number;
  /** groups.filter(completed) */
  exercisesCompleted: number;
  exercisesTotal: number;
  /** 1-based numer bieżącej serii w całej sesji (BR-4); null gdy brak bieżącej. */
  currentOrdinal: number | null;
};

/** BR-3: ćwiczenie ma serie, wszystkie zapisane, żadna pominięta. */
export function isExerciseCompleted(exercise: WorkoutExerciseState): boolean {
  return (
    exercise.sets.length > 0 && exercise.sets.every((s) => isCompletedWorkoutSet(s))
  );
}

export function buildSessionProgress(
  exercises: WorkoutExerciseState[],
  current: { exerciseId: string; setIndex: number } | null,
): SessionProgress {
  const groups: SessionProgressGroup[] = [];
  let savedSets = 0;
  let skippedSets = 0;
  let totalSets = 0;
  let exercisesCompleted = 0;
  let currentOrdinal: number | null = null;

  exercises.forEach((ex, exerciseIndex) => {
    const segments: SessionProgressSegment[] = [];
    let groupDone = 0;

    ex.sets.forEach((s, setIndex) => {
      totalSets += 1;
      const isCurrent =
        current != null &&
        current.exerciseId === ex.id &&
        current.setIndex === setIndex;
      if (isCurrent) currentOrdinal = totalSets;

      let state: SetSegmentState;
      if (isCompletedWorkoutSet(s)) {
        state = "saved";
        savedSets += 1;
      } else if (isSkippedWorkoutSet(s)) {
        state = "skipped";
        skippedSets += 1;
      } else {
        state = isCurrent ? "current" : "todo";
      }
      if (s.done) groupDone += 1;

      segments.push({ exerciseId: ex.id, setIndex, state, isCurrent });
    });

    const setCount = ex.sets.length;
    const completed = isExerciseCompleted(ex);
    if (completed) exercisesCompleted += 1;
    groups.push({
      exerciseId: ex.id,
      exerciseIndex,
      segments,
      completed,
      finished: setCount > 0 && groupDone === setCount,
    });
  });

  return {
    groups,
    savedSets,
    skippedSets,
    totalSets,
    exercisesCompleted,
    exercisesTotal: exercises.length,
    currentOrdinal,
  };
}

/**
 * Serie z done=true (zapisane i pominięte) oraz wszystkie serie.
 * `total > 0 && done >= total` = cała sesja domknięta (decyzja o końcu treningu).
 */
export function countSetsDone(exercises: WorkoutExerciseState[]): {
  done: number;
  total: number;
} {
  let done = 0;
  let total = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      total += 1;
      if (s.done) done += 1;
    }
  }
  return { done, total };
}
