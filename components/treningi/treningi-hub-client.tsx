"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import type { TreningiHubStats } from "@/lib/treningi-hub-stats";
import { TreningiHub } from "@/components/treningi/treningi-hub";
import { beginWorkoutFromPlanRow } from "@/lib/start-workout-session";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";

export function TreningiHubClient({
  plans,
  stats,
}: {
  plans: WorkoutPlanWithLastWorkoutDTO[];
  stats: TreningiHubStats;
}) {
  const router = useRouter();

  const onBegin = useCallback(
    (row: WorkoutPlanWithLastWorkoutDTO) => {
      if (!beginWorkoutFromPlanRow(useActiveWorkoutStore.getState(), row)) return;
      router.push("/active-workout");
    },
    [router],
  );

  return <TreningiHub plans={plans} stats={stats} onBegin={onBegin} />;
}
