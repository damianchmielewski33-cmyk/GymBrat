import { describe, expect, it } from "vitest";
import { decideWarWinner, meanActiveFcs } from "@/lib/community/team-war-score";
import { leagueFromLp } from "@/lib/community/team-war-types";

describe("team-war-score", () => {
  it("mean active fcs ignores zeros", () => {
    expect(meanActiveFcs([0, 80, 60])).toBeCloseTo(70);
  });

  it("decide winner", () => {
    expect(decideWarWinner(80, 70)).toBe("a");
    expect(decideWarWinner(70, 80)).toBe("b");
    expect(decideWarWinner(70, 70.02)).toBe("draw");
  });

  it("league from lp", () => {
    expect(leagueFromLp(0)).toBe("bronze");
    expect(leagueFromLp(250)).toBe("gold");
    expect(leagueFromLp(900)).toBe("diamond");
  });
});
