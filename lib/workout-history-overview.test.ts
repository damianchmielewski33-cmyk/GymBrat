import { describe, expect, it } from "vitest";
import {
  compareWorkoutExercises,
  computeHistoryKpis,
  formatHistoryKg,
  formatHistoryShortDate,
  formatHistoryWeekRange,
  formatTonnes,
  type WorkoutHistoryCard,
} from "@/lib/workout-history-overview";
import type { CompletedWorkoutDetails } from "@/lib/workout-history";

function card(
  partial: Partial<WorkoutHistoryCard> & Pick<WorkoutHistoryCard, "id" | "date">,
): WorkoutHistoryCard {
  return {
    title: "Trening",
    planName: "Push A",
    planCompareKey: "name:push-a",
    planLabel: "Push A",
    workoutPlanId: null,
    volumeKg: 1000,
    volumeDeltaPercent: null,
    volumeDeltaKg: null,
    compare: null,
    firstOfDay: true,
    noComparison: true,
    prevDate: null,
    exerciseCount: 1,
    setsDone: 3,
    setsTotal: 3,
    cardioMinutes: 0,
    durationMinutes: 60,
    endedAt: null,
    planOccurrence: 1,
    exercises: [],
    ...partial,
  };
}

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
      same: 0,
    });
  });

  it("N-22-1 (005): ćwiczenie na masę ciała (zaliczone, tonaż 0) nie liczy się ani do „w górę”, ani do „w dół”", () => {
    const prev = details({
      date: "2026-09-27",
      exercises: [
        {
          id: "a",
          name: "Pompki",
          bestE1rm: 0,
          volumeKg: 500,
          sets: [{ reps: 20, weight: 25, done: true, e1rm: 0 }],
        },
      ],
    });
    const current = details({
      date: "2026-09-28",
      exercises: [
        {
          id: "a",
          name: "Pompki",
          bestE1rm: 0,
          volumeKg: 0,
          sets: [{ reps: 20, weight: 0, done: true, e1rm: 0 }],
        },
      ],
    });

    expect(compareWorkoutExercises(current, prev)).toEqual({
      up: 0,
      down: 0,
      skipped: 0,
      same: 0,
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

  it("computeHistoryKpis: pełny zbiór i pusty podzbiór (filtr)", () => {
    const cards = [
      card({
        id: "1",
        date: "2026-10-20",
        volumeKg: 2000,
        durationMinutes: 50,
        planCompareKey: "name:push",
      }),
      card({
        id: "2",
        date: "2026-10-22",
        volumeKg: 3000,
        durationMinutes: 70,
        planCompareKey: "name:nogi",
      }),
    ];
    const all = computeHistoryKpis(cards, "2026-10-26");
    expect(all.workoutsTotal).toBe(2);
    expect(all.tonnageTotalKg).toBe(5000);
    expect(all.avgDurationMinutes).toBe(60);

    const empty = computeHistoryKpis([], "2026-10-26");
    expect(empty.workoutsTotal).toBe(0);
    expect(empty.tonnageTotalKg).toBe(0);
    expect(empty.avgDurationMinutes).toBeNull();
    expect(empty.avgWorkoutsPerWeekLast8).toBe(0);
  });

  it("formatHistoryKg powyżej 9999 kg pokazuje tony", () => {
    expect(formatHistoryKg(12400)).toBe("12,4 t");
    expect(formatHistoryKg(4250)).toMatch(/4.?250 kg/);
  });

  it("formatHistoryWeekRange bez uppercase miesięcy", () => {
    expect(formatHistoryWeekRange("2026-10-20", "2026-10-26")).toMatch(
      /października/i,
    );
    expect(formatHistoryWeekRange("2026-10-20", "2026-10-26")).not.toMatch(
      /PAŹDZIERNIKA/,
    );
  });
});
