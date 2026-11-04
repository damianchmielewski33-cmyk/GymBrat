import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ getDb: vi.fn() }));

import { computeSessionTonnageKg } from "@/lib/analytics/tonnage";
import { parseWorkoutExercises } from "@/lib/home-stats";
import { computeWorkoutDetails } from "@/lib/workout-history";
import {
  countPerformedSets,
  sessionVolume,
} from "@/lib/workout-session-calculations";

const session = JSON.stringify({
  kind: "completed_session",
  title: "Push",
  exercises: [
    {
      name: "Wyciskanie",
      sets: [
        { reps: 5, weight: 40, done: true, warmup: true },
        { reps: 8, weight: 60, done: true },
        { reps: 8, weight: 60, done: true },
        { reps: 6, weight: 70, done: true, skipped: true },
        { reps: 10, weight: 50, done: false },
        { reps: 12, weight: 0, done: true },
      ],
    },
    { name: "Wyciskanie hantli", sets: [{ reps: 10, weight: 20.5, done: true }] },
  ],
});

// 8×60 + 8×60 + 10×20.5 = 1165 (rozgrzewka, pominięta, niewykonana i bez ciężaru nie liczą się)
const EXPECTED_TONNAGE = 1165;

describe("kontrakt: tonaż i serie są takie same na Pulpicie, w Treningu i w Analizie (Z44)", () => {
  it("Historia / Trening (computeWorkoutDetails)", () => {
    const d = computeWorkoutDetails({
      id: "w1",
      date: "2026-11-03",
      rawJson: session,
      workoutPlanId: null,
      planName: null,
    });
    expect(d?.volumeKg).toBe(EXPECTED_TONNAGE);
    expect(countPerformedSets(d!.exercises)).toBe(4);
  });

  it("Pulpit (home-stats)", () => {
    expect(parseWorkoutExercises(session).volumeKg).toBe(EXPECTED_TONNAGE);
  });

  it("Analiza (computeSessionTonnageKg)", () => {
    expect(computeSessionTonnageKg(session)).toBe(EXPECTED_TONNAGE);
  });

  it("serie legacy bez flagi done liczą się wszędzie tak samo", () => {
    const legacy = JSON.stringify({
      exercises: [{ name: "Przysiad", sets: [{ reps: 5, weight: 100 }] }],
    });
    expect(computeSessionTonnageKg(legacy)).toBe(500);
    expect(parseWorkoutExercises(legacy).volumeKg).toBe(500);
    const d = computeWorkoutDetails({
      id: "w2",
      date: "2026-11-03",
      rawJson: legacy,
      workoutPlanId: null,
      planName: null,
    });
    expect(sessionVolume(d!.exercises)).toBe(500);
  });
});
