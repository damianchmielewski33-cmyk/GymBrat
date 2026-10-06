import { describe, expect, it } from "vitest";
import type { WeekDayNutritionRow } from "@/lib/week-nutrition-rows";
import {
  buildDayMacroBalance,
  buildPeriodMacroBalance,
  classifyMacroBalance,
  collectDayHighlights,
  dayRelativeLabel,
  formatSignedAmount,
  formatSignedPct,
} from "@/lib/nutrition-day-balance";

function row(
  partial: Partial<WeekDayNutritionRow> & Pick<WeekDayNutritionRow, "dateKey">,
): WeekDayNutritionRow {
  return {
    headline: partial.headline ?? partial.dateKey,
    caloriesConsumed: 0,
    caloriesGoal: null,
    proteinConsumed: 0,
    proteinGoal: null,
    fatConsumed: 0,
    fatGoal: null,
    carbsConsumed: 0,
    carbsGoal: null,
    ...partial,
  };
}

describe("nutrition-day-balance", () => {
  it("classifies small deltas as on_track", () => {
    expect(classifyMacroBalance(0.4, 2)).toBe("on_track");
    expect(classifyMacroBalance(12, 4)).toBe("on_track");
    expect(classifyMacroBalance(-20, -12)).toBe("deficit");
    expect(classifyMacroBalance(18, 22)).toBe("surplus");
  });

  it("builds day balance with deficit protein and surplus fat", () => {
    const day = buildDayMacroBalance(
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

    expect(day.isToday).toBe(true);
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

    expect(day.highlights.map((h) => h.key).sort()).toEqual([
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
    expect(protein.status).toBe("deficit");

    const fat = period.macros.find((m) => m.key === "fat")!;
    expect(fat.consumed).toBe(160);
    expect(fat.goal).toBe(140);
    expect(fat.status).toBe("surplus");

    const days = rows
      .filter((r) => r.dateKey <= "2026-10-06")
      .map((r) => buildDayMacroBalance(r, "2026-10-06"));
    const highlights = collectDayHighlights(days);
    expect(highlights[0]?.day.isToday).toBe(true);
    expect(highlights.some((h) => h.macro.key === "fat" && !h.day.isToday)).toBe(
      true,
    );
  });

  it("formats signed amounts and relative day labels", () => {
    expect(formatSignedAmount(-32, "g")).toBe("-32 g");
    expect(formatSignedAmount(18, "g")).toBe("+18 g");
    expect(formatSignedPct(-15)).toBe("-15%");
    expect(formatSignedPct(22)).toBe("+22%");

    const today = buildDayMacroBalance(
      row({ dateKey: "2026-10-06" }),
      "2026-10-06",
    );
    const yesterday = buildDayMacroBalance(
      row({ dateKey: "2026-10-05" }),
      "2026-10-06",
    );
    expect(dayRelativeLabel(today, "2026-10-06")).toBe("Dziś");
    expect(dayRelativeLabel(yesterday, "2026-10-06")).toBe("Wczoraj");
  });
});
