import { describe, expect, it } from "vitest";
import {
  comparePlansByWorkoutRecencyAsc,
  formatPlanLastDoneLabel,
  formatPlanLastDoneShort,
} from "@/lib/workout-plan-queue";

describe("comparePlansByWorkoutRecencyAsc", () => {
  it("nigdy nie robione przed trenowanymi", () => {
    const never = { lastWorkoutDate: null, updatedAt: "2026-01-01" };
    const done = { lastWorkoutDate: "2026-09-01", updatedAt: "2026-01-02" };
    expect(comparePlansByWorkoutRecencyAsc(never, done)).toBeLessThan(0);
    expect(comparePlansByWorkoutRecencyAsc(done, never)).toBeGreaterThan(0);
  });

  it("najdawniejszy trening przed najnowszym", () => {
    const old = { lastWorkoutDate: "2026-08-01", updatedAt: "a" };
    const recent = { lastWorkoutDate: "2026-09-20", updatedAt: "b" };
    const list = [recent, old].sort(comparePlansByWorkoutRecencyAsc);
    expect(list.map((p) => p.lastWorkoutDate)).toEqual([
      "2026-08-01",
      "2026-09-20",
    ]);
  });
});

describe("formatPlanLastDoneLabel", () => {
  it("null → jeszcze nie", () => {
    expect(formatPlanLastDoneLabel(null)).toBe("jeszcze nie");
  });

  it("data → DD.MM", () => {
    expect(formatPlanLastDoneShort("2026-09-28")).toMatch(/28/);
    expect(formatPlanLastDoneLabel("2026-09-28")).toMatch(/28/);
  });
});
