import { describe, expect, it } from "vitest";
import {
  computeExtraCardioAdvice,
  computeOpenMacroDebt,
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

  it("wczorajsza nadwyżka widać dziś rano (niewykorzystany cel dziś nie kasuje długu)", () => {
    const yesterday = day({
      caloriesConsumed: 2400,
      proteinConsumed: 150,
      carbsConsumed: 200,
      fatConsumed: 60,
    });
    const todayMorning = day({
      caloriesConsumed: 0,
      proteinConsumed: 0,
      carbsConsumed: 0,
      fatConsumed: 0,
    });

    const debt = computeOpenMacroDebt({
      todayKey: "2026-10-07",
      weekKeys,
      elapsedDays: [
        { dateKey: "2026-10-05", day: day({ caloriesConsumed: 2000, proteinConsumed: 150, carbsConsumed: 200, fatConsumed: 60 }) },
        { dateKey: "2026-10-06", day: yesterday },
        { dateKey: "2026-10-07", day: todayMorning },
      ],
      recentCardio: [],
    });

    expect(debt.pastDebtKcal).toBe(400);
    expect(debt.todaySoftCreditKcal).toBe(0);
    expect(debt.openDebtKcal).toBe(400);

    const advice = computeExtraCardioAdvice({
      todayKey: "2026-10-07",
      weekKeys,
      today: todayMorning,
      elapsedDays: [
        { dateKey: "2026-10-05", day: day({ caloriesConsumed: 2000, proteinConsumed: 150, carbsConsumed: 200, fatConsumed: 60 }) },
        { dateKey: "2026-10-06", day: yesterday },
        { dateKey: "2026-10-07", day: todayMorning },
      ],
      weightKg: 80,
      recentCardio: [{ minutes: 40, calories: 320, paceMinPerKm: 8 }],
    });
    expect(advice.show).toBe(true);
    expect(advice.extraMinutes).toBeGreaterThanOrEqual(5);
  });

  it("po odrobieniu wczorajszej nadwyżki dietą pasek znika następnego dnia", () => {
    const mondayOk = day({
      caloriesConsumed: 2000,
      proteinConsumed: 150,
      carbsConsumed: 200,
      fatConsumed: 60,
    });
    const tuesdayOver = day({
      caloriesConsumed: 2400,
      proteinConsumed: 150,
      carbsConsumed: 200,
      fatConsumed: 60,
    });
    const wednesdayUnder = day({
      caloriesConsumed: 1600,
      proteinConsumed: 140,
      carbsConsumed: 150,
      fatConsumed: 50,
    });

    const duringCatchUp = computeExtraCardioAdvice({
      todayKey: "2026-10-07",
      weekKeys,
      today: wednesdayUnder,
      elapsedDays: [
        { dateKey: "2026-10-05", day: mondayOk },
        { dateKey: "2026-10-06", day: tuesdayOver },
        { dateKey: "2026-10-07", day: wednesdayUnder },
      ],
      weightKg: 80,
      recentCardio: [],
    });
    // Środa: zjedzone 80% celu i poniżej — miękki kredyt 400 → dług ~0
    expect(duringCatchUp.show).toBe(false);

    const nextMorning = computeExtraCardioAdvice({
      todayKey: "2026-10-08",
      weekKeys,
      today: day({ caloriesConsumed: 0 }),
      elapsedDays: [
        { dateKey: "2026-10-05", day: mondayOk },
        { dateKey: "2026-10-06", day: tuesdayOver },
        { dateKey: "2026-10-07", day: wednesdayUnder },
        { dateKey: "2026-10-08", day: day({ caloriesConsumed: 0 }) },
      ],
      weightKg: 80,
      recentCardio: [],
    });
    // Wt +400, Śr −400 → pastNet 0
    expect(nextMorning.show).toBe(false);
  });

  it("cardio w tygodniu obniża otwarty dług", () => {
    const debt = computeOpenMacroDebt({
      todayKey: "2026-10-07",
      weekKeys,
      elapsedDays: [
        {
          dateKey: "2026-10-06",
          day: day({ caloriesConsumed: 2500 }),
        },
        { dateKey: "2026-10-07", day: day({ caloriesConsumed: 0 }) },
      ],
      recentCardio: [
        { minutes: 40, calories: 300, paceMinPerKm: 8, dateKey: "2026-10-07" },
      ],
    });
    expect(debt.pastDebtKcal).toBe(500);
    expect(debt.cardioOffsetKcal).toBe(300);
    expect(debt.openDebtKcal).toBe(200);
  });

  it("bez żadnej nadwyżki nie pokazuje dodatkowego cardio", () => {
    const advice = computeExtraCardioAdvice({
      todayKey: "2026-10-06",
      weekKeys,
      today: day({
        caloriesConsumed: 1800,
        proteinConsumed: 140,
        carbsConsumed: 180,
        fatConsumed: 50,
      }),
      elapsedDays: [
        {
          dateKey: "2026-10-05",
          day: day({ caloriesConsumed: 1900 }),
        },
        {
          dateKey: "2026-10-06",
          day: day({
            caloriesConsumed: 1800,
            proteinConsumed: 140,
            carbsConsumed: 180,
            fatConsumed: 50,
          }),
        },
      ],
      weightKg: 75,
      recentCardio: [],
    });
    expect(advice.show).toBe(false);
    expect(advice.extraMinutes).toBe(0);
  });
});
