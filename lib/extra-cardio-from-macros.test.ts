import { describe, expect, it } from "vitest";
import {
  computeExtraCardioAdvice,
  daysLeftInWeekIncludingToday,
  estimateBurnKcalPerMin,
  macroSurplusKcal,
  type MacroDaySnapshot,
} from "@/lib/extra-cardio-from-macros";

const weekKeys = [
  "2026-10-05", // pon
  "2026-10-06", // wt
  "2026-10-07",
  "2026-10-08",
  "2026-10-09",
  "2026-10-10",
  "2026-10-11", // nd
];

function day(partial: Partial<MacroDaySnapshot>): MacroDaySnapshot {
  return {
    caloriesConsumed: 0,
    caloriesGoal: 2000,
    proteinConsumed: 0,
    carbsConsumed: 0,
    fatConsumed: 0,
    proteinGoal: 150,
    carbsGoal: 200,
    fatGoal: 60,
    ...partial,
  };
}

describe("extra-cardio-from-macros", () => {
  it("liczy nadwyżkę z makro (max z kcal)", () => {
    const { surplusKcal, exceeded } = macroSurplusKcal(
      day({
        proteinConsumed: 170,
        carbsConsumed: 200,
        fatConsumed: 60,
        caloriesConsumed: 2100,
      }),
    );
    // 20g białka * 4 = 80; kcal over = 100 → max = 100
    expect(surplusKcal).toBe(100);
    expect(exceeded).toContain("protein");
    expect(exceeded).toContain("calories");
  });

  it("dni do końca tygodnia włącznie z dziś", () => {
    expect(daysLeftInWeekIncludingToday("2026-10-06", weekKeys)).toBe(6);
    expect(daysLeftInWeekIncludingToday("2026-10-11", weekKeys)).toBe(1);
  });

  it("szacuje spalanie z historii kcal/min", () => {
    const { burnKcalPerMin, recentPaceMinPerKm } = estimateBurnKcalPerMin({
      weightKg: 80,
      recentCardio: [
        { minutes: 30, calories: 240, paceMinPerKm: 7 },
        { minutes: 20, calories: 160, paceMinPerKm: 7.5 },
      ],
    });
    expect(burnKcalPerMin).toBe(8);
    expect(recentPaceMinPerKm).toBeCloseTo(7.2, 1);
  });

  it("na początku tygodnia odkłada część nadwyżki — mniej dodatkowego cardio", () => {
    const monday = computeExtraCardioAdvice({
      todayKey: "2026-10-05",
      weekKeys,
      today: day({
        caloriesConsumed: 2400,
        proteinConsumed: 180,
        carbsConsumed: 250,
        fatConsumed: 80,
      }),
      week: day({
        caloriesConsumed: 2400,
        caloriesGoal: 14_000,
        proteinConsumed: 180,
        carbsConsumed: 250,
        fatConsumed: 80,
        proteinGoal: 1050,
        carbsGoal: 1400,
        fatGoal: 420,
      }),
      weightKg: 80,
      recentCardio: [{ minutes: 40, calories: 320, paceMinPerKm: 8 }],
    });

    const sunday = computeExtraCardioAdvice({
      todayKey: "2026-10-11",
      weekKeys,
      today: day({
        caloriesConsumed: 2400,
        proteinConsumed: 180,
        carbsConsumed: 250,
        fatConsumed: 80,
      }),
      week: day({
        caloriesConsumed: 14_500,
        caloriesGoal: 14_000,
        proteinConsumed: 1100,
        carbsConsumed: 1500,
        fatConsumed: 450,
        proteinGoal: 1050,
        carbsGoal: 1400,
        fatGoal: 420,
      }),
      weightKg: 80,
      recentCardio: [{ minutes: 40, calories: 320, paceMinPerKm: 8 }],
    });

    expect(monday.show).toBe(true);
    expect(sunday.show).toBe(true);
    expect(sunday.extraMinutes).toBeGreaterThanOrEqual(monday.extraMinutes);
    expect(sunday.balanceChancePct).toBeLessThan(monday.balanceChancePct);
  });

  it("bez przekroczenia nie pokazuje dodatkowego cardio", () => {
    const advice = computeExtraCardioAdvice({
      todayKey: "2026-10-06",
      weekKeys,
      today: day({
        caloriesConsumed: 1800,
        proteinConsumed: 140,
        carbsConsumed: 180,
        fatConsumed: 50,
      }),
      week: day({
        caloriesConsumed: 3600,
        caloriesGoal: 14_000,
        proteinConsumed: 280,
        carbsConsumed: 360,
        fatConsumed: 100,
        proteinGoal: 1050,
        carbsGoal: 1400,
        fatGoal: 420,
      }),
      weightKg: 75,
      recentCardio: [],
    });
    expect(advice.show).toBe(false);
    expect(advice.extraMinutes).toBe(0);
  });
});
