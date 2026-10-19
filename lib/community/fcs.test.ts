import { describe, expect, it } from "vitest";
import {
  computeFcs,
  progressComponent,
  regularityComponent,
  socialComponent,
} from "@/lib/community/fcs";
import { volumeFromExercisesJson } from "@/lib/community/fcs-compute";

describe("FCS progressComponent — fairness vs absolute load", () => {
  it("rewards relative growth over baseline stagnant advanced", () => {
    const newbie = progressComponent(400, 300, 3); // +33%
    const advancedFlat = progressComponent(5000, 5000, 5); // 0%
    expect(newbie).toBeGreaterThan(advancedFlat);
  });

  it("gives baseline credit on first week with volume", () => {
    expect(progressComponent(800, 0, 2)).toBe(0.55);
    expect(progressComponent(0, 0, 0)).toBe(0);
  });
});

describe("computeFcs", () => {
  it("returns 0 with no sessions even if social is high", () => {
    const r = computeFcs({
      sessionsThisWeek: 0,
      uniqueDaysThisWeek: 0,
      weeklyTarget: 4,
      volumeThisWeek: 0,
      volumePrevWeek: 0,
      streakWeeks: 8,
      challengeProgressAvg: 1,
      challengeJoined: true,
      socialEvents: 20,
      helpEvents: 20,
      liveSessionsJoined: 3,
      isNewcomer: true,
    });
    expect(r.fcs).toBe(0);
  });

  it("applies newcomer boost when ≥2 sessions", () => {
    const base = {
      sessionsThisWeek: 3,
      uniqueDaysThisWeek: 3,
      weeklyTarget: 4,
      volumeThisWeek: 900,
      volumePrevWeek: 700,
      streakWeeks: 2,
      challengeProgressAvg: 0.5,
      challengeJoined: true,
      socialEvents: 4,
      helpEvents: 2,
      liveSessionsJoined: 1,
    };
    const veteran = computeFcs({ ...base, isNewcomer: false });
    const newbie = computeFcs({ ...base, isNewcomer: true });
    expect(newbie.fcs).toBe(Math.min(100, veteran.fcs + 5));
    expect(newbie.newcomerBoost).toBe(5);
  });

  it("lets consistent mid-progress beat volume-only with low regularity", () => {
    const consistent = computeFcs({
      sessionsThisWeek: 4,
      uniqueDaysThisWeek: 4,
      weeklyTarget: 4,
      volumeThisWeek: 1200,
      volumePrevWeek: 1000,
      streakWeeks: 4,
      challengeProgressAvg: 0.6,
      challengeJoined: true,
      socialEvents: 5,
      helpEvents: 3,
      liveSessionsJoined: 1,
      isNewcomer: false,
    });
    const heavyIrregular = computeFcs({
      sessionsThisWeek: 1,
      uniqueDaysThisWeek: 1,
      weeklyTarget: 4,
      volumeThisWeek: 8000,
      volumePrevWeek: 7900,
      streakWeeks: 1,
      challengeProgressAvg: 0,
      challengeJoined: false,
      socialEvents: 0,
      helpEvents: 0,
      liveSessionsJoined: 0,
      isNewcomer: false,
    });
    expect(consistent.fcs).toBeGreaterThan(heavyIrregular.fcs);
  });
});

describe("helpers", () => {
  it("regularity and social scale", () => {
    expect(regularityComponent(4, 4, 4)).toBeGreaterThan(0.9);
    expect(socialComponent(0)).toBe(0);
    expect(socialComponent(12)).toBeGreaterThan(0.9);
  });

  it("volumeFromExercisesJson ignores cardio_log and skipped", () => {
    expect(
      volumeFromExercisesJson(
        JSON.stringify({
          kind: "session",
          exercises: [
            {
              sets: [
                { weight: 100, reps: 5, done: true },
                { weight: 100, reps: 5, skipped: true },
              ],
            },
          ],
        }),
      ),
    ).toBe(500);
    expect(
      volumeFromExercisesJson(JSON.stringify({ kind: "cardio_log" })),
    ).toBe(0);
  });
});
