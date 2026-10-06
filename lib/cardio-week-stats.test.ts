import { describe, expect, it } from "vitest";
import {
  compareDaysThrough,
  compareWeeksThrough,
  emptyDayMinutes,
  sumMinutesThrough,
  throughDayIndexForToday,
  weekdayIndexMon0,
  type CardioWeekDays,
} from "@/lib/cardio-week-stats";

function week(
  monday: string,
  dayMinutes: number[],
  label = monday,
): CardioWeekDays {
  return {
    monday,
    label,
    dayMinutes,
    minutes: dayMinutes.reduce((a, b) => a + b, 0),
    distanceKm: 0,
    calories: 0,
    steps: 0,
    entries: dayMinutes.filter((m) => m > 0).length,
  };
}

describe("cardio-week-stats", () => {
  it("maps weekdays from monday", () => {
    expect(weekdayIndexMon0("2026-10-06", "2026-10-06")).toBe(0);
    expect(weekdayIndexMon0("2026-10-07", "2026-10-06")).toBe(1);
    expect(weekdayIndexMon0("2026-10-12", "2026-10-06")).toBe(6);
    expect(weekdayIndexMon0("2026-10-05", "2026-10-06")).toBe(-1);
  });

  it("sums through today and compares with previous week", () => {
    const current = week("2026-10-06", [30, 0, 40, 0, 0, 0, 0]);
    const previous = week("2026-09-29", [20, 10, 20, 30, 0, 0, 0]);
    const through = throughDayIndexForToday("2026-10-06", "2026-10-08"); // środa
    expect(through).toBe(2);
    expect(sumMinutesThrough(current.dayMinutes, through)).toBe(70);

    const cmp = compareWeeksThrough(current, previous, through, 150)!;
    expect(cmp.currentMinutes).toBe(70);
    expect(cmp.previousMinutes).toBe(50);
    expect(cmp.deltaMinutes).toBe(20);
    expect(cmp.deltaPct).toBe(40);

    const days = compareDaysThrough(current, previous, through);
    expect(days[0]!.deltaMinutes).toBe(10);
    expect(days[1]!.deltaMinutes).toBe(-10);
    expect(days[2]!.currentMinutes).toBe(40);
    expect(days[3]!.future).toBe(true);
  });

  it("handles empty previous week", () => {
    const current = week("2026-10-06", [15, 0, 0, 0, 0, 0, 0]);
    const previous = week("2026-09-29", emptyDayMinutes());
    const cmp = compareWeeksThrough(current, previous, 0, 150)!;
    expect(cmp.deltaPct).toBe(100);
    expect(cmp.previousMinutes).toBe(0);
  });
});
