import { describe, expect, it } from "vitest";
import {
  cardioKcalAboveWeeklyGoal,
  cardioKcalInWeek,
  computeExtraCardioAdvice,
  computeOpenMacroDebt,
  computePersonalBurnRate,
  dayCalorieBalance,
  daysLeftInWeekIncludingToday,
  estimateBurnKcalPerMin,
  estimateHeartRateBurnKcalPerMin,
  grossToNetKcal,
  grossToNetKcalPerMin,
  isPlausibleEnteredCalories,
  isReliableHeartRate,
  macroSurplusKcal,
  metFromSpeedKmh,
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

  it("cardioOffset nie przekracza długu przed cardio i może go domknąć do 0", () => {
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
    // 150/200 min ponad cel → 25% z 2000 kcal = 500 = cały dług
    expect(debt.cardioOffsetKcal).toBe(500);
    expect(debt.openDebtKcal).toBe(0);
  });

  it("cardio w ramach celu tygodnia NIE kasuje długu makro", () => {
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
        // 100 min < cel 150 — nawet „przed tempem” pro-rata nie offsetuje
        { minutes: 100, calories: 800, paceMinPerKm: 8, dateKey: "2026-10-07" },
      ],
    });
    expect(debt.pastDebtKcal).toBe(500);
    expect(debt.cardioOffsetKcal).toBe(0);
    expect(debt.openDebtKcal).toBe(500);
  });

  it("tylko cardio powyżej celu tygodnia obniża dług (z limitem 80%)", () => {
    const { offsetKcal, goalMinutes } = cardioKcalAboveWeeklyGoal({
      samples: [
        { minutes: 200, calories: 1600, paceMinPerKm: 8, dateKey: "2026-10-07" },
      ],
      weekKeys,
      todayKey: "2026-10-07",
      weeklyCardioGoalMinutes: 150,
      burnKcalPerMin: 8,
    });
    expect(goalMinutes).toBe(150);
    // 50/200 minut ponad cel → 25% z 1600 kcal
    expect(offsetKcal).toBe(400);

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
        { minutes: 200, calories: 1600, paceMinPerKm: 8, dateKey: "2026-10-07" },
      ],
    });
    expect(debt.cardioOffsetKcal).toBe(Math.min(offsetKcal, 500));
    expect(debt.openDebtKcal).toBe(
      Math.max(0, 500 - debt.cardioOffsetKcal),
    );
  });

  it("offset kcal liczony z sesji NADPROGRAMOWEJ, nie z proporcji całego tygodnia", () => {
    // Cel 150 min. Wcześnie w tygodniu: 150 min lekkiego marszu (2 kcal/min, wiarygodne).
    // Później, już ponad cel: 50 min intensywnego biegu (16 kcal/min, wiarygodne).
    // Stara (błędna) metoda mieszała kcal obu sesji proporcjonalnie do minut całego
    // tygodnia: (300+800) * (50/200) = 275 kcal — nadwyżka policzona tempem marszu,
    // mimo że realnie nadprogramowe minuty to szybki bieg (800 kcal).
    const { offsetKcal } = cardioKcalAboveWeeklyGoal({
      samples: [
        { minutes: 150, calories: 300, paceMinPerKm: 10, dateKey: "2026-10-06" },
        { minutes: 50, calories: 800, paceMinPerKm: 5, dateKey: "2026-10-07" },
      ],
      weekKeys,
      weeklyCardioGoalMinutes: 150,
      burnKcalPerMin: 8,
    });
    expect(offsetKcal).toBe(800);
  });

  it("domknięty cel w sobotę nie zawyża dodatkowego cardio w niedzielę bez jedzenia", () => {
    const weeklyGoal = 210;
    const cardio = [
      {
        minutes: 210,
        calories: 1680,
        paceMinPerKm: 7.5,
        dateKey: "2026-10-10",
      },
    ];
    const ok = day({ caloriesConsumed: 2000 });
    const surplusFri = day({ caloriesConsumed: 2300 });
    const surplusSat = day({ caloriesConsumed: 2200 });
    const empty = day({ caloriesConsumed: 0 });

    const elapsedSat = [
      { dateKey: "2026-10-05", day: ok },
      { dateKey: "2026-10-06", day: ok },
      { dateKey: "2026-10-07", day: ok },
      { dateKey: "2026-10-08", day: ok },
      { dateKey: "2026-10-09", day: surplusFri },
      { dateKey: "2026-10-10", day: surplusSat },
    ];

    const sat = computeExtraCardioAdvice({
      todayKey: "2026-10-10",
      weekKeys,
      today: surplusSat,
      elapsedDays: elapsedSat,
      weightKg: 80,
      recentCardio: cardio,
      weeklyCardioGoalMinutes: weeklyGoal,
    });
    const sun = computeExtraCardioAdvice({
      todayKey: "2026-10-11",
      weekKeys,
      today: empty,
      elapsedDays: [...elapsedSat, { dateKey: "2026-10-11", day: empty }],
      weightKg: 80,
      recentCardio: cardio,
      weeklyCardioGoalMinutes: weeklyGoal,
    });

    // Ten sam wolumen cardio — offset nie znika z dnia na dzień
    expect(sat.cardioOffsetKcal).toBe(sun.cardioOffsetKcal);
    // Pusty niedzielny dzień nie powinien skakać do capu 90 przez znikający offset
    expect(sun.extraMinutes).toBeLessThanOrEqual(sat.extraMinutes + 15);
    expect(sun.extraMinutes).toBeLessThan(90);
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
    // Keytel to wartość brutto — do planowania używamy netto (bez spoczynku).
    expect(burnKcalPerMin).toBe(grossToNetKcalPerMin(hrBurn!, 80));
    expect(burnKcalPerMin).toBeLessThan(hrBurn!);
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

  it("clamp spalania 2–18 kcal/min", () => {
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
    expect(burnKcalPerMin).toBeGreaterThanOrEqual(2);
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
    expect(advice.extraMinutes).toBe(90);
    expect(advice.effectiveSurplusKcal).toBeLessThanOrEqual(advice.surplusKcal);
    // Tooltip „Do odrobienia cardio” odpowiada uciętemu celowi, nie pełnemu długowi.
    expect(advice.effectiveSurplusKcal).toBe(
      Math.round(90 * advice.burnKcalPerMin),
    );
    expect(advice.surplusKcal).toBeGreaterThan(1000);
  });

  it("cardio ponad cel tygodnia zmniejsza zalecenie ucięte do 90 min", () => {
    const weeklyGoal = 170;
    const history: RecentCardioSample[] = [
      { minutes: weeklyGoal, calories: null, paceMinPerKm: null, dateKey: "2026-10-05" },
    ];
    const base = {
      todayKey: "2026-10-07",
      weekKeys,
      weightKg: 80,
      weeklyCardioGoalMinutes: weeklyGoal,
      today: day({ caloriesConsumed: 0 }),
      elapsedDays: [
        { dateKey: "2026-10-05", day: day({ caloriesConsumed: 3500 }) },
        { dateKey: "2026-10-06", day: day({ caloriesConsumed: 3500 }) },
        { dateKey: "2026-10-07", day: day({ caloriesConsumed: 0 }) },
      ],
    };
    const extra = (minutes: number): RecentCardioSample => ({
      minutes,
      calories: null,
      paceMinPerKm: null,
      dateKey: "2026-10-07",
    });

    const before = computeExtraCardioAdvice({ ...base, recentCardio: history });
    expect(before.show).toBe(true);
    // Dług wymagałby znacznie ponad 90 min — zalecenie ucięte do limitu.
    expect(before.surplusKcal / before.burnKcalPerMin).toBeGreaterThan(90);
    expect(before.extraMinutes).toBe(90);

    const after20 = computeExtraCardioAdvice({
      ...base,
      recentCardio: [...history, extra(20)],
    });
    expect(after20.burnKcalPerMin).toBe(before.burnKcalPerMin);
    expect(after20.show).toBe(true);
    expect(after20.extraMinutes).toBe(70);
    expect(after20.effectiveSurplusKcal).toBe(
      before.effectiveSurplusKcal - after20.cardioOffsetKcal,
    );

    const after90 = computeExtraCardioAdvice({
      ...base,
      recentCardio: [...history, extra(90)],
    });
    expect(after90.show).toBe(false);
    expect(after90.extraMinutes).toBe(0);
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
      Math.ceil(advice.effectiveSurplusKcal / advice.burnKcalPerMin),
    );
    expect(typeof advice.cardioOffsetKcal).toBe("number");
    expect(
      advice.explanation.some((l) => l.startsWith("Niewyrównana nadwyżka:")),
    ).toBe(true);
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

  describe("poprawki: dług, kredyt dnia, spalanie netto", () => {
    it("przekroczenie węgli/tłuszczu przy kcal ≤ cel nie jest nadwyżką energetyczną", () => {
      const d = day({
        caloriesConsumed: 1900,
        carbsConsumed: 260, // +60 g ponad cel 200
        fatConsumed: 30,
        proteinConsumed: 120,
      });
      const { surplusKcal, exceeded } = macroSurplusKcal(d);
      expect(surplusKcal).toBe(0);
      expect(exceeded).toEqual([]);
      expect(dayCalorieBalance(d)).toBe(-softCreditKcal(d));
    });

    it("bez celu kcal liczą się przekroczenia makro", () => {
      const { surplusKcal } = macroSurplusKcal(
        day({ caloriesGoal: null, carbsConsumed: 250 }),
      );
      expect(surplusKcal).toBe(200);
    });

    it("niedokończony dzisiejszy dzień nie daje soft creditu", () => {
      const debt = computeOpenMacroDebt({
        todayKey: "2026-10-07",
        weekKeys,
        burnKcalPerMin: 8,
        elapsedDays: [
          { dateKey: "2026-10-06", day: day({ caloriesConsumed: 2400 }) },
          // 1500/2000 → soft credit ~222 kcal, ale dzień trwa dalej
          { dateKey: "2026-10-07", day: day({ caloriesConsumed: 1500 }) },
        ],
        recentCardio: [],
      });
      expect(softCreditKcal(day({ caloriesConsumed: 1500 }))).toBeGreaterThan(0);
      expect(debt.pastDebtKcal).toBe(400);
      expect(debt.openDebtKcal).toBe(400);
    });

    it("rekomendacja dodatkowego cardio zanika po wykonaniu zalecanych minut", () => {
      const history = [
        { minutes: 150, calories: 1500, paceMinPerKm: null, dateKey: "2026-10-05" },
      ];
      const base = {
        todayKey: "2026-10-07",
        weekKeys,
        weightKg: 80,
        weeklyCardioGoalMinutes: 150,
        today: day({ caloriesConsumed: 0 }),
        elapsedDays: [
          { dateKey: "2026-10-05", day: day({ caloriesConsumed: 2500 }) },
          { dateKey: "2026-10-06", day: day({ caloriesConsumed: 2000 }) },
          { dateKey: "2026-10-07", day: day({ caloriesConsumed: 0 }) },
        ],
      };
      const before = computeExtraCardioAdvice({ ...base, recentCardio: history });
      expect(before.show).toBe(true);
      expect(before.extraMinutes).toBeGreaterThanOrEqual(5);

      const after = computeExtraCardioAdvice({
        ...base,
        recentCardio: [
          ...history,
          {
            minutes: before.extraMinutes,
            calories: null,
            paceMinPerKm: null,
            dateKey: "2026-10-07",
          },
        ],
      });
      expect(after.show).toBe(false);
      expect(after.extraMinutes).toBe(0);
    });

    it("model tętna uwzględnia płeć (kobiety spalają mniej niż wzór męski)", () => {
      const args = { avgHeartRate: 145, weightKg: 65, ageYears: 30 };
      const male = estimateHeartRateBurnKcalPerMin({ ...args, sex: "male" })!;
      const female = estimateHeartRateBurnKcalPerMin({ ...args, sex: "female" })!;
      const unknown = estimateHeartRateBurnKcalPerMin(args)!;
      expect(female).toBeLessThan(male);
      expect(unknown).toBeGreaterThanOrEqual(female);
      expect(unknown).toBeLessThanOrEqual(male);
    });

    it("MET zależy od prędkości: marsz ≪ bieg", () => {
      const walk = metFromSpeedKmh(5)!;
      const run = metFromSpeedKmh(10)!;
      expect(walk).toBeGreaterThan(3.4);
      expect(walk).toBeLessThan(4.3);
      expect(run).toBeGreaterThan(9.5);
      expect(metFromSpeedKmh(0)).toBeNull();

      const walkBurn = estimateBurnKcalPerMin({
        weightKg: 80,
        recentCardio: [{ minutes: 40, calories: null, paceMinPerKm: 12, cardioType: "walk" }],
      });
      const runBurn = estimateBurnKcalPerMin({
        weightKg: 80,
        recentCardio: [{ minutes: 40, calories: null, paceMinPerKm: 6, cardioType: "run" }],
      });
      expect(walkBurn.burnSource).toBe("met_model");
      expect(walkBurn.burnKcalPerMin).toBeLessThan(5);
      expect(runBurn.burnKcalPerMin).toBeGreaterThan(walkBurn.burnKcalPerMin * 2);
    });

    it("tempo z roweru/orbitreku nie wchodzi do modelu MET marszu/biegu", () => {
      const burn = estimateBurnKcalPerMin({
        weightKg: 80,
        recentCardio: [{ minutes: 40, calories: null, paceMinPerKm: 3, cardioType: "bike" }],
      });
      expect(burn.recentPaceMinPerKm).toBeNull();
      expect(burn.burnSource).toBe("default");
    });

    it("mieszane marsz + bieg: MET liczony per próbka, nie z uśrednionego tempa", () => {
      const burn = estimateBurnKcalPerMin({
        weightKg: 80,
        recentCardio: [
          { minutes: 30, calories: null, paceMinPerKm: 12, cardioType: "walk" },
          { minutes: 30, calories: null, paceMinPerKm: 6, cardioType: "run" },
        ],
      });
      const expectedMet = (metFromSpeedKmh(5)! + metFromSpeedKmh(10)!) / 2;
      expect(burn.burnKcalPerMin).toBeCloseTo(((expectedMet - 1) * 80) / 60, 0);
    });

    it("kcal brutto → netto (bez metabolizmu spoczynkowego), z dolnym progiem", () => {
      // 80 kg → 1,33 kcal/min spoczynku
      expect(grossToNetKcal(300, 30, 80)).toBeCloseTo(260, 0);
      // niska intensywność: nie spadamy poniżej 60% brutto
      expect(grossToNetKcal(60, 30, 80)).toBeCloseTo(36, 5);
      expect(grossToNetKcal(0, 30, 80)).toBe(0);
    });

    it("niewiarygodne kcal (>25 kcal/min) są ignorowane — szacunek z minut", () => {
      expect(isPlausibleEnteredCalories(30, 5000)).toBe(false);
      expect(isPlausibleEnteredCalories(30, 300)).toBe(true);
      expect(
        cardioKcalInWeek(
          [{ minutes: 30, calories: 5000, paceMinPerKm: null, dateKey: "2026-10-07" }],
          weekKeys,
          8,
        ),
      ).toBe(240);
      expect(
        computePersonalBurnRate(
          Array.from({ length: 12 }, () => ({
            minutes: 20,
            calories: 5000,
            paceMinPerKm: null,
          })),
        ),
      ).toBeNull();
    });

    it("offset cardio liczy kcal netto, gdy znana waga", () => {
      const common = {
        samples: [
          { minutes: 200, calories: 1600, paceMinPerKm: null, dateKey: "2026-10-07" },
        ] as RecentCardioSample[],
        weekKeys,
        weeklyCardioGoalMinutes: 150,
        burnKcalPerMin: 8,
      };
      const gross = cardioKcalAboveWeeklyGoal(common).offsetKcal;
      const net = cardioKcalAboveWeeklyGoal({ ...common, netWeightKg: 80 }).offsetKcal;
      expect(net).toBeLessThan(gross);
    });
  });
});
