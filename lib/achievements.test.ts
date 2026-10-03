import { describe, expect, it } from "vitest";
import { computeAchievements } from "@/lib/achievements";

describe("computeAchievements", () => {
  it("unlocks first workout and tonnage milestones", () => {
    const list = computeAchievements({
      totalTonnageKg: 55_000,
      totalStrengthSessions: 12,
      streakWeeks: 3,
      weightDeltaKg: -2.5,
      waistDeltaCm: -6,
      firstWorkoutDate: "2026-01-10",
      firstReportDate: "2026-01-12",
    });

    const unlocked = new Set(
      list.filter((a) => a.unlockedAt).map((a) => a.id),
    );
    expect(unlocked.has("first-workout")).toBe(true);
    expect(unlocked.has("sessions-10")).toBe(true);
    expect(unlocked.has("tonnage-10t")).toBe(true);
    expect(unlocked.has("tonnage-50t")).toBe(true);
    expect(unlocked.has("tonnage-100t")).toBe(false);
    expect(unlocked.has("streak-3")).toBe(true);
    expect(unlocked.has("weight-minus-2")).toBe(true);
    expect(unlocked.has("waist-minus-5")).toBe(true);
  });
});
