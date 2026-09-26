"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import type { TreningiHubStats } from "@/lib/treningi-hub-stats";
import { TreningiHub } from "@/components/treningi/treningi-hub";
import type { WorkoutExerciseState } from "@/components/workout/types";
import type { WorkoutPlanExercise } from "@/lib/workout-plan-types";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function planExercisesToSession(exercises: WorkoutPlanExercise[]): WorkoutExerciseState[] {
  return exercises.map((ex) => {
    const setCount =
      typeof ex.sets === "number" && Number.isFinite(ex.sets) && ex.sets > 0
        ? clampInt(ex.sets, 1, 20)
        : 3;
    const reps =
      typeof ex.reps === "number" && Number.isFinite(ex.reps) && ex.reps > 0
        ? clampInt(ex.reps, 1, 99)
        : null;
    return {
      id: ex.id,
      name: ex.name,
      targetSets: setCount,
      targetReps: reps ?? undefined,
      targetRir: 1,
      tempo: null,
      sets: Array.from({ length: setCount }, () => ({
        reps,
        weight: 0,
        done: false,
        rpe: null,
        rir: 1,
      })),
    };
  });
}

export function TreningiHubClient({
  plans,
  stats,
}: {
  plans: WorkoutPlanWithLastWorkoutDTO[];
  stats: TreningiHubStats;
}) {
  const router = useRouter();
  const { applyPlan, setExercises, setSelectedExerciseId, start, reset } =
    useActiveWorkoutStore();

  const onBegin = useCallback(
    (row: WorkoutPlanWithLastWorkoutDTO) => {
      if (row.plan.exercises.length === 0) return;
      reset();
      applyPlan(row.id, row.plan);
      const next = planExercisesToSession(row.plan.exercises);
      setExercises(next);
      setSelectedExerciseId(next[0]?.id ?? null);
      start();
      sessionStorage.setItem("active-workout:skipResumeOnce", "1");
      router.push("/active-workout");
    },
    [applyPlan, reset, router, setExercises, setSelectedExerciseId, start],
  );

  return <TreningiHub plans={plans} stats={stats} onBegin={onBegin} />;
}
