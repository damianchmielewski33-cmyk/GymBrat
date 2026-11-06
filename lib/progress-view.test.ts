import { describe, expect, it } from "vitest";
import {
  buildChartModel,
  exerciseChange,
  filterByRange,
  nearestPointIndex,
  setE1rm,
  weeklyProgressSeries,
} from "@/lib/progress-view";

describe("progress-view", () => {
  it("szacowany max = ciężar × (1 + powt./30)", () => {
    expect(setE1rm(100, 3)).toBeCloseTo(110, 5);
    expect(setE1rm(0, 5)).toBe(0);
  });

  it("filtruje zakres włącznie z dniem dzisiejszym", () => {
    const pts = [{ date: "2026-10-07" }, { date: "2026-10-08" }, { date: "2026-11-06" }];
    expect(filterByRange(pts, "1M", "2026-11-06").map((p) => p.date)).toEqual([
      "2026-10-08",
      "2026-11-06",
    ]);
    expect(filterByRange(pts, "all", "2026-11-06")).toHaveLength(3);
  });

  it("model wykresu daje punkty w ramce i linię celu w zakresie osi", () => {
    const m = buildChartModel([66, 67, 66.5], [65]);
    expect(m.points).toHaveLength(3);
    expect(m.min).toBeLessThan(65);
    expect(m.yOf(65)).toBeGreaterThan(m.yOf(67));
    expect(m.line.startsWith("M")).toBe(true);
    expect(buildChartModel([5]).area).toBe("");
  });

  it("wybiera najbliższy punkt", () => {
    expect(nearestPointIndex(0, 5)).toBe(0);
    expect(nearestPointIndex(1000, 5)).toBe(4);
    expect(nearestPointIndex(187, 3)).toBe(1);
  });

  it("progres tydzień po tygodniu liczy zmianę względem ostatniego tygodnia z danymi", () => {
    const history = [
      { date: "2026-10-05", bestE1rm: 100 }, // pon.
      { date: "2026-10-21", bestE1rm: 105 }, // śr., 2 tygodnie później
      { date: "2026-10-22", bestE1rm: 108 },
    ];
    const cells = weeklyProgressSeries(history, ["2026-10-05", "2026-10-12", "2026-10-19"]);
    expect(cells[0]).toEqual({ monday: "2026-10-05", value: 100, delta: null });
    expect(cells[1]!.value).toBeNull();
    expect(cells[2]).toEqual({ monday: "2026-10-19", value: 108, delta: 8 });
  });

  it("klasyfikuje ćwiczenie jako rośnie / stoi / spada", () => {
    const up = exerciseChange(
      [
        { date: "2026-09-20", bestE1rm: 100 },
        { date: "2026-10-30", bestE1rm: 110 },
      ],
      "2026-11-06",
    );
    expect(up).toMatchObject({ status: "up", deltaKg: 10, currentE1rm: 110 });
    const flat = exerciseChange(
      [
        { date: "2026-09-20", bestE1rm: 152 },
        { date: "2026-10-30", bestE1rm: 152 },
      ],
      "2026-11-06",
    );
    expect(flat.status).toBe("flat");
    const down = exerciseChange(
      [
        { date: "2026-09-20", bestE1rm: 61 },
        { date: "2026-10-30", bestE1rm: 58 },
      ],
      "2026-11-06",
    );
    expect(down.status).toBe("down");
  });
});
