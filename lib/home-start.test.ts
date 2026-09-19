import { describe, expect, it } from "vitest";
import { consecutiveWorkoutStreakFromKeys } from "@/lib/home-start";

describe("consecutiveWorkoutStreakFromKeys", () => {
  it("liczy serię od dziś wstecz", () => {
    const keys = new Set(["2026-09-19", "2026-09-18", "2026-09-17"]);
    expect(consecutiveWorkoutStreakFromKeys("2026-09-19", keys)).toBe(3);
  });

  it("przerywa przy braku dnia", () => {
    const keys = new Set(["2026-09-19", "2026-09-17"]);
    expect(consecutiveWorkoutStreakFromKeys("2026-09-19", keys)).toBe(1);
  });

  it("zwraca 0 gdy dziś bez treningu", () => {
    const keys = new Set(["2026-09-18"]);
    expect(consecutiveWorkoutStreakFromKeys("2026-09-19", keys)).toBe(0);
  });
});
