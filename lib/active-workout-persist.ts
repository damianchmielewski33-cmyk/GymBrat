import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import type { ActiveWorkoutCloudPayload } from "@/lib/active-workout-cloud";

const STORAGE_KEY = "active-workout";
const PUSH_EVENT = "gymbrat:active-workout-push";

/** Snapshot pól sesji zapisywanych lokalnie i w chmurze. */
export function snapshotActiveWorkoutPayload(): ActiveWorkoutCloudPayload {
  const s = useActiveWorkoutStore.getState();
  return {
    startedAt: s.startedAt,
    pausedElapsedSeconds: s.pausedElapsedSeconds,
    workoutStartedAtMs: s.workoutStartedAtMs,
    title: s.title,
    workoutPlanId: s.workoutPlanId,
    cardioMinutes: s.cardioMinutes,
    cardioExtras: s.cardioExtras,
    exercises: s.exercises,
    selectedExerciseId: s.selectedExerciseId,
  };
}

/**
 * Natychmiastowy zapis do localStorage (sync) — niezależnie od kolejki persist middleware.
 * Ważne przy pagehide / przełączeniu aplikacji na telefonie.
 */
export function persistActiveWorkoutLocalNow(): void {
  if (typeof window === "undefined") return;
  try {
    const payload = snapshotActiveWorkoutPayload();
    const raw = localStorage.getItem(STORAGE_KEY);
    let version = 1;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { version?: number };
        if (typeof parsed.version === "number") version = parsed.version;
      } catch {
        /* keep default */
      }
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: payload,
        version,
      }),
    );
  } catch {
    /* private mode / quota */
  }
}

/** Prosi ActiveWorkoutCloudSync o natychmiastowy push (po flush draftu / zaliczeniu). */
export function requestActiveWorkoutCloudPush(immediate = false): void {
  if (typeof window === "undefined") return;
  persistActiveWorkoutLocalNow();
  window.dispatchEvent(
    new CustomEvent(PUSH_EVENT, { detail: { immediate: Boolean(immediate) } }),
  );
}

export function subscribeActiveWorkoutPushRequests(
  handler: (immediate: boolean) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const onEvent = (e: Event) => {
    const detail = (e as CustomEvent<{ immediate?: boolean }>).detail;
    handler(Boolean(detail?.immediate));
  };
  window.addEventListener(PUSH_EVENT, onEvent);
  return () => window.removeEventListener(PUSH_EVENT, onEvent);
}
