import { describe, expect, it } from "vitest";
import {
  buildProgressIntensitySummary,
  compareRirToTarget,
  isHardSet,
  rirTrendOf,
  summarizeExerciseIntensity,
  summarizeSessionIntensity,
} from "@/lib/intensity-analysis";

describe("intensity-analysis", () => {
  it("oznacza twarde serie po RIR/RPE", () => {
    expect(isHardSet({ rir: 1, rpe: null })).toBe(true);
    expect(isHardSet({ rir: 2, rpe: 8 })).toBe(true);
    expect(isHardSet({ rir: 3, rpe: 7 })).toBe(false);
  });

  it("porównuje RIR z celem planu", () => {
    expect(compareRirToTarget(1, 2)).toBe("harder");
    expect(compareRirToTarget(3, 2)).toBe("easier");
    expect(compareRirToTarget(2, 2)).toBe("on");
    expect(compareRirToTarget(2.5, 2)).toBe("on");
  });

  it("ignoruje pominięte serie", () => {
    const s = summarizeExerciseIntensity({
      targetRir: 2,
      tempo: "3010",
      sets: [
        { done: true, rir: 1, rpe: 8 },
        { done: true, skipped: true, rir: 0, rpe: 10 },
        { done: false, rir: 4 },
      ],
    });
    expect(s.setsWithRir).toBe(1);
    expect(s.avgRir).toBe(1);
    expect(s.hardSets).toBe(1);
    expect(s.rirVsTarget).toBe("harder");
    expect(s.tempo).toBe("3010");
  });

  it("agreguje sesję i buduje podsumowanie hubu", () => {
    const a = summarizeSessionIntensity([
      {
        targetRir: 2,
        tempo: "2010",
        sets: [
          { done: true, rir: 2, rpe: 7 },
          { done: true, rir: 1, rpe: 8 },
        ],
      },
    ]);
    expect(a.avgRir).toBe(1.5);
    expect(a.hardSets).toBe(1);
    expect(a.targetOn).toBe(1); // 1.5 vs cel 2 — w tolerancji

    const b = summarizeSessionIntensity([
      {
        targetRir: 2,
        sets: [
          { done: true, rir: 0 },
          { done: true, rir: 0 },
        ],
      },
    ]);
    expect(b.targetHarder).toBe(1); // 0 vs cel 2

    const c = summarizeSessionIntensity([
      {
        targetRir: 2,
        sets: [
          { done: true, rir: 3 },
          { done: true, rir: 3 },
        ],
      },
    ]);
    expect(c.targetEasier).toBe(1);

    const summary = buildProgressIntensitySummary([a, b, c]);
    expect(summary.sessionsWithIntensity).toBe(3);
    expect(summary.avgRir).toBe(1.5); // (1.5 + 0 + 3) / 3
    expect(summary.rirTrend).toBe("up"); // 0 → 3
    expect(summary.temposUsed).toContain("2010");
    expect(summary.targetComparedCount).toBe(3);
    expect(summary.harderThanPlanCount).toBe(1);
    expect(summary.easierThanPlanCount).toBe(1);
  });

  it("wyznacza trend RIR", () => {
    expect(rirTrendOf(2, 2.5)).toBe("up");
    expect(rirTrendOf(2, 1.5)).toBe("down");
    expect(rirTrendOf(2, 2.2)).toBe("flat");
  });
});
