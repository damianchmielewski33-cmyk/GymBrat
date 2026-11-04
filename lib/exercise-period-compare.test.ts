import { describe, expect, it } from "vitest";
import {
  buildExercisePeriodCompares,
  buildExerciseRangeCompare,
  formatPeriodDeltaPct,
  normalizeCompareRange,
  shortPeriodAxisLabel,
} from "@/lib/exercise-period-compare";
import type { ExerciseProgressPoint } from "@/lib/exercise-progress";

function pt(
  date: string,
  opts: Partial<ExerciseProgressPoint> = {},
): ExerciseProgressPoint {
  return {
    date,
    bestE1rm: 100,
    bestWeight: 80,
    bestReps: 8,
    tonnageKg: 800,
    totalReps: 24,
    avgRir: 2,
    avgRpe: 8,
    targetRir: 2,
    tempo: null,
    rirVsTarget: "on",
    ...opts,
  };
}

describe("buildExercisePeriodCompares", () => {
  it("detects week-over-week progress on e1RM and volume", () => {
    const points: ExerciseProgressPoint[] = [
      // prev week (Mon 2026-03-02)
      pt("2026-03-02", { bestE1rm: 100, tonnageKg: 700 }),
      pt("2026-03-04", { bestE1rm: 102, tonnageKg: 720 }),
      // this week (Mon 2026-03-09)
      pt("2026-03-09", { bestE1rm: 110, tonnageKg: 900 }),
      pt("2026-03-11", { bestE1rm: 112, tonnageKg: 920 }),
    ];
    const cmp = buildExercisePeriodCompares(points, "kg");
    expect(cmp.week.verdict).toBe("progress");
    expect(cmp.week.metrics.find((m) => m.key === "bestE1rm")?.deltaPct).toBeGreaterThan(
      0,
    );
    expect(cmp.week.rising.length).toBeGreaterThan(0);
  });

  it("builds month and year series", () => {
    const points: ExerciseProgressPoint[] = [
      pt("2025-01-10", { bestE1rm: 90, tonnageKg: 500 }),
      pt("2025-06-10", { bestE1rm: 95, tonnageKg: 600 }),
      pt("2026-01-10", { bestE1rm: 105, tonnageKg: 800 }),
      pt("2026-03-10", { bestE1rm: 110, tonnageKg: 850 }),
    ];
    const cmp = buildExercisePeriodCompares(points, "kg");
    expect(cmp.month.series.length).toBeGreaterThanOrEqual(2);
    expect(cmp.year.series.length).toBe(2);
    expect(cmp.year.verdict).toBe("progress");
  });

  it("compares calendar quarters (3 months)", () => {
    const cmp = buildExercisePeriodCompares(
      [
        pt("2026-01-10", { bestE1rm: 100 }),
        pt("2026-03-10", { bestE1rm: 102 }),
        pt("2026-04-10", { bestE1rm: 108 }),
        pt("2026-06-10", { bestE1rm: 110 }),
      ],
      "kg",
    );
    expect(cmp.quarter.verdict).toBe("progress");
    expect(cmp.quarter.currentLabel).toBe("II kw. 2026");
    expect(cmp.quarter.previousLabel).toBe("I kw. 2026");
    expect(cmp.quarter.lowConfidence).toBe(false);
    expect(shortPeriodAxisLabel("quarter", "2026-Q2")).toBe("Q2 '26");
  });

  it("assigns quarter boundaries correctly", () => {
    const cmp = buildExercisePeriodCompares(
      [pt("2026-03-31"), pt("2026-04-01"), pt("2026-12-31")],
      "kg",
    );
    expect(cmp.quarter.series.map((s) => s.key)).toEqual([
      "2026-Q1",
      "2026-Q2",
      "2026-Q4",
    ]);
  });

  it("flags low confidence when a period has fewer than 2 sessions", () => {
    const cmp = buildExercisePeriodCompares(
      [
        pt("2026-03-02", { bestE1rm: 100 }),
        pt("2026-03-04", { bestE1rm: 100 }),
        pt("2026-03-09", { bestE1rm: 90 }),
      ],
      "kg",
    );
    expect(cmp.week.lowConfidence).toBe(true);
  });

  it("compares a custom range with the previous range of equal length", () => {
    const points = [
      pt("2026-09-05", { bestE1rm: 100 }),
      pt("2026-09-20", { bestE1rm: 101 }),
      pt("2026-10-05", { bestE1rm: 108 }),
      pt("2026-10-20", { bestE1rm: 110 }),
    ];
    const cmp = buildExerciseRangeCompare(points, "kg", "2026-10-01", "2026-10-31");
    expect(cmp.kind).toBe("range");
    expect(cmp.verdict).toBe("progress");
    expect(cmp.lowConfidence).toBe(false);
    expect(cmp.series.length).toBeGreaterThanOrEqual(2);
    const e1rm = cmp.metrics.find((m) => m.key === "bestE1rm");
    expect(e1rm?.previous).toBe(100.5);
    expect(e1rm?.current).toBe(109);
  });

  it("includes both range ends and excludes neighbouring days", () => {
    const cmp = buildExerciseRangeCompare(
      [
        pt("2026-09-30"),
        pt("2026-10-01"),
        pt("2026-10-31"),
        pt("2026-09-01"),
        pt("2026-08-31"),
        pt("2026-08-30"),
        pt("2026-11-01"),
      ],
      "kg",
      "2026-10-01",
      "2026-10-31",
    );
    const sessions = cmp.metrics.find((m) => m.key === "sessions");
    expect(sessions?.current).toBe(2);
    // poprzedni zakres = 31.08–30.09 (31 dni)
    expect(sessions?.previous).toBe(3);
  });

  it("rejects invalid ranges and returns insufficient", () => {
    expect(normalizeCompareRange("2026-10-31", "2026-10-01")).toBeNull();
    expect(normalizeCompareRange("2026-02-31", "2026-03-05")).toBeNull();
    expect(normalizeCompareRange("abc", "2026-03-05")).toBeNull();
    expect(normalizeCompareRange("2020-01-01", "2026-03-05")).toBeNull();
    expect(normalizeCompareRange("2026-10-01", "2026-10-01")?.days).toBe(1);
    expect(
      buildExerciseRangeCompare([pt("2026-10-05")], "kg", "2026-10-31", "2026-10-01")
        .verdict,
    ).toBe("insufficient");
  });

  it("does not invent a baseline when the previous range has no sessions", () => {
    const cmp = buildExerciseRangeCompare(
      [pt("2026-10-05")],
      "kg",
      "2026-10-01",
      "2026-10-31",
    );
    expect(cmp.verdict).toBe("insufficient");
    expect(cmp.metrics).toHaveLength(0);
  });

  it("formatPeriodDeltaPct", () => {
    expect(formatPeriodDeltaPct(12.5)).toBe("+12.5%");
    expect(formatPeriodDeltaPct(-3)).toBe("-3%");
    expect(formatPeriodDeltaPct(null)).toBe("—");
  });
});
