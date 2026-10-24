import { describe, expect, it } from "vitest";
import type { WorkoutSetState } from "@/components/workout/types";
import { resolveWeightStep } from "@/lib/weight-step";
import {
  MAX_REPS,
  MAX_WEIGHT_KG,
  clampReps,
  clampWeight,
  findPreviousCompletedSet,
  parseRepsInput,
  parseWeightInput,
  resolveInitialSetDraft,
  resolveWeightAdjustSteps,
} from "@/lib/workout-set-draft";

const open: WorkoutSetState = { reps: null, weight: 0, done: false };
const last: WorkoutSetState = { reps: 6, weight: 65, done: true };
const prev: WorkoutSetState = { reps: 7, weight: 60, done: true };

describe("clamp / parse", () => {
  it("clampWeight zachowuje 0,01 kg i przycina 0..999", () => {
    expect(clampWeight(61.25)).toBe(61.25);
    expect(clampWeight(20.125)).toBe(20.13);
    expect(clampWeight(-5)).toBe(0);
    expect(clampWeight(1200)).toBe(MAX_WEIGHT_KG);
    expect(clampWeight(Number.NaN)).toBe(0);
  });

  it("clampReps zaokrągla i przycina 0..99", () => {
    expect(clampReps(8.6)).toBe(9);
    expect(clampReps(-1)).toBe(0);
    expect(clampReps(150)).toBe(MAX_REPS);
    expect(clampReps(null)).toBe(0);
  });

  it("parseWeightInput: przecinek, puste, nieliczba", () => {
    expect(parseWeightInput("62,5")).toBe(62.5);
    expect(parseWeightInput(" 61.25 ")).toBe(61.25);
    expect(parseWeightInput("")).toBeNull();
    expect(parseWeightInput("   ")).toBeNull();
    expect(parseWeightInput("abc")).toBeNull();
  });

  it("parseRepsInput: puste, nieliczba, przycięcie", () => {
    expect(parseRepsInput("8")).toBe(8);
    expect(parseRepsInput("")).toBeNull();
    expect(parseRepsInput("x")).toBeNull();
    expect(parseRepsInput("500")).toBe(MAX_REPS);
  });
});

describe("resolveInitialSetDraft (BR-7)", () => {
  const base = {
    suggestion: { weightKg: 70, reps: 8 },
    lastSessionSet: last,
    previousSessionSet: prev,
  };

  it("1: seria z ciężarem > 0 nie jest nadpisywana", () => {
    expect(
      resolveInitialSetDraft({
        ...base,
        set: { reps: 5, weight: 72.5, done: false },
      }),
    ).toEqual({ weightKg: 72.5, reps: 5, source: "set" });
  });

  it("1: seria done zostaje (także pominięta z 0 kg -> puste pole)", () => {
    expect(
      resolveInitialSetDraft({
        ...base,
        set: { reps: 8, weight: 50, done: true },
      }),
    ).toEqual({ weightKg: 50, reps: 8, source: "set" });
    expect(
      resolveInitialSetDraft({
        ...base,
        set: { reps: null, weight: 0, done: true, skipped: true },
      }),
    ).toEqual({ weightKg: null, reps: null, source: "set" });
  });

  it("2: sugestia ma pierwszeństwo przed poprzednim treningiem", () => {
    expect(resolveInitialSetDraft({ ...base, set: open })).toEqual({
      weightKg: 70,
      reps: 8,
      source: "suggestion",
    });
  });

  it("3: poprzedni trening, gdy brak sugestii", () => {
    expect(
      resolveInitialSetDraft({ ...base, suggestion: null, set: open }),
    ).toEqual({ weightKg: 65, reps: 6, source: "lastSession" });
  });

  it("3 pomijane przy 0 kg -> 4: wcześniejsza zapisana seria w sesji", () => {
    expect(
      resolveInitialSetDraft({
        set: open,
        suggestion: null,
        lastSessionSet: { reps: 10, weight: 0, done: true },
        previousSessionSet: prev,
      }),
    ).toEqual({ weightKg: 60, reps: 7, source: "previousSet" });
  });

  it("5: brak źródeł -> puste pole", () => {
    expect(
      resolveInitialSetDraft({
        set: open,
        suggestion: null,
        lastSessionSet: null,
        previousSessionSet: null,
      }),
    ).toEqual({ weightKg: null, reps: null, source: "empty" });
  });

  it("set.reps > 0 (cel planu) ma pierwszeństwo przed powtórzeniami źródła", () => {
    expect(
      resolveInitialSetDraft({
        ...base,
        suggestion: null,
        set: { reps: 10, weight: 0, done: false },
      }),
    ).toEqual({ weightKg: 65, reps: 10, source: "lastSession" });
  });

  it("plan bez celu bierze powtórzenia ze źródła; sugestia bez reps zostawia puste", () => {
    expect(
      resolveInitialSetDraft({ ...base, suggestion: null, set: open }).reps,
    ).toBe(6);
    expect(
      resolveInitialSetDraft({
        ...base,
        suggestion: { weightKg: 70, reps: null },
        set: open,
      }),
    ).toEqual({ weightKg: 70, reps: null, source: "suggestion" });
  });

  it("wartość 61,25 kg nie jest zaokrąglana do 0,5", () => {
    expect(
      resolveInitialSetDraft({
        set: open,
        suggestion: { weightKg: 61.25, reps: 5 },
        lastSessionSet: null,
        previousSessionSet: null,
      }).weightKg,
    ).toBe(61.25);
  });
});

describe("findPreviousCompletedSet", () => {
  it("najbliższa wcześniejsza zapisana, pomija pominięte i otwarte", () => {
    const sets: WorkoutSetState[] = [
      prev,
      { reps: 8, weight: 62.5, done: true },
      { reps: 8, weight: 62.5, done: true, skipped: true },
      open,
      open,
    ];
    expect(findPreviousCompletedSet(sets, 4)).toBe(sets[1]);
    expect(findPreviousCompletedSet(sets, 1)).toBe(prev);
    expect(findPreviousCompletedSet(sets, 0)).toBeNull();
    expect(findPreviousCompletedSet(sets, 99)).toBe(sets[1]);
  });
});

describe("resolveWeightAdjustSteps (P-4)", () => {
  it.each([
    ["Przysiad ze sztangą", null, 2.5, 5],
    ["Wyciskanie hantli", null, 2, 4],
    ["Swing kettlebell", null, 4, 8],
    ["Wiosłowanie", 1.25, 1.25, 2.5],
  ])("%s (krok %s) -> %s / %s", (name, explicit, stepper, quick) => {
    expect(
      resolveWeightAdjustSteps(
        resolveWeightStep({ name, explicitStepKg: explicit }),
      ),
    ).toEqual({ stepperKg: stepper, quickKg: quick });
  });
});
