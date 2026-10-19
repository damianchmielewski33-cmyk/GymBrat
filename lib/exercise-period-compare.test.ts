import { describe, expect, it } from "vitest";
import {
  buildExercisePeriodCompares,
  formatPeriodDeltaPct,
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

  it("formatPeriodDeltaPct", () => {
    expect(formatPeriodDeltaPct(12.5)).toBe("+12.5%");
    expect(formatPeriodDeltaPct(-3)).toBe("-3%");
    expect(formatPeriodDeltaPct(null)).toBe("—");
  });
});
