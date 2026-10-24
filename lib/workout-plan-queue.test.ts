import { describe, expect, it } from "vitest";
import {
  comparePlansByWorkoutRecencyAsc,
  formatPlanLastDoneLabel,
  formatPlanLastDoneRelative,
  formatPlanLastDoneShort,
  pickNextWorkoutPlan,
} from "@/lib/workout-plan-queue";

describe("comparePlansByWorkoutRecencyAsc", () => {
  it("nigdy nie robione przed trenowanymi", () => {
    const never = { lastWorkoutDate: null, dayNumber: 3 };
    const done = { lastWorkoutDate: "2026-09-01", dayNumber: 1 };
    expect(comparePlansByWorkoutRecencyAsc(never, done)).toBeLessThan(0);
    expect(comparePlansByWorkoutRecencyAsc(done, never)).toBeGreaterThan(0);
  });

  it("najdawniejszy trening przed najnowszym", () => {
    const old = { lastWorkoutDate: "2026-08-01", dayNumber: 2 };
    const recent = { lastWorkoutDate: "2026-09-20", dayNumber: 1 };
    const list = [recent, old].sort(comparePlansByWorkoutRecencyAsc);
    expect(list.map((p) => p.lastWorkoutDate)).toEqual([
      "2026-08-01",
      "2026-09-20",
    ]);
  });

  it("remis dat → niższy numer dnia", () => {
    const d3 = { lastWorkoutDate: "2026-09-20", dayNumber: 3 };
    const d1 = { lastWorkoutDate: "2026-09-20", dayNumber: 1 };
    expect([d3, d1].sort(comparePlansByWorkoutRecencyAsc)).toEqual([d1, d3]);
  });

  it("dwa nigdy niewykonane → niższy numer dnia niezależnie od kolejności wejścia", () => {
    const d2 = { lastWorkoutDate: null, dayNumber: 2 };
    const d4 = { lastWorkoutDate: null, dayNumber: 4 };
    expect([d4, d2].sort(comparePlansByWorkoutRecencyAsc)).toEqual([d2, d4]);
    expect([d2, d4].sort(comparePlansByWorkoutRecencyAsc)).toEqual([d2, d4]);
  });
});

describe("pickNextWorkoutPlan", () => {
  const day = (dayNumber: number, lastWorkoutDate: string | null, exercises: number) => ({
    id: `p${dayNumber}`,
    dayNumber,
    lastWorkoutDate,
    plan: { exercises: Array.from({ length: exercises }, (_, i) => ({ i })) },
  });

  it("pomija pusty dzień, gdy istnieje dzień z ćwiczeniami", () => {
    const plans = [day(1, "2026-09-10", 4), day(2, null, 0), day(3, "2026-09-12", 5)];
    expect(pickNextWorkoutPlan(plans)?.id).toBe("p1");
  });

  it("zwraca pierwszy w kolejce pusty dzień, gdy wszystkie są puste", () => {
    const plans = [day(1, "2026-09-10", 0), day(2, null, 0)];
    expect(pickNextWorkoutPlan(plans)?.id).toBe("p2");
  });

  it("null dla pustej listy", () => {
    expect(pickNextWorkoutPlan([])).toBeNull();
  });

  it("nie mutuje wejścia", () => {
    const plans = Object.freeze([day(1, "2026-09-12", 3), day(2, "2026-09-01", 3)]);
    expect(pickNextWorkoutPlan(plans)?.id).toBe("p2");
    expect(plans.map((p) => p.id)).toEqual(["p1", "p2"]);
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

describe("formatPlanLastDoneRelative", () => {
  it("dokłada datę dd.mm przy względnej etykiecie", () => {
    expect(formatPlanLastDoneRelative("2026-10-03", "2026-10-03")).toMatch(
      /dziś/,
    );
    expect(formatPlanLastDoneRelative("2026-10-03", "2026-10-03")).toMatch(
      /03/,
    );
    expect(formatPlanLastDoneRelative("2026-09-28", "2026-10-03")).toMatch(
      /28/,
    );
  });
});
