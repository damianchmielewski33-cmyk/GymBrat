import { describe, expect, it } from "vitest";
import {
  buildWeekMetricCompare,
  buildWeekTrainingCompare,
  compareProgressWeekPicks,
  type ProgressWeekPick,
} from "@/lib/week-training-compare";

function pick(
  monday: string,
  opts: {
    isCurrent?: boolean;
    fullTonnage: number;
    partialTonnage: number;
    fullWorkouts?: number;
    partialWorkouts?: number;
  },
): ProgressWeekPick {
  const sunday = monday; // label-only in tests
  return {
    monday,
    sunday,
    label: monday,
    isCurrent: opts.isCurrent ?? false,
    full: {
      rangeEnd: sunday,
      rangeLabel: `full-${monday}`,
      workouts: opts.fullWorkouts ?? 3,
      tonnageKg: opts.fullTonnage,
      cardioMinutes: 30,
      avgRpe: null,
      avgRir: null,
    },
    partial: {
      rangeEnd: monday,
      rangeLabel: `partial-${monday}`,
      workouts: opts.partialWorkouts ?? 2,
      tonnageKg: opts.partialTonnage,
      cardioMinutes: 20,
      avgRpe: null,
      avgRir: null,
    },
  };
}

describe("week-training-compare", () => {
  it("marks tonnage up as progress", () => {
    const m = buildWeekMetricCompare({
      key: "tonnageKg",
      label: "Tonaż",
      unit: "t",
      current: 12,
      previous: 10,
      higherIsBetter: true,
    });
    expect(m.outcome).toBe("progress");
    expect(m.deltaPct).toBe(20);
  });

  it("marks lower RIR as progress (harder)", () => {
    const m = buildWeekMetricCompare({
      key: "avgRir",
      label: "Śr. RIR",
      unit: "",
      current: 1.5,
      previous: 2.5,
      higherIsBetter: false,
    });
    expect(m.outcome).toBe("progress");
  });

  it("verdict progress when majority improves", () => {
    const c = buildWeekTrainingCompare({
      thisRangeLabel: "a",
      prevRangeLabel: "b",
      workouts: { current: 4, previous: 3 },
      tonnageKg: { current: 20_000, previous: 15_000 },
      cardioMinutes: { current: 40, previous: 60 },
      avgRpe: { current: null, previous: null },
      avgRir: { current: null, previous: null },
    });
    expect(c.verdict).toBe("progress");
    expect(c.verdictLabel).toMatch(/Progres/);
  });

  it("uses full weeks when both picks are historical", () => {
    const a = pick("2026-10-06", {
      fullTonnage: 20_000,
      partialTonnage: 5_000,
    });
    const b = pick("2026-09-29", {
      fullTonnage: 10_000,
      partialTonnage: 9_000,
    });
    const c = compareProgressWeekPicks(a, b);
    expect(c.thisRangeLabel).toBe("full-2026-10-06");
    expect(c.prevRangeLabel).toBe("full-2026-09-29");
    const tonnage = c.metrics.find((m) => m.key === "tonnageKg");
    expect(tonnage?.current).toBe(20);
    expect(tonnage?.previous).toBe(10);
  });

  it("aligns to partial ranges when current week is selected", () => {
    const current = pick("2026-10-20", {
      isCurrent: true,
      fullTonnage: 8_000,
      partialTonnage: 8_000,
    });
    const past = pick("2026-10-13", {
      fullTonnage: 20_000,
      partialTonnage: 7_000,
    });
    const c = compareProgressWeekPicks(current, past);
    expect(c.thisRangeLabel).toBe("partial-2026-10-20");
    expect(c.prevRangeLabel).toBe("partial-2026-10-13");
    const tonnage = c.metrics.find((m) => m.key === "tonnageKg");
    expect(tonnage?.current).toBe(8);
    expect(tonnage?.previous).toBe(7);
  });
});
