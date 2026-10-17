"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { useCommunityWorkoutStore } from "@/lib/stores/community-workout";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";

export function JoinGroupWorkoutButton({
  sessionId,
  label = "Dołącz do treningu",
}: {
  sessionId: string;
  label?: string;
}) {
  const router = useRouter();
  const { notifyError, notifySaved } = useSaveFeedback();
  const [pending, setPending] = useState(false);

  async function onJoin() {
    setPending(true);
    try {
      await ensureCsrfCookie();
      const res = await fetch(
        `/api/community/group-workout/${sessionId}/join`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: getXsrfHeaders(),
        },
      );
      const data = (await res.json()) as {
        ok?: boolean;
        sessionId?: string;
        teamId?: string;
        teamName?: string;
        error?: string;
      };
      if (!res.ok || !data.sessionId || !data.teamId) {
        notifyError(data.error || "Nie udało się dołączyć.");
        return;
      }
      useCommunityWorkoutStore.getState().setGroupSession({
        sessionId: data.sessionId,
        teamId: data.teamId,
        teamName: data.teamName ?? "Grupa",
      });
      notifySaved("Dołączono do treningu grupowego");

      const active = useActiveWorkoutStore.getState();
      if (active.exercises.length > 0 && active.workoutStartedAtMs != null) {
        router.push("/active-workout");
      } else {
        router.push("/workout-plan");
      }
    } catch {
      notifyError("Nie udało się dołączyć do treningu.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="cta"
      disabled={pending}
      onClick={() => {
        void onJoin();
      }}
    >
      {pending ? "Dołączanie…" : label}
    </Button>
  );
}
