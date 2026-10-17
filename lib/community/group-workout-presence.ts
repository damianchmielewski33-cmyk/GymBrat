import type { WorkoutExerciseState } from "@/components/workout/types";
import type {
  GroupWorkoutPhase,
  GroupWorkoutPresence,
} from "@/lib/community/group-workout-types";

export function computeSessionProgress(exercises: WorkoutExerciseState[]): {
  done: number;
  total: number;
  percent: number;
} {
  let done = 0;
  let total = 0;
  for (const ex of exercises) {
    for (const set of ex.sets) {
      total += 1;
      if (set.done || set.skipped) done += 1;
    }
  }
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

export function findActiveSet(
  exercises: WorkoutExerciseState[],
  selectedExerciseId: string | null,
): {
  exercise: WorkoutExerciseState | null;
  setIndex: number;
  set: WorkoutExerciseState["sets"][number] | null;
} {
  const preferred =
    exercises.find((e) => e.id === selectedExerciseId) ?? exercises[0] ?? null;
  if (!preferred) {
    return { exercise: null, setIndex: 0, set: null };
  }
  const openIdx = preferred.sets.findIndex((s) => !s.done && !s.skipped);
  const setIndex = openIdx >= 0 ? openIdx : Math.max(0, preferred.sets.length - 1);
  return {
    exercise: preferred,
    setIndex,
    set: preferred.sets[setIndex] ?? null,
  };
}

export function buildGroupWorkoutPresence(input: {
  displayName: string;
  exercises: WorkoutExerciseState[];
  selectedExerciseId: string | null;
  startedAt: number | null;
  pausedElapsedSeconds: number;
  restRemaining: number | null;
}): GroupWorkoutPresence {
  const { exercise, setIndex, set } = findActiveSet(
    input.exercises,
    input.selectedExerciseId,
  );
  const progress = computeSessionProgress(input.exercises);
  const elapsed =
    input.pausedElapsedSeconds +
    (input.startedAt != null
      ? Math.max(0, Math.floor((Date.now() - input.startedAt) / 1000))
      : 0);

  let phase: GroupWorkoutPhase = "working";
  if (progress.total > 0 && progress.done >= progress.total) phase = "done";
  else if (input.restRemaining != null && input.restRemaining > 0) phase = "rest";

  return {
    displayName: input.displayName,
    exerciseName: exercise?.name ?? "—",
    exerciseId: exercise?.id ?? null,
    setIndex: setIndex + 1,
    setTotal: exercise?.sets.length ?? 1,
    reps: set?.reps ?? null,
    weight: set?.weight ?? 0,
    elapsedSeconds: elapsed,
    restRemaining:
      input.restRemaining != null && input.restRemaining > 0
        ? input.restRemaining
        : null,
    progressPercent: progress.percent,
    phase,
  };
}
