import { describe, expect, it } from "vitest";
import {
  nextTierAfter,
  tierFromPoints,
  toReputationPublic,
  REPUTATION_THRESHOLDS,
} from "@/lib/community/reputation";

describe("reputation tiers", () => {
  it("maps thresholds", () => {
    expect(tierFromPoints(0)).toBe("bronze");
    expect(tierFromPoints(99)).toBe("bronze");
    expect(tierFromPoints(100)).toBe("silver");
    expect(tierFromPoints(300)).toBe("gold");
    expect(tierFromPoints(700)).toBe("platinum");
    expect(tierFromPoints(1500)).toBe("diamond");
    expect(tierFromPoints(3500)).toBe("legend");
  });

  it("nextTierAfter", () => {
    expect(nextTierAfter("bronze")).toBe("silver");
    expect(nextTierAfter("legend")).toBeNull();
  });

  it("toReputationPublic progress", () => {
    const mid = toReputationPublic(200);
    expect(mid.tier).toBe("silver");
    expect(mid.nextTier).toBe("gold");
    expect(mid.pointsToNext).toBe(REPUTATION_THRESHOLDS.gold - 200);
    expect(mid.progressToNext).toBeGreaterThan(0);
    expect(mid.progressToNext).toBeLessThan(1);

    const legend = toReputationPublic(99999);
    expect(legend.tier).toBe("legend");
    expect(legend.nextTier).toBeNull();
    expect(legend.progressToNext).toBe(1);
  });
});
