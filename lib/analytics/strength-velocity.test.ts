import { describe, expect, it } from "vitest";
import {
  computeStrengthVelocity,
  pickVelocity,
  velocityTone,
} from "@/lib/analytics/strength-velocity";
import type { ExerciseSessionPoint } from "@/lib/analytics/types";

function pt(
  date: string,
  bestE1rm: number,
  volumeKg: number,
): ExerciseSessionPoint {
  return {
    date,
    volumeKg,
    totalReps: 20,
    bestE1rm,
    bestWeight: bestE1rm,
    bestReps: 5,
    hardSets: 0,
    scoredSets: 2,
    avgRpe: null,
    avgRir: null,
  };
}

describe("strength-velocity", () => {
  it("computes overall volume and mean e1RM windows", () => {
    const snap = computeStrengthVelocity({
      today: "2026-10-22",
      exercises: [
        {
          exerciseKey: "squat",
          name: "Przysiad",
          primaryRegion: "quads",
          points: [
            pt("2026-09-01", 100, 1000),
            pt("2026-09-15", 105, 1100),
            pt("2026-10-01", 110, 1200),
            pt("2026-10-20", 120, 1500),
          ],
        },
        {
          exerciseKey: "bench",
          name: "Wyciskanie",
          primaryRegion: "chest",
          points: [
            pt("2026-09-02", 80, 800),
            pt("2026-09-16", 82, 850),
            pt("2026-10-02", 85, 900),
            pt("2026-10-19", 90, 1000),
          ],
        },
      ],
    });

    expect(snap.overall.volumePct.days90).not.toBeNull();
    expect(snap.overall.e1rmPct.days90).not.toBeNull();
    expect(snap.byMuscle.length).toBeGreaterThan(0);
    expect(pickVelocity(snap.overall.volumePct, "days90")).toBeTypeOf("number");
    expect(velocityTone(5)).toBe("up");
    expect(velocityTone(-5)).toBe("down");
  });
});
