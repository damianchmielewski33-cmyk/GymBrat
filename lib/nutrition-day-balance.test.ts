import { describe, expect, it } from "vitest";
import type { WeekDayNutritionRow } from "@/lib/week-nutrition-rows";
import {
  buildDayCardViewModel,
  buildMacroBalanceViewModel,
  buildPeriodMacroBalance,
  classifyMacroBalance,
  formatSignedAmount,
  formatSignedPct,
} from "@/lib/nutrition-day-balance";

function row(
  partial: Partial<WeekDayNutritionRow> & Pick<WeekDayNutritionRow, "dateKey">,
): WeekDayNutritionRow {
  const base = {
    headline: partial.headline ?? partial.dateKey,
    caloriesConsumed: 0,
    caloriesGoal: null,
    proteinConsumed: 0,
    proteinGoal: null,
    fatConsumed: 0,
    fatGoal: null,
    carbsConsumed: 0,
    carbsGoal: null,
    entryCount: 0,
    dayType: "rest" as const,
    ...partial,
  };
  if (partial.entryCount == null) {
    const hasMacros =
      (partial.caloriesConsumed ?? 0) > 0 ||
      (partial.proteinConsumed ?? 0) > 0 ||
      (partial.fatConsumed ?? 0) > 0 ||
      (partial.carbsConsumed ?? 0) > 0;
    base.entryCount = hasMacros ? 1 : 0;
  }
  return base;
}

describe("nutrition-day-balance", () => {
  it("classifies small deltas as on_track", () => {
    expect(classifyMacroBalance(0.4, 2)).toBe("on_track");
    expect(classifyMacroBalance(12, 4)).toBe("on_track");
    expect(classifyMacroBalance(-20, -12)).toBe("deficit");
    expect(classifyMacroBalance(18, 22)).toBe("surplus");
  });

  it("builds day balance with deficit protein and surplus fat", () => {
    const day = buildDayCardViewModel(
      row({
        dateKey: "2026-10-06",
        headline: "Wtorek, 6 października",
        proteinConsumed: 80,
        proteinGoal: 160,
        fatConsumed: 90,
        fatGoal: 70,
        carbsConsumed: 200,
        carbsGoal: 200,
        caloriesConsumed: 2000,
        caloriesGoal: 2200,
      }),
      "2026-10-06",
    );

    expect(day.state).toBe("in_progress");
    const protein = day.macros.find((m) => m.key === "protein")!;
    expect(protein.status).toBe("deficit");
    expect(protein.delta).toBe(-80);
    expect(protein.adherencePct).toBe(50);
    expect(protein.deltaPct).toBe(-50);

    const fat = day.macros.find((m) => m.key === "fat")!;
    expect(fat.status).toBe("surplus");
    expect(fat.delta).toBe(20);
    expect(fat.deltaPct).toBe(29);

    const carbs = day.macros.find((m) => m.key === "carbs")!;
    expect(carbs.status).toBe("on_track");

    // Dziś (in_progress): lista odchyleń pusta — hero używa direction, nie highlights.
    expect(day.deviations).toEqual([]);
    expect(day.macros.filter((m) => m.status === "deficit" || m.status === "surplus").map((h) => h.key).sort()).toEqual([
      "calories",
      "fat",
      "protein",
    ]);
  });

  it("rolls period pn→dziś and collects highlights newest-first", () => {
    const rows = [
      row({
        dateKey: "2026-10-05",
        fatConsumed: 100,
        fatGoal: 70,
        proteinConsumed: 150,
        proteinGoal: 150,
      }),
      row({
        dateKey: "2026-10-06",
        proteinConsumed: 100,
        proteinGoal: 160,
        fatConsumed: 60,
        fatGoal: 70,
      }),
      row({
        dateKey: "2026-10-07",
        proteinConsumed: 0,
        proteinGoal: 160,
      }),
    ];

    const period = buildPeriodMacroBalance(rows, "2026-10-06");
    const protein = period.macros.find((m) => m.key === "protein")!;
    expect(protein.consumed).toBe(250);
    expect(protein.goal).toBe(310);
    // Status z dni zamkniętych (150/150); dziś w toku nie generuje „brakuje”.
    expect(protein.status).toBe("on_track");

    const fat = period.macros.find((m) => m.key === "fat")!;
    expect(fat.consumed).toBe(160);
    expect(fat.goal).toBe(140);
    expect(fat.status).toBe("surplus");

    const model = buildMacroBalanceViewModel(rows, "2026-10-06", "Tydzień");
    // Dziś nie wchodzi na listę odchyleń (jest w hero).
    expect(model.pastDays.every((d) => d.dateKey < "2026-10-06")).toBe(true);
    expect(model.pastDays[0].deviations.some((m) => m.key === "fat")).toBe(true);
  });

  it("excludes empty days with goals from period and highlights (AU-4)", () => {
    const rows = [
      row({
        dateKey: "2026-10-05",
        entryCount: 0,
        proteinConsumed: 0,
        proteinGoal: 160,
        caloriesConsumed: 0,
        caloriesGoal: 2000,
      }),
      row({
        dateKey: "2026-10-06",
        proteinConsumed: 100,
        proteinGoal: 160,
        caloriesConsumed: 1800,
        caloriesGoal: 2000,
      }),
    ];
    const period = buildPeriodMacroBalance(rows, "2026-10-06");
    const protein = period.macros.find((m) => m.key === "protein")!;
    expect(protein.consumed).toBe(100);
    expect(protein.goal).toBe(160);

    const model = buildMacroBalanceViewModel(rows, "2026-10-06", "Tydzień");
    const empty = model.pastDays.find((d) => d.dateKey === "2026-10-05")!;
    expect(empty.status).toBe("empty");
    expect(empty.deviations).toEqual([]);
  });

  it("does not report deficit for the period when closed days are on target and today is in progress", () => {
    const rows = [
      row({
        dateKey: "2026-10-05",
        proteinConsumed: 150,
        proteinGoal: 150,
      }),
      row({
        dateKey: "2026-10-06",
        proteinConsumed: 10,
        proteinGoal: 150,
      }),
    ];
    const protein = buildPeriodMacroBalance(rows, "2026-10-06").macros.find(
      (m) => m.key === "protein",
    )!;
    expect(protein.isPartial).toBe(true);
    expect(protein.status).toBe("on_track");
    expect(protein.goal).toBe(300);
  });

  it("keeps the period status neutral when today is in progress and no closed day exists", () => {
    const rows = [
      row({
        dateKey: "2026-10-06",
        caloriesConsumed: 400,
        caloriesGoal: 2000,
      }),
    ];
    const kcal = buildPeriodMacroBalance(rows, "2026-10-06").macros.find(
      (m) => m.key === "calories",
    )!;
    expect(kcal.isPartial).toBe(true);
    expect(kcal.status).toBe("on_track");
    expect(kcal.direction).toBe("in_range");
  });

  it("formats signed amounts", () => {
    expect(formatSignedAmount(-32, "g")).toBe("-32 g");
    expect(formatSignedAmount(18, "g")).toBe("+18 g");
    expect(formatSignedPct(-15)).toBe("-15%");
    expect(formatSignedPct(22)).toBe("+22%");
  });
});
