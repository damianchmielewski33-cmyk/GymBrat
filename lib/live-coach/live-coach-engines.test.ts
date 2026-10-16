import { describe, expect, it } from "vitest";
import {
  buildE1rmTrendReport,
  classifyE1rmTrend,
  setE1rm,
} from "@/lib/live-coach/e1rm-trend";
import { computeConfidence } from "@/lib/live-coach/confidence";
import { computeExerciseLocalFatigue } from "@/lib/live-coach/fatigue";
import { hrReadinessAdjust } from "@/lib/live-coach/hr-signals";
import {
  resolveEffectiveTargetRir,
  resolveMovementProfile,
} from "@/lib/live-coach/movement-profiles";
import { detectPersonalRecords } from "@/lib/live-coach/personal-records";
import {
  readinessBand,
  resolveProgressionBump,
} from "@/lib/live-coach/progression-bumps";
import { computeReadiness } from "@/lib/live-coach/readiness";
import {
  fatigueDropSensitivityFromRest,
  shouldIgnoreFatigueDrop,
} from "@/lib/live-coach/rest-awareness";
import { detectSuspiciousSet } from "@/lib/live-coach/suspicious-data";
import { isStagnantV2 } from "@/lib/last-workout-hints";
import type { SessionSnapForTrends } from "@/lib/live-coach/types";

describe("e1rm-trend", () => {
  it("Epley: 100×5 ≈ 116.7", () => {
    expect(setE1rm(100, 5)).toBeCloseTo(100 * (1 + 5 / 30), 5);
  });

  it("rosnący e1RM przy spadających reps = up", () => {
    const sessions: SessionSnapForTrends[] = [
      { topKg: 110, bestReps: 3, bestE1rm: setE1rm(110, 3), avgRir: 1, volumeKg: 900 },
      { topKg: 100, bestReps: 5, bestE1rm: setE1rm(100, 5), avgRir: 1, volumeKg: 900 },
      { topKg: 95, bestReps: 6, bestE1rm: setE1rm(95, 6), avgRir: 2, volumeKg: 850 },
    ];
    expect(classifyE1rmTrend(sessions)).toBe("up");
    const report = buildE1rmTrendReport(sessions);
    expect(report.trend4).toBe("up");
    expect(report.last).toBeGreaterThan(report.avg ?? 0);
  });
});

describe("suspicious-data", () => {
  it("RPE10 + RIR5 → suspicious", () => {
    const r = detectSuspiciousSet({
      weight: 60,
      reps: 8,
      rir: 5,
      rpe: 10,
    });
    expect(r.suspicious).toBe(true);
    expect(r.confidencePenalty).toBeGreaterThan(20);
  });

  it("PR kg + PR reps + RIR4 → suspicious", () => {
    const r = detectSuspiciousSet({
      weight: 80,
      reps: 10,
      rir: 4,
      isWeightPr: true,
      isRepPr: true,
    });
    expect(r.suspicious).toBe(true);
  });

  it("skok 15%+ ciężaru → suspicious", () => {
    const r = detectSuspiciousSet({
      weight: 120,
      reps: 5,
      rir: 2,
      priorTopKg: 100,
    });
    expect(r.suspicious).toBe(true);
    expect(r.reasons.some((x) => x.includes("15%"))).toBe(true);
  });
});

