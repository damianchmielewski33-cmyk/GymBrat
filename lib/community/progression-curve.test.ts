import { describe, expect, it } from "vitest";
import {
  USER_MAX_LEVEL,
  levelFromXp,
  progressInLevel,
  xpNeedForLevel,
} from "@/lib/community/progression-curve";

describe("progression-curve", () => {
  it("need grows with level", () => {
    expect(xpNeedForLevel(2)).toBeGreaterThan(xpNeedForLevel(1));
  });

  it("level from xp caps at max", () => {
    expect(levelFromXp(0, USER_MAX_LEVEL)).toBe(1);
    expect(levelFromXp(1_000_000, USER_MAX_LEVEL)).toBe(USER_MAX_LEVEL);
  });

  it("progress in level", () => {
    const p = progressInLevel(0, USER_MAX_LEVEL);
    expect(p.level).toBe(1);
    expect(p.pct).toBe(0);
  });
});
