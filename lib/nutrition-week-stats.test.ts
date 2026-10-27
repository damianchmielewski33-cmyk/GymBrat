import { describe, expect, it } from "vitest";
import type { WeekDayNutritionRow } from "@/lib/week-nutrition-rows";
import {
  adherenceDeltaPp,
  adherencePct,
  avgDayAdherencePct,
  avgWeeksAdherencePct,
  dayVsWeekAverageDelta,
  rollupMacroThroughIndex,
  rollupMacroWindow,
  rollupWeekThroughIndex,
} from "@/lib/nutrition-week-stats";

function row(
  partial: Partial<WeekDayNutritionRow> & Pick<WeekDayNutritionRow, "dateKey">,
): WeekDayNutritionRow {
  const base = {
    headline: partial.dateKey,
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

describe("rollupMacroThroughIndex", () => {
  it("does not let no-goal days inflate adherence", () => {
    const rows = [
      row({
        dateKey: "2026-10-05",
        caloriesConsumed: 2000,
        caloriesGoal: 2000,
      }),
      row({
        dateKey: "2026-10-06",
        caloriesConsumed: 2500,
        caloriesGoal: null,
      }),
    ];
    const t = rollupMacroThroughIndex(rows, 1, "calories");
    expect(t.consumed).toBe(2000);
    expect(t.goal).toBe(2000);
    expect(adherencePct(t.consumed, t.goal)).toBe(100);
  });

  it("counts zero-log days with goals toward under-adherence", () => {
    const rows = [
      row({
        dateKey: "2026-10-05",
        caloriesConsumed: 2000,
        caloriesGoal: 2000,
      }),
      row({
        dateKey: "2026-10-06",
        caloriesConsumed: 0,
        caloriesGoal: 2000,
      }),
    ];
    const t = rollupMacroThroughIndex(rows, 1, "calories");
    expect(t.consumed).toBe(2000);
    expect(t.goal).toBe(4000);
    expect(adherencePct(t.consumed, t.goal)).toBe(50);
  });

  it("respects through-index window", () => {
    const rows = [
      row({
        dateKey: "2026-10-05",
        caloriesConsumed: 1000,
        caloriesGoal: 2000,
      }),
      row({
        dateKey: "2026-10-06",
        caloriesConsumed: 2000,
        caloriesGoal: 2000,
      }),
      row({
        dateKey: "2026-10-07",
        caloriesConsumed: 3000,
        caloriesGoal: 2000,
      }),
    ];
    const t = rollupMacroThroughIndex(rows, 1, "calories");
    expect(t.consumed).toBe(3000);
    expect(t.goal).toBe(4000);
    expect(adherencePct(t.consumed, t.goal)).toBe(75);
  });
});

describe("adherenceDeltaPp", () => {
  it("uses percentage points not relative % of %", () => {
    expect(adherenceDeltaPp(95, 90)).toBe(5);
    expect(adherenceDeltaPp(90, 100)).toBe(-10);
  });
});

describe("avgDayAdherencePct", () => {
  it("averages raw ratios then rounds once", () => {
    const rows = [
      row({
        dateKey: "2026-10-05",
        caloriesConsumed: 1990,
        caloriesGoal: 2000,
      }), // 99.5%
      row({
        dateKey: "2026-10-06",
        caloriesConsumed: 2010,
        caloriesGoal: 2000,
      }), // 100.5%
    ];
    // avg ratio = 1.0 → 100%, not avg of rounded 100 and 101
    expect(avgDayAdherencePct(rows, "2026-10-06", "calories")).toBe(100);
  });

  it("includes zero-consumption goal days", () => {
    const rows = [
      row({
        dateKey: "2026-10-05",
        caloriesConsumed: 2000,
        caloriesGoal: 2000,
      }),
      row({
        dateKey: "2026-10-06",
        caloriesConsumed: 0,
        caloriesGoal: 2000,
      }),
    ];
    expect(avgDayAdherencePct(rows, "2026-10-06", "calories")).toBe(50);
  });
});

describe("dayVsWeekAverageDelta", () => {
  it("returns pp delta vs week day average", () => {
    const rows = [
      row({
        dateKey: "2026-10-05",
        caloriesConsumed: 2000,
        caloriesGoal: 2000,
      }),
      row({
        dateKey: "2026-10-06",
        caloriesConsumed: 1000,
        caloriesGoal: 2000,
      }),
    ];
    // day2 = 50%, avg = 75% → -25 pp
    expect(
      dayVsWeekAverageDelta(rows[1]!, rows, "2026-10-06", "calories"),
    ).toBe(-25);
  });
});

describe("avgWeeksAdherencePct", () => {
  it("averages week ratios for the same weekday window", () => {
    const w1 = [
      row({
        dateKey: "2026-09-28",
        caloriesConsumed: 2000,
        caloriesGoal: 2000,
      }),
      row({
        dateKey: "2026-09-29",
        caloriesConsumed: 2000,
        caloriesGoal: 2000,
      }),
    ];
    const w2 = [
      row({
        dateKey: "2026-09-21",
        caloriesConsumed: 1000,
        caloriesGoal: 2000,
      }),
      row({
        dateKey: "2026-09-22",
        caloriesConsumed: 1000,
        caloriesGoal: 2000,
      }),
    ];
    // 100% and 50% → 75%
    expect(avgWeeksAdherencePct([w1, w2], 1, "calories")).toBe(75);
  });
});

describe("rollupMacroWindow", () => {
  it("excludes no_entries from goal sum (AU-4)", () => {
    const rows = [
      row({
        dateKey: "2026-10-05",
        entryCount: 0,
        caloriesConsumed: 0,
        caloriesGoal: 2000,
      }),
      row({
        dateKey: "2026-10-06",
        caloriesConsumed: 1800,
        caloriesGoal: 2000,
      }),
    ];
    const t = rollupMacroWindow(rows, "2026-10-06", "calories", {
      includeFutureDays: false,
      includeInProgressGoal: "only_if_consumed",
    });
    expect(t.consumed).toBe(1800);
    expect(t.goal).toBe(2000);
    expect(t.daysNoEntries).toBeGreaterThanOrEqual(1);
  });

  it("includes today goal only when consumed (BR-5)", () => {
    const rows = [
      row({
        dateKey: "2026-10-06",
        entryCount: 0,
        caloriesConsumed: 0,
        caloriesGoal: 2000,
      }),
    ];
    const without = rollupMacroWindow(rows, "2026-10-06", "calories", {
      includeFutureDays: false,
      includeInProgressGoal: "only_if_consumed",
    });
    expect(without.goal).toBeNull();
    expect(without.consumed).toBe(0);

    const withAlways = rollupMacroWindow(rows, "2026-10-06", "calories", {
      includeFutureDays: false,
      includeInProgressGoal: "always",
    });
    expect(withAlways.goal).toBe(2000);
  });

  it("documents includeFutureDays true vs false", () => {
    const rows = [
      row({
        dateKey: "2026-10-06",
        caloriesConsumed: 1000,
        caloriesGoal: 2000,
      }),
      row({
        dateKey: "2026-10-07",
        entryCount: 0,
        caloriesConsumed: 0,
        caloriesGoal: 2000,
      }),
    ];
    const toToday = rollupMacroWindow(rows, "2026-10-06", "calories", {
      includeFutureDays: false,
      includeInProgressGoal: "only_if_consumed",
    });
    const full = rollupMacroWindow(rows, "2026-10-06", "calories", {
      includeFutureDays: true,
      includeInProgressGoal: "always",
    });
    expect(toToday.goal).toBe(2000);
    expect(full.goal).toBe(4000);
  });
});

describe("rollupWeekThroughIndex", () => {
  it("rolls all macros consistently", () => {
    const rows = [
      row({
        dateKey: "2026-10-05",
        caloriesConsumed: 2000,
        caloriesGoal: 2200,
        proteinConsumed: 150,
        proteinGoal: 160,
        carbsConsumed: 200,
        carbsGoal: 220,
        fatConsumed: 60,
        fatGoal: 70,
      }),
    ];
    const r = rollupWeekThroughIndex(rows, 0);
    expect(r.calories.goal).toBe(2200);
    expect(r.protein.consumed).toBe(150);
    expect(adherencePct(r.protein.consumed, r.protein.goal)).toBe(94);
  });
});
