import type { WorkoutPlanExercise, WorkoutPlanPayload } from "@/lib/workout-plan-types";

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ex-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Domyślne wartości nowego ćwiczenia w planie (AC-4.4). */
export function createDefaultPlanExercise(
  partial: Pick<WorkoutPlanExercise, "name" | "categoryId"> &
    Partial<WorkoutPlanExercise>,
): WorkoutPlanExercise {
  return {
    id: partial.id ?? newId(),
    name: partial.name,
    categoryId: partial.categoryId,
    sets: partial.sets && partial.sets > 0 ? partial.sets : 3,
    reps: partial.reps && partial.reps > 0 ? partial.reps : 10,
    rir: partial.rir === undefined ? 1 : partial.rir,
    tempo: partial.tempo ?? null,
    note: partial.note ?? null,
    techniqueYoutubeUrl: partial.techniqueYoutubeUrl ?? null,
    supersetGroupId: partial.supersetGroupId ?? null,
  };
}

export function createEmptyWorkoutPlan(planName = ""): WorkoutPlanPayload {
  return {
    version: 2,
    path: "custom",
    planName,
    exercises: [],
    userCustomExerciseNames: [],
  };
}

export function planSetCount(ex: { sets?: number | null }): number {
  return typeof ex.sets === "number" && ex.sets > 0 ? ex.sets : 3;
}
