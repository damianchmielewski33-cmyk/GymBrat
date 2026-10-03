import { describe, expect, it } from "vitest";
import {
  buildDietTrainingWeekRow,
  classifyDietWeekStatus,
  sumNutritionWindow,
} from "@/lib/diet-training-weeks";

describe("classifyDietWeekStatus", () => {
  it("no_goal when adherence unknown", () => {
    expect(
      classifyDietWeekStatus({
        daysLogged: 5,
        daysInWindow: 7,
        calorieAdherencePct: null,
      }),
    ).toBe("no_goal");
  });

  it("no_data when too few logged days", () => {
    expect(
      classifyDietWeekStatus({
        daysLogged: 2,
        daysInWindow: 7,
        calorieAdherencePct: 100,
      }),
    ).toBe("no_data");
  });

  it("on_track in 85–110%", () => {
    expect(
      classifyDietWeekStatus({
        daysLogged: 4,
        daysInWindow: 7,
        calorieAdherencePct: 97,
      }),
    ).toBe("on_track");
  });

  it("under / over outside band", () => {
    expect(
      classifyDietWeekStatus({
        daysLogged: 5,
        daysInWindow: 7,
        calorieAdherencePct: 70,
      }),
    ).toBe("under");
    expect(
      classifyDietWeekStatus({
        daysLogged: 5,
        daysInWindow: 7,
        calorieAdherencePct: 125,
      }),
    ).toBe("over");
  });

  it("short window only needs all days", () => {
    expect(
      classifyDietWeekStatus({
        daysLogged: 2,
        daysInWindow: 2,
        calorieAdherencePct: 100,
      }),
    ).toBe("on_track");
  });
});

describe("sumNutritionWindow", () => {
  it("ignores future days past today", () => {
    const days = [
      {
        date: "2026-09-28",
        caloriesConsumed: 2000,
        caloriesGoal: 2200,
        macros: { protein: 150, fat: 60, carbs: 200 },
        macroGoals: { protein: 160, fat: 70, carbs: 220 },
      },
      {
        date: "2026-09-29",
        caloriesConsumed: 0,
        caloriesGoal: 2200,
        macros: { protein: 0, fat: 0, carbs: 0 },
        macroGoals: { protein: 160, fat: 70, carbs: 220 },
      },
      {
        date: "2026-09-30",
        caloriesConsumed: 0,
        caloriesGoal: 2200,
        macros: { protein: 0, fat: 0, carbs: 0 },
        macroGoals: { protein: 160, fat: 70, carbs: 220 },
      },
    ];
    const out = sumNutritionWindow({
      days,
      today: "2026-09-28",
      mealAggs: {
        "2026-09-28": {
          entryCount: 3,
          calories: 2000,
          protein: 150,
          fat: 60,
          carbs: 200,
        },
      },
    });
    expect(out.daysInWindow).toBe(1);
    expect(out.daysLogged).toBe(1);
    expect(out.caloriesConsumed).toBe(2000);
    expect(out.caloriesGoal).toBe(2200);
    expect(out.proteinGoal).toBe(160);
  });
});

describe("buildDietTrainingWeekRow", () => {
  it("maps training intensity averages", () => {
    const row = buildDietTrainingWeekRow({
      monday: "2026-09-28",
      label: "28 wrz–4 paź",
      daysLogged: 5,
      daysInWindow: 7,
      caloriesConsumed: 14_000,
      caloriesGoal: 15_400,
      proteinConsumed: 700,
      proteinGoal: 800,
      training: {
        tonnageKg: 12_500,
        workouts: 4,
        intensitySessions: [
          {
            avgRir: 2,
            avgRpe: 8,
            setsWithRir: 4,
            setsWithRpe: 4,
            hardSets: 2,
            scoredSets: 4,
            targetOn: 0,
            targetHarder: 0,
            targetEasier: 0,
            targetCompared: 0,
            tempos: [],
            exercisesWithTempo: 0,
            exercisesScored: 1,
          },
        ],
      },
    });
    expect(row.status).toBe("on_track");
    expect(row.calorieAdherencePct).toBe(91);
    expect(row.workouts).toBe(4);
    expect(row.avgRpe).toBe(8);
    expect(row.avgRir).toBe(2);
    expect(row.hardSetPct).toBe(50);
  });
});
