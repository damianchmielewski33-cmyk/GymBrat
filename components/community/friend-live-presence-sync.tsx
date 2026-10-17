"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { buildGroupWorkoutPresence } from "@/lib/community/group-workout-presence";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { useCommunityWorkoutStore } from "@/lib/stores/community-workout";

/**
 * Publikuje sanitized presence dla znajomych z mutual share.
 * notifyStart=true tylko przy pierwszym ticku nowej sesji.
 */
export function FriendLivePresenceSync() {
  const { data: session, status } = useSession();
  const exercises = useActiveWorkoutStore((s) => s.exercises);
  const startedAt = useActiveWorkoutStore((s) => s.startedAt);
  const workoutStartedAtMs = useActiveWorkoutStore((s) => s.workoutStartedAtMs);
  const selectedExerciseId = useActiveWorkoutStore((s) => s.selectedExerciseId);
  const pausedElapsedSeconds = useActiveWorkoutStore(
    (s) => s.pausedElapsedSeconds,
  );
  const restRemaining = useCommunityWorkoutStore((s) => s.restRemaining);

  const notifiedSessionRef = useRef<number | null>(null);
  const lastPushRef = useRef(0);
  const wasActiveRef = useRef(false);

  const displayName =
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "Zawodnik";

  const hasSession =
    status === "authenticated" &&
    exercises.length > 0 &&
    workoutStartedAtMs != null;

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    const clearRemote = async () => {
      try {
        await ensureCsrfCookie();
        await fetch("/api/community/friends/live/presence", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            ...getXsrfHeaders(),
          },
          body: JSON.stringify({ active: false }),
        });
      } catch {
        /* ignore */
      }
    };

    if (!hasSession) {
      if (wasActiveRef.current) {
        wasActiveRef.current = false;
        notifiedSessionRef.current = null;
        void clearRemote();
      }
      return;
    }

    wasActiveRef.current = true;

    const push = async () => {
      const now = Date.now();
      if (now - lastPushRef.current < 500) return;
      lastPushRef.current = now;

      const state = useActiveWorkoutStore.getState();
      const presence = buildGroupWorkoutPresence({
        displayName,
        exercises: state.exercises,
        selectedExerciseId: state.selectedExerciseId,
        startedAt: state.startedAt,
        pausedElapsedSeconds: state.pausedElapsedSeconds,
        restRemaining: useCommunityWorkoutStore.getState().restRemaining,
      });

      const sessionKey = state.workoutStartedAtMs ?? now;
      const notifyStart = notifiedSessionRef.current !== sessionKey;
      if (notifyStart) notifiedSessionRef.current = sessionKey;

      try {
        await ensureCsrfCookie();
        await fetch("/api/community/friends/live/presence", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            ...getXsrfHeaders(),
          },
          body: JSON.stringify({
            active: true,
            presence,
            notifyStart,
            startedAtMs: state.workoutStartedAtMs,
          }),
        });
      } catch {
        /* keep trying */
      }
    };

    void push();
    const timer = window.setInterval(() => {
      if (!cancelled) void push();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    status,
    hasSession,
    displayName,
    exercises,
    startedAt,
    workoutStartedAtMs,
    selectedExerciseId,
    pausedElapsedSeconds,
    restRemaining,
  ]);

  return null;
}
