import { describe, expect, it } from "vitest";
import { BADGE_RARITY_MIN_HOLDERS } from "@/lib/community/badge-catalog";

describe("badge rarity threshold (LR-T12)", () => {
  it("requires at least 50 holders before showing percent", () => {
    expect(BADGE_RARITY_MIN_HOLDERS).toBeGreaterThanOrEqual(50);
  });
});
