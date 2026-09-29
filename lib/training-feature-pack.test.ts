import { describe, expect, it } from "vitest";
import { normalizeWorkoutPlan } from "@/lib/workout-plan-utils";
import { GYMBRAT_GITHUB_SLUG } from "@/lib/gymbrat-source";
import {
  roundToPlateStep,
  suggestProgressionFromLastSets,
  applyProgressionToWeight,
  mergeHintsIntoExercises,
} from "@/lib/last-workout-hints";
import { resolveSessionRevisionConflict } from "@/lib/active-workout-cloud";
import { detectSessionNewMaxes } from "@/lib/session-new-max";
import { trainingPlanToWorkoutPayloads } from "@/lib/ai-training-plan-to-payload";

describe("workout plan normalize — RIR/tempo/note/superset", () => {
  it("zachowuje nowe pola planu", () => {
    const plan = normalizeWorkoutPlan({
      version: 2,
      path: "custom",
      planName: "Push",
      userCustomExerciseNames: [],
      exercises: [
        {
          id: "a",
          name: "Wyciskanie",
          categoryId: "chest",
          sets: 4,
          reps: 8,
          rir: 1,
          tempo: "3010",
          note: "łopatki",
          supersetGroupId: "g1",
        },
      ],
    });
    expect(plan?.exercises[0]).toMatchObject({
      rir: 1,
      tempo: "3010",
      note: "łopatki",
      supersetGroupId: "g1",
    });
    expect(GYMBRAT_GITHUB_SLUG).toContain("GymBrat");
  });
});

describe("sugestia ciężaru — double progression", () => {
  it("zaokrągla do 2.5 i podnosi gdy cel + RIR ≥ 2", () => {
    expect(roundToPlateStep(61)).toBe(60);
    const bump = suggestProgressionFromLastSets({
      targetReps: 8,
      sets: [
        { reps: 8, weight: 60, done: true, rir: 2 },
        { reps: 8, weight: 60, done: true, rir: 3 },
      ],
    });
    expect(bump?.kind).toBe("increase");
    expect(applyProgressionToWeight(60, bump!.kind)).toBe(62.5);
  });

  it("trzyma ciężar gdy RIR < 2", () => {
    const hold = suggestProgressionFromLastSets({
      targetReps: 8,
      sets: [
        { reps: 8, weight: 60, done: true, rir: 1 },
        { reps: 8, weight: 60, done: true, rir: 2 },
      ],
    });
    expect(hold?.kind).toBe("hold");
    expect(applyProgressionToWeight(60, hold!.kind)).toBe(60);
  });

  it("trzyma ciężar i wskazuje powtórzenia poniżej celu", () => {
    const hold = suggestProgressionFromLastSets({
      targetReps: 8,
      sets: [
        { reps: 6, weight: 60, done: true, rir: 3 },
        { reps: 8, weight: 60, done: true, rir: 2 },
      ],
    });
    expect(hold?.kind).toBe("hold_reps");
    expect(hold?.reason).toMatch(/powtórzenia/i);
  });

  it("brak RIR = hold (nie uznajemy za łatwo)", () => {
    const hold = suggestProgressionFromLastSets({
      targetReps: 8,
      sets: [{ reps: 8, weight: 60, done: true, rir: null }],
    });
    expect(hold?.kind).toBe("hold");
    expect(applyProgressionToWeight(60, hold!.kind)).toBe(60);
  });

  it("pomija serie skipped", () => {
    const bump = suggestProgressionFromLastSets({
      targetReps: 8,
      sets: [
        { reps: 3, weight: 60, done: true, skipped: true, rir: 0 },
        { reps: 8, weight: 60, done: true, rir: 2 },
      ],
    });
    expect(bump?.kind).toBe("increase");
  });
});

