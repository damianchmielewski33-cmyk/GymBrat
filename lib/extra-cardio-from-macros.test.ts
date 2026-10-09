import { describe, expect, it } from "vitest";
import {
  cardioKcalAboveProRataGoal,
  cardioKcalInWeek,
  computeExtraCardioAdvice,
  computeOpenMacroDebt,
  computePersonalBurnRate,
  dayCalorieBalance,
  daysLeftInWeekIncludingToday,
  estimateBurnKcalPerMin,
  estimateHeartRateBurnKcalPerMin,
  isReliableHeartRate,
  macroSurplusKcal,
  softCreditKcal,
  type MacroDaySnapshot,
  type RecentCardioSample,
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

function makePersonalHistory(): RecentCardioSample[] {
  return Array.from({ length: 12 }, (_, i) => ({
    minutes: 20,
    calories: 160,
    paceMinPerKm: 7.5,
    avgHeartRate: 140,
    dateKey: `2026-09-${String(10 + i).padStart(2, "0")}`,
  }));
}

describe("extra-cardio-from-macros", () => {
  it("liczy nadwyżkę z makro energetycznych (max z kcal)", () => {
    const { surplusKcal, exceeded } = macroSurplusKcal(
      day({
        proteinConsumed: 150,
        carbsConsumed: 250,
        fatConsumed: 60,
        caloriesConsumed: 2200,
      }),
    );
    expect(surplusKcal).toBe(200);
    expect(exceeded).toContain("carbs");
    expect(exceeded).toContain("calories");
  });

  it("nadwyżka białka przy deficycie kcal nie zwiększa długu", () => {
    const { surplusKcal, exceeded } = macroSurplusKcal(
      day({
        proteinConsumed: 180,
        carbsConsumed: 200,
        fatConsumed: 50,
        caloriesConsumed: 1800,
        proteinGoal: 150,
        carbsGoal: 250,
        fatGoal: 60,
        caloriesGoal: 2000,
      }),
    );
    expect(surplusKcal).toBe(0);
    expect(exceeded).not.toContain("protein");
    expect(exceeded).not.toContain("calories");

    const advice = computeExtraCardioAdvice({
      todayKey: "2026-10-06",
      weekKeys,
      today: day({
        proteinConsumed: 180,
        carbsConsumed: 200,
        fatConsumed: 50,
        caloriesConsumed: 1800,
        proteinGoal: 150,
        carbsGoal: 250,
        fatGoal: 60,
      }),
      elapsedDays: [
        {
          dateKey: "2026-10-06",
          day: day({
            proteinConsumed: 180,
            carbsConsumed: 200,
            fatConsumed: 50,
            caloriesConsumed: 1800,
            proteinGoal: 150,
            carbsGoal: 250,
            fatGoal: 60,
          }),
        },
      ],
      weightKg: 80,
      recentCardio: [],
    });
    expect(advice.show).toBe(false);
    expect(advice.extraMinutes).toBe(0);
  });

  it("dni do końca tygodnia włącznie z dziś", () => {
    expect(daysLeftInWeekIncludingToday("2026-10-06", weekKeys)).toBe(6);
    expect(daysLeftInWeekIncludingToday("2026-10-11", weekKeys)).toBe(1);
  });

  it("płynny soft credit: 55% = 0, 70% częściowy, 100% = 0 (brak luki)", () => {
    expect(softCreditKcal(day({ caloriesConsumed: 1100 }))).toBe(0); // 55%
    expect(softCreditKcal(day({ caloriesConsumed: 1099 }))).toBe(0);

    const at70 = softCreditKcal(day({ caloriesConsumed: 1400 }));
    // progress = (1400-1100)/(2000-1100)=1/3; credit = 600*(1/3)=200
    expect(at70).toBe(200);

    const at85 = softCreditKcal(day({ caloriesConsumed: 1700 }));
    // progress = 600/900; credit = 300*(2/3)=200
    expect(at85).toBe(200);

    expect(softCreditKcal(day({ caloriesConsumed: 2000 }))).toBe(0);
    expect(softCreditKcal(day({ caloriesConsumed: 0 }))).toBe(0);
  });

  it("pusty dzień nie jest bilansem −cel", () => {
    expect(dayCalorieBalance(day({ caloriesConsumed: 0 }))).toBeNull();
    expect(dayCalorieBalance(day({ caloriesConsumed: 100 }))).toBeNull();
  });

  it("realny deficyt z płynnym kredytem daje ujemny bilans", () => {
    expect(
      dayCalorieBalance(
        day({
          caloriesConsumed: 1600,
          proteinConsumed: 140,
          carbsConsumed: 150,
          fatConsumed: 50,
        }),
      ),
    ).toBe(-softCreditKcal(day({ caloriesConsumed: 1600 })));
  });

  it("puste dni tygodnia nie kasują długu", () => {
    const debt = computeOpenMacroDebt({
      todayKey: "2026-10-08",
      weekKeys,
      burnKcalPerMin: 8,
      elapsedDays: [
        {
          dateKey: "2026-10-05",
          day: day({
            caloriesConsumed: 2400,
            proteinConsumed: 150,
            carbsConsumed: 200,
            fatConsumed: 60,
          }),
        },
        { dateKey: "2026-10-06", day: day({ caloriesConsumed: 0 }) },
        {
          dateKey: "2026-10-07",
          day: day({
            caloriesConsumed: 2200,
            proteinConsumed: 150,
            carbsConsumed: 200,
            fatConsumed: 60,
          }),
        },
        { dateKey: "2026-10-08", day: day({ caloriesConsumed: 0 }) },
      ],
      recentCardio: [],
    });
    expect(debt.pastDebtKcal).toBe(600);
    expect(debt.openDebtKcal).toBe(600);
  });

  it("wczorajsza nadwyżka widać dziś rano (niewykorzystany cel dziś nie kasuje długu)", () => {
    const yesterday = day({
      caloriesConsumed: 2400,
      proteinConsumed: 150,
      carbsConsumed: 200,
      fatConsumed: 60,
    });
    const todayMorning = day({ caloriesConsumed: 0 });

    const debt = computeOpenMacroDebt({
      todayKey: "2026-10-07",
      weekKeys,
      burnKcalPerMin: 8,
      elapsedDays: [
        {
          dateKey: "2026-10-05",
          day: day({
            caloriesConsumed: 2000,
            proteinConsumed: 150,
            carbsConsumed: 200,
            fatConsumed: 60,
          }),
        },
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
        {
          dateKey: "2026-10-05",
          day: day({
            caloriesConsumed: 2000,
            proteinConsumed: 150,
            carbsConsumed: 200,
            fatConsumed: 60,
          }),
        },
        { dateKey: "2026-10-06", day: yesterday },
        { dateKey: "2026-10-07", day: todayMorning },
      ],
      weightKg: 80,
      recentCardio: [{ minutes: 40, calories: 320, paceMinPerKm: 8 }],
    });
    expect(advice.show).toBe(true);
    expect(advice.effectiveSurplusKcal).toBeLessThanOrEqual(advice.surplusKcal);
    expect(advice.effectiveSurplusKcal).toBeLessThanOrEqual(400);
  });

  it("effectiveSurplus nigdy nie przekracza openDebt", () => {
    const advice = computeExtraCardioAdvice({
      todayKey: "2026-10-06",
      weekKeys,
      today: day({ caloriesConsumed: 0 }),
      elapsedDays: [
        {
          dateKey: "2026-10-05",
          day: day({ caloriesConsumed: 2800 }),
        },
        { dateKey: "2026-10-06", day: day({ caloriesConsumed: 0 }) },
      ],
      weightKg: 80,
      recentCardio: [],
    });
    expect(advice.show).toBe(true);
    expect(advice.effectiveSurplusKcal).toBeLessThanOrEqual(advice.surplusKcal);
  });

  it("cardioOffset limit 80% długu", () => {
    const debt = computeOpenMacroDebt({
      todayKey: "2026-10-07",
      weekKeys,
      burnKcalPerMin: 8,
      weeklyCardioGoalMinutes: 150,
      elapsedDays: [
        {
          dateKey: "2026-10-06",
          day: day({ caloriesConsumed: 2500 }),
        },
        { dateKey: "2026-10-07", day: day({ caloriesConsumed: 0 }) },
      ],
      recentCardio: [
        // Duży nadmiar minut — computedOffset mógłby zjeść cały dług
        { minutes: 200, calories: 2000, paceMinPerKm: 8, dateKey: "2026-10-07" },
      ],
    });
    expect(debt.pastDebtKcal).toBe(500);
    expect(debt.debtBeforeCardioKcal).toBe(500);
    expect(debt.cardioOffsetKcal).toBe(Math.round(500 * 0.8));
    expect(debt.openDebtKcal).toBe(100);
  });

  it("cardio w ramach pro-rata celu NIE kasuje długu makro", () => {
    const debt = computeOpenMacroDebt({
      todayKey: "2026-10-07",
      weekKeys,
      burnKcalPerMin: 8,
      weeklyCardioGoalMinutes: 150,
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
    expect(debt.cardioOffsetKcal).toBe(0);
    expect(debt.openDebtKcal).toBe(500);
  });

  it("tylko cardio powyżej pro-rata obniża dług (z limitem 80%)", () => {
    const { offsetKcal, proRataGoalMinutes } = cardioKcalAboveProRataGoal({
      samples: [
        { minutes: 100, calories: 800, paceMinPerKm: 8, dateKey: "2026-10-07" },
      ],
      weekKeys,
      todayKey: "2026-10-07",
      weeklyCardioGoalMinutes: 150,
      burnKcalPerMin: 8,
    });
    expect(proRataGoalMinutes).toBe(Math.round((150 * 3) / 7));

    const debt = computeOpenMacroDebt({
      todayKey: "2026-10-07",
      weekKeys,
      burnKcalPerMin: 8,
      weeklyCardioGoalMinutes: 150,
      elapsedDays: [
        {
          dateKey: "2026-10-06",
          day: day({ caloriesConsumed: 2500 }),
        },
        { dateKey: "2026-10-07", day: day({ caloriesConsumed: 0 }) },
      ],
      recentCardio: [
        { minutes: 100, calories: 800, paceMinPerKm: 8, dateKey: "2026-10-07" },
      ],
    });
    expect(debt.cardioOffsetKcal).toBe(
      Math.min(offsetKcal, Math.round(500 * 0.8)),
    );
    expect(debt.openDebtKcal).toBe(
      Math.max(0, 500 - debt.cardioOffsetKcal),
    );
  });

  it("wpis z calories używa podanych kcal (bez przeliczania)", () => {
    expect(
      cardioKcalInWeek(
        [{ minutes: 45, calories: 420, paceMinPerKm: 8, dateKey: "2026-10-07" }],
        weekKeys,
        99,
      ),
    ).toBe(420);
  });

  it("cardio bez kcal liczy z minut × spalanie", () => {
    expect(
      cardioKcalInWeek(
        [{ minutes: 40, calories: null, paceMinPerKm: 8, dateKey: "2026-10-07" }],
        weekKeys,
        8,
      ),
    ).toBe(320);
  });

  it("walidacja tętna: <70 i >210 niewiarygodne", () => {
    expect(isReliableHeartRate(69)).toBe(false);
    expect(isReliableHeartRate(70)).toBe(true);
    expect(isReliableHeartRate(210)).toBe(true);
    expect(isReliableHeartRate(211)).toBe(false);
    expect(
      estimateHeartRateBurnKcalPerMin({
        avgHeartRate: 50,
        weightKg: 80,
        ageYears: 30,
      }),
    ).toBeNull();
    expect(
      estimateHeartRateBurnKcalPerMin({
        avgHeartRate: 220,
        weightKg: 80,
        ageYears: 30,
      }),
    ).toBeNull();
  });

  it("spalanie z tętna (model) gdy brak historii kcal", () => {
    const hrBurn = estimateHeartRateBurnKcalPerMin({
      avgHeartRate: 145,
      weightKg: 80,
      ageYears: 32,
    });
    expect(hrBurn).not.toBeNull();
    expect(hrBurn!).toBeGreaterThanOrEqual(3);
    expect(hrBurn!).toBeLessThanOrEqual(18);

    const { burnKcalPerMin, burnSource } = estimateBurnKcalPerMin({
      weightKg: 80,
      ageYears: 32,
      recentCardio: [
        {
          minutes: 30,
          calories: null,
          paceMinPerKm: null,
          avgHeartRate: 145,
        },
      ],
    });
    expect(burnSource).toBe("heart_rate_model");
    expect(burnKcalPerMin).toBe(hrBurn);
  });

  it("brak tętna → MET / default", () => {
    const { burnSource } = estimateBurnKcalPerMin({
      weightKg: 80,
      ageYears: 32,
      recentCardio: [],
    });
    expect(burnSource === "met_model" || burnSource === "default").toBe(true);
  });

  it("niewiarygodne tętno pomijane — spada na MET", () => {
    const { burnSource, heartRateBurnRate } = estimateBurnKcalPerMin({
      weightKg: 80,
      ageYears: 32,
      recentCardio: [
        {
          minutes: 40,
          calories: null,
          paceMinPerKm: 7,
          avgHeartRate: 40,
        },
      ],
    });
    expect(heartRateBurnRate).toBeNull();
    expect(burnSource).toBe("met_model");
  });

  it("personalBurnRate przy ≥10 treningach i ≥200 min", () => {
    const history = makePersonalHistory(); // 12 × 20 min = 240, kcal 160
    expect(computePersonalBurnRate(history)).toBe(8);

    const short = history.slice(0, 5);
    expect(computePersonalBurnRate(short)).toBeNull();

    const { burnSource, burnKcalPerMin } = estimateBurnKcalPerMin({
      weightKg: 80,
      ageYears: 30,
      recentCardio: history,
    });
    expect(burnSource).toBe("personal_model");
    // personal 8 + HR korekta → blend
    expect(burnKcalPerMin).toBeGreaterThanOrEqual(3);
    expect(burnKcalPerMin).toBeLessThanOrEqual(18);
  });

  it("clamp spalania 3–18 kcal/min", () => {
    const { burnKcalPerMin } = estimateBurnKcalPerMin({
      weightKg: 200,
      recentCardio: [
        { minutes: 60, calories: 3000, paceMinPerKm: 4 },
        { minutes: 60, calories: 3000, paceMinPerKm: 4 },
        { minutes: 60, calories: 3000, paceMinPerKm: 4 },
        { minutes: 60, calories: 3000, paceMinPerKm: 4 },
        { minutes: 60, calories: 3000, paceMinPerKm: 4 },
        { minutes: 60, calories: 3000, paceMinPerKm: 4 },
        { minutes: 60, calories: 3000, paceMinPerKm: 4 },
        { minutes: 60, calories: 3000, paceMinPerKm: 4 },
        { minutes: 60, calories: 3000, paceMinPerKm: 4 },
        { minutes: 60, calories: 3000, paceMinPerKm: 4 },
      ],
    });
    expect(burnKcalPerMin).toBeLessThanOrEqual(18);
    expect(burnKcalPerMin).toBeGreaterThanOrEqual(3);
  });

  it("bardzo duży dług tygodniowy — minuty clamp ≤ 90, effective ≤ openDebt", () => {
    const advice = computeExtraCardioAdvice({
      todayKey: "2026-10-11",
      weekKeys,
      today: day({ caloriesConsumed: 4000 }),
      elapsedDays: [
        { dateKey: "2026-10-05", day: day({ caloriesConsumed: 3500 }) },
        { dateKey: "2026-10-06", day: day({ caloriesConsumed: 3500 }) },
        { dateKey: "2026-10-07", day: day({ caloriesConsumed: 3500 }) },
        { dateKey: "2026-10-08", day: day({ caloriesConsumed: 3500 }) },
        { dateKey: "2026-10-09", day: day({ caloriesConsumed: 3500 }) },
        { dateKey: "2026-10-10", day: day({ caloriesConsumed: 3500 }) },
        { dateKey: "2026-10-11", day: day({ caloriesConsumed: 4000 }) },
      ],
      weightKg: 80,
      recentCardio: [{ minutes: 40, calories: 320, paceMinPerKm: 8 }],
    });
    expect(advice.show).toBe(true);
    expect(advice.extraMinutes).toBeLessThanOrEqual(90);
    expect(advice.effectiveSurplusKcal).toBeLessThanOrEqual(advice.surplusKcal);
    expect(advice.surplusKcal).toBeGreaterThan(1000);
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

  it("minuty = ceil(effective / kcal_na_min); tooltip ma offset i źródło", () => {
    const advice = computeExtraCardioAdvice({
      todayKey: "2026-10-11",
      weekKeys,
      today: day({
        caloriesConsumed: 2500,
        proteinConsumed: 150,
        carbsConsumed: 200,
        fatConsumed: 60,
      }),
      elapsedDays: [
        {
          dateKey: "2026-10-11",
          day: day({
            caloriesConsumed: 2500,
            proteinConsumed: 150,
            carbsConsumed: 200,
            fatConsumed: 60,
          }),
        },
      ],
      weightKg: 80,
      recentCardio: [{ minutes: 40, calories: 320, paceMinPerKm: 8 }],
    });
    expect(advice.show).toBe(true);
    expect(advice.burnSource).toBe("calories_entered");
    expect(advice.extraMinutes).toBe(
      Math.min(90, Math.ceil(advice.effectiveSurplusKcal / advice.burnKcalPerMin)),
    );
    expect(typeof advice.cardioOffsetKcal).toBe("number");
    expect(advice.explanation.some((l) => l.startsWith("Open debt:"))).toBe(
      true,
    );
  });

  it("przy przekroczeniach pn→dziś proponuje dodatkowe cardio", () => {
    const advice = computeExtraCardioAdvice({
      todayKey: "2026-10-08",
      weekKeys,
      weeklyCardioGoalMinutes: 150,
      today: day({
        caloriesConsumed: 2300,
        proteinConsumed: 180,
        carbsConsumed: 220,
        fatConsumed: 70,
      }),
      elapsedDays: [
        {
          dateKey: "2026-10-05",
          day: day({
            caloriesConsumed: 2300,
            proteinConsumed: 170,
            carbsConsumed: 220,
            fatConsumed: 70,
          }),
        },
        {
          dateKey: "2026-10-06",
          day: day({
            caloriesConsumed: 2400,
            proteinConsumed: 160,
            carbsConsumed: 230,
            fatConsumed: 65,
          }),
        },
        {
          dateKey: "2026-10-07",
          day: day({
            caloriesConsumed: 2200,
            proteinConsumed: 155,
            carbsConsumed: 210,
            fatConsumed: 62,
          }),
        },
        {
          dateKey: "2026-10-08",
          day: day({
            caloriesConsumed: 2300,
            proteinConsumed: 180,
            carbsConsumed: 220,
            fatConsumed: 70,
          }),
        },
      ],
      weightKg: 80,
      recentCardio: [
        { minutes: 40, calories: 320, paceMinPerKm: 7.5, dateKey: "2026-10-06" },
        { minutes: 30, calories: 240, paceMinPerKm: 7.5, dateKey: "2026-10-07" },
      ],
    });
    expect(advice.show).toBe(true);
    expect(advice.extraMinutes).toBeGreaterThanOrEqual(5);
    expect(advice.effectiveSurplusKcal).toBeLessThanOrEqual(advice.surplusKcal);
  });
});
