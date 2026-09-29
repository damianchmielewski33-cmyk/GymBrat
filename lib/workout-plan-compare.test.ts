import { describe, expect, it } from "vitest";
import {
  buildExerciseVolumeRows,
  buildWorkoutPlanCompare,
  completedSessionJsonForCompare,
} from "@/lib/workout-plan-compare";
import type { CompletedWorkoutDetails } from "@/lib/workout-history";

function details(
  partial: Partial<CompletedWorkoutDetails> & {
    exercises: CompletedWorkoutDetails["exercises"];
  },
): CompletedWorkoutDetails {
  return {
    id: partial.id ?? "w1",
    date: partial.date ?? "2026-09-28",
    title: partial.title ?? "Trening",
    startedAt: null,
    endedAt: null,
    workoutPlanId: partial.workoutPlanId ?? "p1",
    planName: partial.planName ?? "Nogi",
    volumeKg: partial.volumeKg ?? 0,
    strengthScore: partial.strengthScore ?? 0,
    exercises: partial.exercises,
  };
}

describe("workout-plan-compare", () => {
  it("buduje wiersze ćwiczeń w górę / w dół / nowe", () => {
    const prev = details({
      volumeKg: 1000,
      exercises: [
        {
          id: "1",
          name: "Przysiad",
          bestE1rm: 100,
          volumeKg: 800,
          sets: [{ reps: 5, weight: 100, done: true, e1rm: 112 }],
        },
        {
          id: "2",
          name: "Uginanie",
          bestE1rm: 40,
          volumeKg: 200,
          sets: [{ reps: 10, weight: 20, done: true, e1rm: 26 }],
        },
      ],
    });
    const current = details({
      volumeKg: 1200,
      exercises: [
        {
          id: "1",
          name: "Przysiad",
          bestE1rm: 110,
          volumeKg: 1000,
          sets: [{ reps: 5, weight: 110, done: true, e1rm: 124 }],
        },
        {
          id: "3",
          name: "Hack",
          bestE1rm: 90,
          volumeKg: 200,
          sets: [{ reps: 8, weight: 80, done: true, e1rm: 100 }],
        },
      ],
    });

    const rows = buildExerciseVolumeRows(current, prev);
    expect(rows.find((r) => r.name === "Przysiad")?.status).toBe("up");
    expect(rows.find((r) => r.name === "Hack")?.status).toBe("new");
    expect(rows.find((r) => r.name === "Uginanie")?.status).toBe("skipped");
  });

  it("liczy delta tonażu względem poprzedniej sesji planu", () => {
    const prevJson = completedSessionJsonForCompare({
      title: "Nogi",
      startedAtMs: Date.parse("2026-09-20T10:00:00Z"),
      endedAtMs: Date.parse("2026-09-20T11:00:00Z"),
      workoutPlanId: "plan-nogi",
      exercises: [
        {
          id: "1",
          name: "Przysiad",
          sets: [{ reps: 5, weight: 100, done: true }],
        },
      ],
    });
    const currentJson = completedSessionJsonForCompare({
      title: "Nogi",
      startedAtMs: Date.parse("2026-09-27T10:00:00Z"),
      endedAtMs: Date.parse("2026-09-27T11:00:00Z"),
      workoutPlanId: "plan-nogi",
      exercises: [
        {
          id: "1",
          name: "Przysiad",
          sets: [{ reps: 5, weight: 110, done: true }],
        },
      ],
    });

    const compare = buildWorkoutPlanCompare({
      currentExercisesJson: currentJson,
      previousExercisesJson: prevJson,
      currentDate: "2026-09-27",
      previousDate: "2026-09-20",
      workoutPlanId: "plan-nogi",
      planLabel: "Nogi",
    });

    expect(compare.previousVolumeKg).toBe(500);
    expect(compare.currentVolumeKg).toBe(550);
    expect(compare.volumeDeltaPercent).toBeCloseTo(10, 5);
    expect(compare.compare?.up).toBe(1);
  });
});
