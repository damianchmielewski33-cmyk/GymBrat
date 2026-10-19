import { describe, expect, it } from "vitest";
import {
  communityHeroScore,
  maxConsecutiveWeeks,
  relativeProgressScore,
  teamLegendScore,
} from "@/lib/community/hof-score";

describe("hof-score", () => {
  it("relative progress", () => {
    expect(relativeProgressScore(120, 100)).toBeCloseTo(0.2);
    expect(relativeProgressScore(50, 0)).toBe(0.55);
  });

  it("max consecutive weeks", () => {
    expect(
      maxConsecutiveWeeks([
        "2026-10-05",
        "2026-10-12",
        "2026-10-19",
        "2026-11-02",
      ]),
    ).toBe(3);
  });

  it("community hero diversity", () => {
    expect(communityHeroScore(100, 3)).toBe(115);
    expect(communityHeroScore(100, 1)).toBe(100);
  });

  it("team legend multi-team boost", () => {
    expect(
      teamLegendScore({
        teamScopedRp: 100,
        liveJoins: 0,
        challengeClaims: 0,
        distinctTeams: 2,
      }),
    ).toBe(120);
  });
});
