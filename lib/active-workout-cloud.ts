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
  /**
   * Tylko na payloadzie WYGASZONYM (005, N-P13-1): `workoutStartedAtMs` sesji, która była
   * aktywna w momencie wygaszenia (DELETE/ghost-GET, p.12-13). `null`, gdy wygaszano wiersz
   * pusty/nieparsowalny — nie ma czyjej tożsamości do zapisania. Nieobecne na prawdziwym
   * payloadzie aktywnej sesji (`hasActiveLocalSession` go nie czyta).
   */
  clearedSessionStartedAtMs?: number | null;
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
    (o.selectedExerciseId === null || typeof o.selectedExerciseId === "string") &&
    (o.clearedSessionStartedAtMs === undefined ||
      o.clearedSessionStartedAtMs === null ||
      typeof o.clearedSessionStartedAtMs === "number")
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

/**
 * Payload „wygaszonej” sesji (005, B-1b/p.12) — budowany przy każdym wygaszeniu z
 * tożsamością sesji, którą wygaszono (N-P13-1, p.14). `hasActiveLocalSession` dla tego
 * payloadu zawsze zwraca false, więc GET nigdy go nie wznowi jako aktywną sesję.
 */
export function buildActiveWorkoutClearedPayload(
  clearedSessionStartedAtMs: number | null,
): ActiveWorkoutCloudPayload {
  return {
    startedAt: null,
    pausedElapsedSeconds: 0,
    workoutStartedAtMs: null,
    title: "",
    workoutPlanId: null,
    cardioMinutes: 0,
    exercises: [],
    selectedExerciseId: null,
    clearedSessionStartedAtMs,
  };
}

/**
 * Tożsamość do zapisania w NOWYM tombstonie przy wygaszaniu wiersza — zależnie od tego,
 * co jest w wierszu AKTUALNIE (005, naprawa N-P13-6, ADR 0004 p.15). Jedno miejsce prawdy
 * dla `handleDELETE` i `handleGET`-ghost w `app/api/active-workout-session/route.ts`, żeby
 * nie liczyć tej decyzji w dwóch miejscach z dwoma różnymi (jedną błędną) interpretacjami.
 *
 * Kluczowe: gdy `payload` jest JUŻ tombstone'em (`hasActiveLocalSession` false), jego
 * `workoutStartedAtMs` jest zawsze `null` (`buildActiveWorkoutClearedPayload`) — tożsamość
 * żyje w `clearedSessionStartedAtMs`, nie w `workoutStartedAtMs`. Odczytanie `workoutStartedAtMs`
 * z tombstone'u i zapisanie go jako tożsamość NOWEGO tombstone'u (poprzedni błąd) kasuje
 * tożsamość przy każdym idempotentnym wygaszeniu tego samego, już-pustego wiersza — to
 * otwierało okno na wskrzeszenie zakończonej sesji przez zaległe, trzecie urządzenie.
 */
export function resolveClearedSessionIdentity(
  payload: ActiveWorkoutCloudPayload | null,
): number | null {
  if (!payload) return null;
  if (hasActiveLocalSession(payload)) return payload.workoutStartedAtMs ?? null;
  return payload.clearedSessionStartedAtMs ?? null;
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
