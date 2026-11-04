import { describe, expect, it } from "vitest";
import { nextPollDelay } from "@/lib/community/adaptive-poll";

describe("nextPollDelay (Z79)", () => {
  it("bazowy interwał bez bezczynności", () => {
    expect(nextPollDelay(30_000, 0)).toBe(30_000);
  });
  it("podwaja i zatrzymuje się na limicie", () => {
    expect(nextPollDelay(30_000, 1)).toBe(60_000);
    expect(nextPollDelay(30_000, 2)).toBe(120_000);
    expect(nextPollDelay(30_000, 9)).toBe(120_000);
    expect(nextPollDelay(10_000, 5, 25_000)).toBe(25_000);
  });
});
