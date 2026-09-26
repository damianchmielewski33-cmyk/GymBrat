import { describe, expect, it } from "vitest";
import {
  consecutiveWorkoutStreakFromKeys,
  consecutiveWorkoutWeeksFromKeys,
  mergeWeightPointsByDay,
} from "@/lib/home-start";

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

describe("consecutiveWorkoutWeeksFromKeys", () => {
  // 2026-09-25 = piątek; tydzień pon–niedz: 21–27 wrz
  it("liczy kolejne tygodnie z treningiem", () => {
    const keys = new Set([
      "2026-09-22", // ten tydzień
      "2026-09-15", // poprzedni
      "2026-09-08", // jeszcze wcześniejszy
    ]);
    expect(consecutiveWorkoutWeeksFromKeys("2026-09-25", keys)).toBe(3);
  });

  it("pomija pusty bieżący tydzień i liczy wcześniejsze", () => {
    const keys = new Set(["2026-09-15", "2026-09-08"]);
    expect(consecutiveWorkoutWeeksFromKeys("2026-09-25", keys)).toBe(2);
  });

  it("przerywa przy pustym tygodniu w środku", () => {
    const keys = new Set(["2026-09-22", "2026-09-08"]);
    expect(consecutiveWorkoutWeeksFromKeys("2026-09-25", keys)).toBe(1);
  });
});

describe("mergeWeightPointsByDay", () => {
  it("łączy wagi z raportu i ważenia — nowszy wygrywa", () => {
    const merged = mergeWeightPointsByDay([
      { date: "2026-09-01", kg: 80, atMs: 1 },
      { date: "2026-09-10", kg: 79, atMs: 10 },
      { date: "2026-09-10", kg: 78.5, atMs: 20 },
    ]);
    expect(merged).toEqual([
      { date: "2026-09-01", kg: 80 },
      { date: "2026-09-10", kg: 78.5 },
    ]);
  });
});
