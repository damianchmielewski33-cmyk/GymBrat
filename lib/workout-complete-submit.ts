import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import {
  mapWorkoutCompleteClientError,
  mapUnknownFetchError,
  UserMessages,
} from "@/lib/user-facing-errors";
import {
  isOutboxSupported,
  outboxEnqueue,
  type PendingWorkoutPayload,
} from "@/lib/workout-outbox-db";

export type CompleteWorkoutInput = PendingWorkoutPayload;

function isLikelyNetworkFailure(e: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (e instanceof TypeError) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /network|failed to fetch|load failed|aborted/i.test(msg);
}

export type SubmitWorkoutResult =
  | { status: "saved"; strengthDeltaPercent: number | null }
  | { status: "queued"; localId: string }
  | { status: "error"; message: string };

/**
 * Zapisuje trening na serwerze lub — przy braku sieci — w kolejce IndexedDB.
 */
export async function submitCompletedWorkout(
  body: CompleteWorkoutInput,
): Promise<SubmitWorkoutResult> {
  try {
    await ensureCsrfCookie();
    const res = await fetch("/api/workouts/complete", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...getXsrfHeaders(),
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      strengthDeltaPercent?: number | null;
    };
    if (!res.ok || !data.ok) {
      return {
        status: "error",
        message: mapWorkoutCompleteClientError(res.status, data.error),
      };
    }
    const strengthDeltaPercent =
      typeof data.strengthDeltaPercent === "number" && Number.isFinite(data.strengthDeltaPercent)
        ? data.strengthDeltaPercent
        : null;
    return { status: "saved", strengthDeltaPercent };
  } catch (e) {
    if (isLikelyNetworkFailure(e) && isOutboxSupported()) {
      try {
        const localId = await outboxEnqueue(body);
        return { status: "queued", localId };
      } catch {
        /* fall through */
      }
    }
    return {
      status: "error",
      message: mapUnknownFetchError(e, UserMessages.workoutSaveUnknown),
    };
  }
}
