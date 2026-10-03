import type { WorkoutExerciseState } from "@/components/workout/types";
import type { ActiveCardioExtras } from "@/lib/stores/active-workout";

export type ActiveWorkoutCloudPayload = {
  startedAt: number | null;
  pausedElapsedSeconds: number;
  workoutStartedAtMs: number | null;
  title: string;
  workoutPlanId: string | null;
  cardioMinutes: number;
  cardioExtras?: ActiveCardioExtras;
  exercises: WorkoutExerciseState[];
  selectedExerciseId: string | null;
};

export type ActiveWorkoutCloudRecord = {
  payload: ActiveWorkoutCloudPayload;
  revision: number;
  deviceId: string;
  updatedAt: number;
};

export function isActiveWorkoutCloudPayload(
  raw: unknown,
): raw is ActiveWorkoutCloudPayload {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return (
    (o.startedAt === null || typeof o.startedAt === "number") &&
    typeof o.pausedElapsedSeconds === "number" &&
    (o.workoutStartedAtMs === null || typeof o.workoutStartedAtMs === "number") &&
    typeof o.title === "string" &&
    (o.workoutPlanId === null || typeof o.workoutPlanId === "string") &&
    typeof o.cardioMinutes === "number" &&
    Array.isArray(o.exercises) &&
    (o.selectedExerciseId === null || typeof o.selectedExerciseId === "string")
  );
}

/** Czy lokalny draft jest „aktywny” (warto syncować / wznawiać). */
export function hasActiveLocalSession(p: ActiveWorkoutCloudPayload): boolean {
  return Boolean(p.workoutPlanId && Array.isArray(p.exercises) && p.exercises.length > 0);
}

/**
 * Konflikt rewizji: klient nowszy → push; serwer nowszy → pull; równe → noop.
 */
export function resolveSessionRevisionConflict(input: {
  clientRevision: number;
  serverRevision: number;
}): "push" | "pull" | "noop" {
  if (input.clientRevision > input.serverRevision) return "push";
  if (input.clientRevision < input.serverRevision) return "pull";
  return "noop";
}
