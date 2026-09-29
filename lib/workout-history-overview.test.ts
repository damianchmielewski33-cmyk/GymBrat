import { describe, expect, it } from "vitest";
import {
  compareWorkoutExercises,
  formatHistoryShortDate,
  formatTonnes,
} from "@/lib/workout-history-overview";
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
    planName: partial.planName ?? "Plan",
    volumeKg: partial.volumeKg ?? 0,
    strengthScore: partial.strengthScore ?? 0,
    exercises: partial.exercises,
  };
}

describe("workout-history-overview helpers", () => {
  it("formatuje tonaż w tonach PL", () => {
    expect(formatTonnes(14000)).toBe("14,0 t");
    expect(formatTonnes(2300)).toBe("2,3 t");
  });

  it("formatuje krótką datę", () => {
    expect(formatHistoryShortDate("2026-09-28")).toMatch(/28/);
  });

  it("liczy w górę / w dół / pominięte względem poprzedniej sesji", () => {
    const prev = details({
      date: "2026-09-27",
      exercises: [
        {
          id: "a",
          name: "Wyciskanie",
          bestE1rm: 100,
          volumeKg: 1000,
          sets: [{ reps: 8, weight: 80, done: true, e1rm: 100 }],
        },
        {
          id: "b",
          name: "Wiosłowanie",
          bestE1rm: 90,
          volumeKg: 900,
          sets: [{ reps: 8, weight: 70, done: true, e1rm: 90 }],
        },
        {
          id: "c",
          name: "Uginanie",
          bestE1rm: 40,
          volumeKg: 400,
          sets: [{ reps: 10, weight: 20, done: true, e1rm: 40 }],
        },
      ],
    });
    const current = details({
      date: "2026-09-28",
      volumeKg: 800,
      exercises: [
        {
          id: "a",
          name: "Wyciskanie",
          bestE1rm: 110,
          volumeKg: 1200,
          sets: [{ reps: 8, weight: 90, done: true, e1rm: 110 }],
        },
        {
          id: "b",
          name: "Wiosłowanie",
          bestE1rm: 80,
          volumeKg: 600,
          sets: [{ reps: 8, weight: 60, done: true, e1rm: 80 }],
        },
        {
          id: "d",
          name: "Rozpiętki",
          bestE1rm: 0,
          volumeKg: 0,
          sets: [{ reps: null, weight: 0, done: false, e1rm: 0 }],
        },
      ],
    });

    expect(compareWorkoutExercises(current, prev)).toEqual({
      up: 1,
      down: 1,
      skipped: 2,
    });
  });

  it("bez poprzedniej sesji zwraca null", () => {
    const current = details({
      exercises: [
        {
          id: "a",
          name: "Squat",
          bestE1rm: 100,
          volumeKg: 1000,
          sets: [{ reps: 5, weight: 100, done: true, e1rm: 100 }],
        },
      ],
    });
    expect(compareWorkoutExercises(current, null)).toBeNull();
  });
});
