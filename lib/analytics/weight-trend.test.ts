import { describe, expect, it } from "vitest";
import { computeWeightTrendKgPerWeek } from "@/lib/analytics/weight-trend";

describe("computeWeightTrendKgPerWeek", () => {
  it("uses a linear regression over at least three points and two weeks", () => {
    expect(computeWeightTrendKgPerWeek([
      { date: "2026-01-01", kg: 80 },
      { date: "2026-01-08", kg: 79.5 },
      { date: "2026-01-15", kg: 79 },
    ])).toBe(-0.5);
  });

  it("returns null when there are too few points or too little time span", () => {
    expect(computeWeightTrendKgPerWeek([
      { date: "2026-01-01", kg: 80 },
      { date: "2026-01-15", kg: 79 },
    ])).toBeNull();
    expect(computeWeightTrendKgPerWeek([
      { date: "2026-01-01", kg: 80 },
      { date: "2026-01-07", kg: 79.5 },
      { date: "2026-01-14", kg: 79 },
    ])).toBeNull();
  });
});
