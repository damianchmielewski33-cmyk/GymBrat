import { describe, expect, it } from "vitest";
import type { WeekDayNutritionRow } from "@/lib/week-nutrition-rows";
import {
  buildPeriodCells,
  classifyPeriodDay,
  flattenWeekRows,
  formatKcalDelta,
  periodStartKey,
  summarizePeriod,
} from "@/lib/nutrition-period";

function row(dateKey: string, kcal: number, goal = 2600, entries = 1): WeekDayNutritionRow {
  return {
    dateKey,
    headline: dateKey,
    caloriesConsumed: kcal,
    caloriesGoal: goal,
    proteinConsumed: 0,
    proteinGoal: null,
    fatConsumed: 0,
    fatGoal: null,
    carbsConsumed: 0,
    carbsGoal: null,
    entryCount: entries,
    dayType: "rest",
  };
}

const TODAY = "2026-11-14"; // sobota

describe("nutrition-period", () => {
  it("klasyfikuje dni", () => {
    expect(classifyPeriodDay(row("2026-11-10", 2840), "2026-11-10", TODAY)).toEqual({
      status: "over",
      kcalDelta: 240,
    });
    expect(classifyPeriodDay(row("2026-11-11", 2220), "2026-11-11", TODAY).status).toBe("under");
    expect(classifyPeriodDay(row("2026-11-12", 2610), "2026-11-12", TODAY).status).toBe("ok");
    expect(classifyPeriodDay(undefined, "2026-11-09", TODAY).status).toBe("empty");
    expect(classifyPeriodDay(row(TODAY, 100), TODAY, TODAY).status).toBe("today");
    expect(classifyPeriodDay(undefined, "2026-11-15", TODAY).status).toBe("future");
  });

  it("okno 30 dni kończy się dziś", () => {
    expect(periodStartKey(TODAY, 30)).toBe("2026-10-16");
  });

  it("siatka kalendarza ma pełne tygodnie pn→nd", () => {
    const cells = buildPeriodCells([], "2026-10-16", TODAY, TODAY);
    expect(cells.length % 7).toBe(0);
    expect(cells[0]!.dateKey).toBe("2026-10-12");
    expect(cells[0]!.status).toBe("out");
    expect(cells.find((c) => c.dateKey === TODAY)!.status).toBe("today");
    expect(cells[cells.length - 1]!.dateKey).toBe("2026-11-15");
  });

  it("podsumowuje okres i wskazuje skrajne dni", () => {
    const rows = [row("2026-11-09", 2600), row("2026-11-10", 2840), row("2026-11-11", 2220)];
    const s = summarizePeriod(rows, TODAY);
    expect(s.counts).toEqual({ ok: 1, over: 1, under: 1 });
    expect(s.maxOver).toEqual({ dateKey: "2026-11-10", delta: 240 });
    expect(s.maxUnder).toEqual({ dateKey: "2026-11-11", delta: -380 });
    expect(Math.round(s.kcal.avgDelta ?? 0)).toBe(-47);
  });

  it("spłaszcza tygodnie bez duplikatów", () => {
    const a = { dayRows: [row("2026-11-10", 1), row("2026-11-09", 1)] };
    const b = { dayRows: [row("2026-11-10", 2)] };
    expect(flattenWeekRows([a, b]).map((r) => r.dateKey)).toEqual(["2026-11-09", "2026-11-10"]);
  });

  it("formatuje różnicę kcal", () => {
    expect(formatKcalDelta(96)).toBe("+96");
    expect(formatKcalDelta(-380)).toBe("−380");
    expect(formatKcalDelta(0)).toBe("0");
    expect(formatKcalDelta(null)).toBe("–");
  });
});
