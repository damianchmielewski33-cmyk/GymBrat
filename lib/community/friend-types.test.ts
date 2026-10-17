import { describe, expect, it } from "vitest";
import {
  canonicalPair,
  isMutualWorkoutShare,
  shareFlagsForViewer,
} from "@/lib/community/friend-types";

describe("friend-types", () => {
  it("canonicalPair sortuje id", () => {
    expect(canonicalPair("b", "a")).toEqual({
      userAId: "a",
      userBId: "b",
    });
    expect(canonicalPair("a", "b")).toEqual({
      userAId: "a",
      userBId: "b",
    });
  });

  it("mutual share wymaga accepted + obu flag", () => {
    expect(
      isMutualWorkoutShare({
        status: "accepted",
        shareWorkoutA: 1,
        shareWorkoutB: 1,
      }),
    ).toBe(true);
    expect(
      isMutualWorkoutShare({
        status: "accepted",
        shareWorkoutA: 1,
        shareWorkoutB: 0,
      }),
    ).toBe(false);
    expect(
      isMutualWorkoutShare({
        status: "pending",
        shareWorkoutA: 1,
        shareWorkoutB: 1,
      }),
    ).toBe(false);
  });

  it("shareFlagsForViewer mapuje a/b względem viewer", () => {
    expect(shareFlagsForViewer("a", "a", 1, 0)).toEqual({
      iShare: true,
      theyShare: false,
    });
    expect(shareFlagsForViewer("b", "a", 1, 0)).toEqual({
      iShare: false,
      theyShare: true,
    });
  });
});
