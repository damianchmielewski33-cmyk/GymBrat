"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import {
  buildGroupWorkoutPresence,
  computeSessionProgress,
  findActiveSet,
} from "@/lib/community/group-workout-presence";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { useCommunityWorkoutStore } from "@/lib/stores/community-workout";

/**
 * Live dla znajomych — tylko przy zdarzeniach treningu:
 * start, zmiana ćwiczenia, zaliczenie/pominięcie serii, start/koniec przerwy, koniec.
 * Bez okresowego ticka (oszczędność hostingu).
 */
export function FriendLivePresenceSync() {
  const { data: session, status } = useSession();
  const exercises = useActiveWorkoutStore((s) => s.exercises);
  const workoutStartedAtMs = useActiveWorkoutStore((s) => s.workoutStartedAtMs);
  const selectedExerciseId = useActiveWorkoutStore((s) => s.selectedExerciseId);
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

  /** Tylko faza przerwy (tak/nie), nie każda sekunda countdownu. */
  const onRest = restRemaining != null && restRemaining > 0;

  const eventFingerprint = useMemo(() => {
    if (!hasSession || workoutStartedAtMs == null) return null;
    const { exercise, setIndex, set } = findActiveSet(
      exercises,
      selectedExerciseId,
    );
    const progress = computeSessionProgress(exercises);
    return [
      workoutStartedAtMs,
      exercise?.id ?? "",
      selectedExerciseId ?? "",
      setIndex,
      progress.done,
      progress.total,
      onRest ? "rest" : "work",
      set?.reps ?? "",
      set?.weight ?? "",
      set?.done ? "1" : "0",
      set?.skipped ? "1" : "0",
    ].join("|");
  }, [
    hasSession,
    workoutStartedAtMs,
    exercises,
    selectedExerciseId,
    onRest,
  ]);

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

    if (!hasSession || !eventFingerprint) {
      if (wasActiveRef.current) {
        wasActiveRef.current = false;
        notifiedSessionRef.current = null;
        void clearRemote();
      }
      return;
    }

    wasActiveRef.current = true;

    const push = async () => {
      if (cancelled) return;
      const now = Date.now();
      if (now - lastPushRef.current < 400) return;
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
        /* ignore */
      }
    };

    void push();

    return () => {
      cancelled = true;
    };
  }, [status, hasSession, eventFingerprint, displayName]);

  return null;
}
