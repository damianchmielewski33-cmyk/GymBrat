"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import type { TreningiHubData } from "@/lib/treningi-hub-data";
import type { TreningiHubStats } from "@/lib/treningi-hub-stats";
import { TreningiHub } from "@/components/treningi/treningi-hub";
import { StartWorkoutModeSheet } from "@/components/community/start-workout-mode-sheet";
import { beginWorkoutFromPlanRow } from "@/lib/start-workout-session";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { useCommunityWorkoutStore } from "@/lib/stores/community-workout";
import type { GroupTeamOption } from "@/lib/community/group-workout-types";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { useVisibilityInterval } from "@/hooks/use-visibility-interval";
import { calendarDateKey } from "@/lib/local-date";

/** Co ile sprawdzamy, czy w przeglądarce zaczął się nowy dzień (AC-1.3). */
const DAY_CHANGE_CHECK_MS = 60_000;

export function TreningiHubClient({
  hub,
  stats,
  teams,
}: {
  hub: TreningiHubData;
  stats: TreningiHubStats;
  teams: GroupTeamOption[];
}) {
  const router = useRouter();
  const { notifyError } = useSaveFeedback();
  const [modeOpen, setModeOpen] = useState(false);
  const [pendingRow, setPendingRow] =
    useState<WorkoutPlanWithLastWorkoutDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const refreshedForDay = useRef<string | null>(null);

  // Jeden „dziś” liczy serwer; po zmianie dnia odświeżamy RSC najwyżej raz
  // na wartość todayKey (rozjazd stref serwer/klient nie da pętli, ADR 0002 D3).
  useVisibilityInterval(
    () => {
      const serverDay = hub.week.todayKey;
      if (refreshedForDay.current === serverDay) return;
      if (calendarDateKey() === serverDay) return;
      refreshedForDay.current = serverDay;
      router.refresh();
    },
    DAY_CHANGE_CHECK_MS,
    true,
  );

  const launchSolo = useCallback(
    (row: WorkoutPlanWithLastWorkoutDTO) => {
      useCommunityWorkoutStore.getState().setSolo();
      if (!beginWorkoutFromPlanRow(useActiveWorkoutStore.getState(), row)) {
        setPendingRow(null);
        return;
      }
      router.push("/active-workout");
    },
    [router],
  );

  const onBegin = useCallback((row: WorkoutPlanWithLastWorkoutDTO) => {
    setPendingRow(row);
    setModeOpen(true);
  }, []);

  const onSolo = useCallback(() => {
    if (!pendingRow) return;
    setModeOpen(false);
    // pendingRow zostaje do nawigacji: cele startu pozostają nieaktywne (AC-3.9).
    launchSolo(pendingRow);
  }, [pendingRow, launchSolo]);

  const onGroup = useCallback(
    async (teamId: string) => {
      if (!pendingRow) return;
      setLoading(true);
      try {
        await ensureCsrfCookie();
        const res = await fetch("/api/community/group-workout", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            ...getXsrfHeaders(),
          },
          body: JSON.stringify({ teamId, title: pendingRow.plan.planName }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          sessionId?: string;
          error?: string;
        };
        if (!res.ok || !data.sessionId) {
          notifyError(
            data.error ||
              "Nie udało się utworzyć sesji grupowej. Spróbuj ponownie albo zacznij solo.",
          );
          return;
        }
        const team = teams.find((t) => t.id === teamId);
        useCommunityWorkoutStore.getState().setGroupSession({
          sessionId: data.sessionId,
          teamId,
          teamName: team?.name ?? "Team",
        });
        if (
          !beginWorkoutFromPlanRow(useActiveWorkoutStore.getState(), pendingRow)
        ) {
          return;
        }
        setModeOpen(false);
        router.push("/active-workout");
      } catch {
        notifyError(
          "Nie udało się utworzyć sesji grupowej. Spróbuj ponownie albo zacznij solo.",
        );
      } finally {
        setLoading(false);
      }
    },
    [pendingRow, teams, notifyError, router],
  );

  return (
    <>
      <TreningiHub
        hub={hub}
        stats={stats}
        startingPlanId={pendingRow?.id ?? null}
        onBegin={onBegin}
      />
      <StartWorkoutModeSheet
        open={modeOpen}
        onOpenChange={(open) => {
          setModeOpen(open);
          if (!open) setPendingRow(null);
        }}
        teams={teams}
        onSolo={onSolo}
        onGroup={(teamId) => {
          void onGroup(teamId);
        }}
        loading={loading}
      />
    </>
  );
}
