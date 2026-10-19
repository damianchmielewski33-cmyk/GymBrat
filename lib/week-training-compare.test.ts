import { describe, expect, it } from "vitest";
import {
  buildWeekMetricCompare,
  buildWeekTrainingCompare,
} from "@/lib/week-training-compare";

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
  });
});
