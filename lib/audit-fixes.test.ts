import { describe, expect, it } from "vitest";
import { detectMuscleImbalances } from "@/lib/analytics/muscle-volume";
import type { MuscleGroupRow } from "@/lib/analytics/types";
import { macroSurplusKcal } from "@/lib/extra-cardio-from-macros";
import { buildSetProgressionSuggestion, resolveRepRange } from "@/lib/set-progression-suggestion";
import { estimated1RM } from "@/lib/workout-history";

const day = {
  caloriesConsumed: 2050,
  caloriesGoal: 2000,
  proteinConsumed: 200,
  carbsConsumed: 200,
  fatConsumed: 60,
  proteinGoal: 150,
  carbsGoal: 250,
  fatGoal: 70,
};

describe("poprawki audytu", () => {
  it("nadwyżka dnia = nadwyżka kcal, gdy jest cel kcal", () => {
    expect(macroSurplusKcal(day).surplusKcal).toBe(50);
  });

  it("nadwyżka z makro tylko bez celu kcal", () => {
    expect(
      macroSurplusKcal({ ...day, caloriesGoal: null }).surplusKcal,
    ).toBe(200);
  });

  it("Epley nie ekstrapoluje powyżej 12 powtórzeń", () => {
    expect(estimated1RM(50, 30)).toBe(estimated1RM(50, 12));
  });

  it("zakres 12 powtórzeń ma szerokość 3", () => {
    expect(resolveRepRange(12)).toEqual({ min: 9, max: 12 });
  });

  it("poniżej zakresu na 1. serii: zejdź o krok (includeDeload)", () => {
    const s = buildSetProgressionSuggestion({
      last: { weight: 60, reps: 5 },
      targetReps: 10,
      includeDeload: true,
      setIndex: 0,
      weightStepKg: 2.5,
    });
    expect(s?.weightKg).toBe(57.5);
    expect(s?.reps).toBe(8);
  });

  it("alert nierównowagi tylko w jedną stronę", () => {
    const row = (id: string, sets: number) =>
      ({
        id,
        label: id,
        week: { sets: 0, reps: 0, tonnageKg: 0, sharePct: 0 },
        days30: { sets, reps: 0, tonnageKg: 0, sharePct: 0 },
        days90: { sets: 0, reps: 0, tonnageKg: 0, sharePct: 0 },
      }) as MuscleGroupRow;
    expect(
      detectMuscleImbalances([row("klatka", 6), row("plecy", 20)]),
    ).toHaveLength(0);
    expect(
      detectMuscleImbalances([row("klatka", 20), row("plecy", 6)]),
    ).toHaveLength(1);
  });
});

import { suggestSetFromLastSet } from "@/lib/last-workout-hints";
import { resolveInitialSetDraft } from "@/lib/workout-set-draft";

describe("podpowiedzi: ciężar i powtórzenia z silnika", () => {
  it("silnik zwraca ciężar i powtórzenia (w zakresie → +1 powt.)", () => {
    const s = suggestSetFromLastSet({ weight: 60, reps: 8 }, 10, { weightStepKg: 2.5 });
    expect(s).toEqual({ weight: 60, reps: 9 });
  });

  it("powtórzenia z silnika nadpisują domyślne z planu, ale nie wpis użytkownika", () => {
    const base = {
      suggestion: { weightKg: 60, reps: 9 },
      lastSessionSet: null,
      previousSessionSet: null,
    };
    const set = (reps: number | null) => ({ reps, weight: 0, done: false });
    expect(resolveInitialSetDraft({ ...base, set: set(10), defaultReps: 10 }).reps).toBe(9);
    expect(resolveInitialSetDraft({ ...base, set: set(null) }).reps).toBe(9);
    expect(resolveInitialSetDraft({ ...base, set: set(7), defaultReps: 10 }).reps).toBe(7);
  });
});
