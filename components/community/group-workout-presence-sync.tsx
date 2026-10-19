"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { buildGroupWorkoutPresence } from "@/lib/community/group-workout-presence";
import type { GroupWorkoutParticipantView } from "@/lib/community/group-workout-types";
import { CLIENT_POLL } from "@/lib/community/realtime-config";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { useCommunityWorkoutStore } from "@/lib/stores/community-workout";

/**
 * Push własnego presence + poll innych podczas treningu grupowego.
 * Interwał celowo wolniejszy (hosting) — nadal wystarczy do podglądu live.
 */
export function GroupWorkoutPresenceSync({
  onParticipants,
}: {
  onParticipants: (rows: GroupWorkoutParticipantView[]) => void;
}) {
  const { data: session } = useSession();
  const groupSessionId = useCommunityWorkoutStore((s) => s.groupSessionId);
  const mode = useCommunityWorkoutStore((s) => s.mode);
  const restRemaining = useCommunityWorkoutStore((s) => s.restRemaining);

  const exercises = useActiveWorkoutStore((s) => s.exercises);
  const selectedExerciseId = useActiveWorkoutStore((s) => s.selectedExerciseId);
  const startedAt = useActiveWorkoutStore((s) => s.startedAt);
  const pausedElapsedSeconds = useActiveWorkoutStore((s) => s.pausedElapsedSeconds);

  const displayName =
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "Zawodnik";

  const lastPushRef = useRef(0);

  useEffect(() => {
    if (mode !== "group" || !groupSessionId) return;

    let cancelled = false;

    const push = async () => {
      const now = Date.now();
      if (now - lastPushRef.current < 400) return;
      lastPushRef.current = now;

      const presence = buildGroupWorkoutPresence({
        displayName,
        exercises: useActiveWorkoutStore.getState().exercises,
        selectedExerciseId: useActiveWorkoutStore.getState().selectedExerciseId,
        startedAt: useActiveWorkoutStore.getState().startedAt,
        pausedElapsedSeconds:
          useActiveWorkoutStore.getState().pausedElapsedSeconds,
        restRemaining: useCommunityWorkoutStore.getState().restRemaining,
      });

      try {
        await ensureCsrfCookie();
        await fetch(
          `/api/community/group-workout/${groupSessionId}/presence`,
          {
            method: "PUT",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              ...getXsrfHeaders(),
            },
            body: JSON.stringify(presence),
          },
        );
      } catch {
        /* keep trying */
      }
    };

    const pull = async () => {
      try {
        const res = await fetch(
          `/api/community/group-workout/${groupSessionId}/presence`,
          { credentials: "same-origin", cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          participants?: GroupWorkoutParticipantView[];
        };
        if (data.participants) onParticipants(data.participants);
      } catch {
        /* ignore */
      }
    };

    void push();
    void pull();

    const onTick = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      void push();
      void pull();
    };
    const timer = setInterval(onTick, CLIENT_POLL.groupPresenceMs);
    const onVis = () => {
      if (document.visibilityState === "visible") onTick();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [
    mode,
    groupSessionId,
    displayName,
    exercises,
    selectedExerciseId,
    startedAt,
    pausedElapsedSeconds,
    restRemaining,
    onParticipants,
  ]);

  return null;
}
