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

/** Sesja starsza niż to nie wraca jako „aktywna” (ghost po nieudanym DELETE). */
export const ACTIVE_WORKOUT_CLOUD_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Czy lokalny draft jest „aktywny” (warto syncować / wznawiać). */
export function hasActiveLocalSession(p: ActiveWorkoutCloudPayload): boolean {
  return Boolean(
    p.workoutPlanId &&
      Array.isArray(p.exercises) &&
      p.exercises.length > 0 &&
      (p.workoutStartedAtMs != null || p.startedAt != null),
  );
}

export function isActiveWorkoutCloudFresh(
  updatedAt: number,
  now = Date.now(),
  maxAgeMs = ACTIVE_WORKOUT_CLOUD_MAX_AGE_MS,
): boolean {
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return false;
  return now - updatedAt <= maxAgeMs;
}

export type CloudHydrateAction =
  | "noop"
  | "apply"
  | "apply-other-device"
  | "delete-cloud";

/**
 * Decyzja przy starcie aplikacji: kiedy wznawiać chmurę, a kiedy czyścić ducha
 * po zakończonym treningu (puste lokalnie + ta sama maszyna).
 */
export function decideCloudHydrateAction(input: {
  localActive: boolean;
  cloudActive: boolean;
  cloudDeviceId: string;
  localDeviceId: string;
  localRevision: number;
  cloudRevision: number;
  cloudUpdatedAt: number;
  now?: number;
  maxAgeMs?: number;
}): CloudHydrateAction {
  if (!input.cloudActive) return "noop";
  if (
    !isActiveWorkoutCloudFresh(
      input.cloudUpdatedAt,
      input.now ?? Date.now(),
      input.maxAgeMs,
    )
  ) {
    return "delete-cloud";
  }

  const localEmpty = !input.localActive;
  const cloudNewer = input.cloudRevision > input.localRevision;
  const otherDevice =
    Boolean(input.localDeviceId) &&
    Boolean(input.cloudDeviceId) &&
    input.cloudDeviceId !== input.localDeviceId;

  if (localEmpty) {
    // Po zapisie/odrzuceniu lokal jest puste — ta sama maszyna nie powinna
    // wskrzeszać sesji (częsty ghost gdy DELETE nie doszedł).
    if (!otherDevice) return "delete-cloud";
    return "apply-other-device";
  }

  if (!cloudNewer) return "noop";
  return otherDevice ? "apply-other-device" : "apply";
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