describe("confidence", () => {
  it("więcej historii → wyższa confidence", () => {
    const low = computeConfidence({
      recentSessionCount: 0,
      hasConflict: false,
      missingEffortData: true,
      missingWeightOrReps: true,
      suspicious: { suspicious: false, reasons: [], confidencePenalty: 0 },
      e1rm: {
        last: null,
        avg: null,
        best: null,
        trend4: "flat",
        delta: null,
        sessionCount: 0,
      },
      fatigue: {
        score: 20,
        factors: {
          sessionVolume: 0,
          hardSets: 0,
          warnSets: 0,
          exerciseIndex: 0,
          shortRests: 0,
          durationMinutes: null,
        },
      },
    });
    const high = computeConfidence({
      recentSessionCount: 4,
      hasConflict: false,
      missingEffortData: false,
      missingWeightOrReps: false,
      suspicious: { suspicious: false, reasons: [], confidencePenalty: 0 },
      e1rm: {
        last: 120,
        avg: 118,
        best: 122,
        trend4: "up",
        delta: 4,
        sessionCount: 4,
      },
      volumeConsistency: 0.9,
      fatigue: {
        score: 25,
        factors: {
          sessionVolume: 1000,
          hardSets: 0,
          warnSets: 0,
          exerciseIndex: 0,
          shortRests: 0,
          durationMinutes: 40,
        },
      },
    });
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("conflict obniża confidence, nie ukrywa score", () => {
    const c = computeConfidence({
      recentSessionCount: 3,
      hasConflict: true,
      missingEffortData: false,
      missingWeightOrReps: false,
      suspicious: { suspicious: true, reasons: ["x"], confidencePenalty: 25 },
      e1rm: {
        last: 100,
        avg: 100,
        best: 100,
        trend4: "flat",
        delta: 0,
        sessionCount: 3,
      },
      fatigue: {
        score: 40,
        factors: {
          sessionVolume: 0,
          hardSets: 1,
          warnSets: 1,
          exerciseIndex: 0,
          shortRests: 0,
          durationMinutes: null,
        },
      },
    });
    expect(c.score).toBeLessThan(50);
    expect(c.score).toBeGreaterThanOrEqual(0);
  });
});

describe("readiness", () => {
  const baseFatigue = {
    score: 20,
    factors: {
      sessionVolume: 500,
      hardSets: 0,
      warnSets: 0,
      exerciseIndex: 0,
      shortRests: 0,
      durationMinutes: 30,
    },
  };
  const flatE1 = {
    last: 100,
    avg: 100,
    best: 100,
    trend4: "flat" as const,
    delta: 0,
    sessionCount: 3,
  };
  const noPr = {
    isWeightPr: false,
    isRepPr: false,
    isVolumePr: false,
    isE1rmPr: false,
    anyPr: false,
  };

  it("wysoki RIR + rosnący e1RM → progress_ready / normal", () => {
    const r = computeReadiness({
      lastRir: 3,
      e1rm: { ...flatE1, trend4: "up", last: 110, avg: 105, best: 110 },
      hardStreak: 0,
      warnStreak: 0,
      stagnant: false,
      fatigue: baseFatigue,
      prs: noPr,
    });
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(["progress_ready", "normal"]).toContain(r.band);
  });

  it("layoff obniża readiness", () => {
    const r = computeReadiness({
      lastRir: 2,
      e1rm: flatE1,
      hardStreak: 0,
      warnStreak: 0,
      daysSinceLastSession: 21,
      stagnant: false,
      fatigue: baseFatigue,
      prs: noPr,
    });
    expect(r.score).toBeLessThan(70);
  });

  it("PR zwiększa readiness", () => {
    const without = computeReadiness({
      lastRir: 2,
      e1rm: flatE1,
      hardStreak: 0,
      warnStreak: 0,
      stagnant: false,
      fatigue: baseFatigue,
      prs: noPr,
    });
    const withPr = computeReadiness({
      lastRir: 2,
      e1rm: flatE1,
      hardStreak: 0,
      warnStreak: 0,
      stagnant: false,
      fatigue: baseFatigue,
      prs: {
        isWeightPr: true,
        isRepPr: false,
        isVolumePr: false,
        isE1rmPr: true,
        anyPr: true,
      },
    });
    expect(withPr.score).toBeGreaterThan(without.score);
  });
});

describe("fatigue", () => {
  it("więcej hard sets → wyższy fatigue", () => {
    const low = computeExerciseLocalFatigue(
      [{ reps: 8, weight: 40, done: true, rir: 2 }],
      1,
    );
    const high = computeExerciseLocalFatigue(
      [
        { reps: 6, weight: 50, done: true, rir: 0 },
        { reps: 5, weight: 50, done: true, rir: 0 },
        { reps: 5, weight: 50, done: true, rir: 0 },
      ],
      3,
    );
    expect(high.score).toBeGreaterThan(low.score);
  });
});

describe("stagnation 2.0", () => {
  it("rosnący e1RM → nie stagnacja", () => {
    expect(
      isStagnantV2([
        { topKg: 100, bestReps: 4, bestE1rm: 115, avgRir: 0.5 },
        { topKg: 100, bestReps: 5, bestE1rm: 112, avgRir: 0.5 },
        { topKg: 100, bestReps: 6, bestE1rm: 110, avgRir: 0.5 },
      ]),
    ).toBe(false);
  });

  it("brak wzrostu kg/reps/e1RM + niski RIR → stagnacja", () => {
    expect(
      isStagnantV2([
        { topKg: 100, bestReps: 5, bestE1rm: 116.7, avgRir: 0.5 },
        { topKg: 100, bestReps: 5, bestE1rm: 116.7, avgRir: 1 },
        { topKg: 100, bestReps: 5, bestE1rm: 116.7, avgRir: 0 },
      ]),
    ).toBe(true);
  });

  it("średni RIR > 1 → nie stagnacja", () => {
    expect(
      isStagnantV2([
        { topKg: 100, bestReps: 5, bestE1rm: 116, avgRir: 2 },
        { topKg: 100, bestReps: 5, bestE1rm: 116, avgRir: 2 },
        { topKg: 100, bestReps: 5, bestE1rm: 116, avgRir: 3 },
      ]),
    ).toBe(false);
  });
});

describe("rest-awareness", () => {
  it("rest <60s zmniejsza czułość fatigue drop", () => {
    expect(fatigueDropSensitivityFromRest(45)).toBeLessThan(0.5);
    expect(
      shouldIgnoreFatigueDrop({ repsDrop: 2, restSeconds: 45, setIndex: 1 }),
    ).toBe(true);
  });

  it("rest 90–180 → normalna interpretacja", () => {
    expect(fatigueDropSensitivityFromRest(120)).toBe(1);
    expect(
      shouldIgnoreFatigueDrop({ repsDrop: 2, restSeconds: 120, setIndex: 1 }),
    ).toBe(false);
  });
});

describe("movement-profiles", () => {
  it("Deadlift targetRIR 2–3", () => {
    const p = resolveMovementProfile("Conventional Deadlift");
    expect(p.targetRirMin).toBe(2);
    expect(p.targetRirMax).toBe(3);
  });

  it("Biceps curl 0–1; calves 0", () => {
    expect(resolveMovementProfile("Biceps Curl").targetRirMax).toBe(1);
    expect(resolveMovementProfile("Standing Calf Raise").targetRir).toBe(0);
  });

  it("plan targetRir ma pierwszeństwo", () => {
    expect(resolveEffectiveTargetRir(3, "Bench Press")).toBe(3);
    expect(resolveEffectiveTargetRir(null, "Bench Press")).toBe(1);
  });
});

describe("progression-bumps", () => {
  it("readiness 95+ confidence 90+ → aggressive", () => {
    const b = resolveProgressionBump({
      readiness: 96,
      confidence: 92,
      allowWeightBump: true,
    });
    expect(b.kind).toBe("aggressive");
    expect(b.stepKg).toBe(5);
  });

  it("readiness 70 → normal", () => {
    expect(
      resolveProgressionBump({
        readiness: 75,
        confidence: 70,
        allowWeightBump: true,
      }).kind,
    ).toBe("normal");
  });

  it("readiness 45 → hold", () => {
    expect(readinessBand(45)).toBe("hold");
    expect(
      resolveProgressionBump({
        readiness: 45,
        confidence: 80,
        allowWeightBump: true,
      }).kind,
    ).toBe("hold");
  });
});

describe("hr-signals", () => {
  it("słaba regeneracja obniża readiness, nie wymusza deloadu sama", () => {
    const bad = hrReadinessAdjust({ restingHR: 60, recoveryHR: 100 });
    expect(bad.readinessDelta).toBeLessThan(0);
    const good = hrReadinessAdjust({ restingHR: 60, recoveryHR: 65 });
    expect(good.readinessDelta).toBeGreaterThan(0);
  });
});

describe("personal-records", () => {
  it("wykrywa weight PR", () => {
    const pr = detectPersonalRecords({
      currentSets: [{ weight: 105, reps: 5 }],
      baseline: { weightKg: 100, reps: 5, volumeKg: 500, e1rm: 116 },
    });
    expect(pr.isWeightPr).toBe(true);
    expect(pr.anyPr).toBe(true);
  });
});