describe("sync revision", () => {
  it("rozstrzyga push/pull/noop", () => {
    expect(
      resolveSessionRevisionConflict({ clientRevision: 3, serverRevision: 2 }),
    ).toBe("push");
    expect(
      resolveSessionRevisionConflict({ clientRevision: 1, serverRevision: 4 }),
    ).toBe("pull");
    expect(
      resolveSessionRevisionConflict({ clientRevision: 2, serverRevision: 2 }),
    ).toBe("noop");
  });
});

describe("NOWY MAX sesji", () => {
  it("wykrywa przebicie poprzedniego ciężaru", () => {
    const hits = detectSessionNewMaxes(
      [
        {
          id: "ex1",
          name: "Przysiad",
          sets: [
            { reps: 5, weight: 100, done: true },
            { reps: 5, weight: 105, done: true },
          ],
        },
      ],
      {
        ex1: {
          sets: [
            { reps: 5, weight: 100, done: true },
            { reps: 5, weight: 100, done: true },
          ],
        },
      },
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.exerciseName).toBe("Przysiad");
  });

  it("nie ogłasza MAX gdy brak historii", () => {
    const hits = detectSessionNewMaxes(
      [
        {
          id: "ex1",
          name: "Przysiad",
          sets: [{ reps: 5, weight: 100, done: true }],
        },
      ],
      {},
    );
    expect(hits).toHaveLength(0);
  });
});

describe("mergeHintsIntoExercises", () => {
  it("dokłada suggestedWeights z double progression", () => {
    const merged = mergeHintsIntoExercises(
      [
        {
          id: "ex1",
          name: "Wyciskanie",
          targetReps: 8,
          sets: [
            { reps: null, weight: 0, done: false },
            { reps: null, weight: 0, done: false },
          ],
        },
      ],
      {
        ex1: {
          sets: [
            { reps: 8, weight: 60, done: true, rir: 2 },
            { reps: 8, weight: 60, done: true, rir: 1 },
          ],
        },
      },
    );
    // Druga seria RIR 1 → hold całego ćwiczenia
    expect(merged[0]?.suggestedWeights?.[0]).toBe(60);
    expect(merged[0]?.suggestedWeights?.[1]).toBe(60);
    expect(merged[0]?.suggestionReason).toMatch(/RIR/i);
    expect(merged[0]?.sets[0]?.weight).toBe(0);
  });

  it("podnosi ciężar gdy wszystkie serie na celu i RIR ≥ 2", () => {
    const merged = mergeHintsIntoExercises(
      [
        {
          id: "ex1",
          name: "Wyciskanie",
          targetReps: 8,
          sets: [
            { reps: null, weight: 0, done: false },
            { reps: null, weight: 0, done: false },
          ],
        },
      ],
      {
        ex1: {
          sets: [
            { reps: 8, weight: 60, done: true, rir: 2 },
            { reps: 9, weight: 60, done: true, rir: 2 },
          ],
        },
      },
    );
    expect(merged[0]?.suggestedWeights?.[0]).toBe(62.5);
    expect(merged[0]?.suggestedWeights?.[1]).toBe(62.5);
    expect(merged[0]?.suggestionReason).toMatch(/\+2,5/);
  });
});

describe("AI plan → payload", () => {
  it("mapuje dni strength na plany", () => {
    const payloads = trainingPlanToWorkoutPayloads({
      days: [
        {
          day: 1,
          title: "Full Body A",
          type: "strength",
          session: {
            main: [
              {
                name: "Squat",
                sets: 3,
                reps: "8-10",
                restSec: 120,
                notes: "brace",
              },
            ],
          },
        },
        {
          day: 2,
          title: "Rest",
          type: "rest",
          session: { main: [] },
        },
      ],
    });
    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.planName).toBe("Full Body A");
    expect(payloads[0]?.exercises[0]?.sets).toBe(3);
    expect(payloads[0]?.exercises[0]?.reps).toBe(8);
    expect(payloads[0]?.exercises[0]?.note).toBe("brace");
  });
});
