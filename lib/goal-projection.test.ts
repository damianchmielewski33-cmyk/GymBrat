import { describe, expect, it } from "vitest";
import { projectToTarget, targetE1rm } from "@/lib/goal-projection";

const pts = (vals: number[]) =>
  vals.map((value, i) => ({
    date: `2026-10-${String(1 + i * 7).padStart(2, "0")}`,
    value,
  }));

describe("projectToTarget", () => {
  it("redukcja: ETA z trendu i on_track bez terminu", () => {
    const r = projectToTarget({ points: pts([90, 89, 88, 87]), target: 84, today: "2026-10-22" });
    expect(r.status).toBe("on_track");
    expect(r.ratePerWeek).toBeCloseTo(-1, 1);
    expect(r.etaDate).not.toBeNull();
  });

  it("trend w złą stronę", () => {
    const r = projectToTarget({ points: pts([80, 81, 82]), target: 75, today: "2026-10-15" });
    expect(r.status).toBe("wrong_direction");
  });

  it("po terminie, gdy ETA za terminem", () => {
    const r = projectToTarget({
      points: pts([90, 89.5, 89]),
      target: 80,
      deadline: "2026-11-15",
      today: "2026-10-15",
    });
    expect(r.status).toBe("behind");
    expect(r.requiredPerWeek).toBeLessThan(0);
  });

  it("cel osiągnięty i za mało punktów", () => {
    expect(projectToTarget({ points: pts([100, 105]), target: 102, today: "2026-10-10" }).status).toBe("reached");
    expect(projectToTarget({ points: pts([100, 101]), target: 110, today: "2026-10-10" }).status).toBe("unknown");
  });

  it("targetE1rm", () => {
    expect(targetE1rm(100, 5)).toBeCloseTo(116.67, 1);
    expect(targetE1rm(100)).toBeCloseTo(103.33, 1);
  });
});
