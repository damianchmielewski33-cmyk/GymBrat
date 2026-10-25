import { describe, expect, it } from "vitest";
import { estimated1RM } from "@/lib/workout-history";
import {
  allSetsLineFromSession,
  bestSetIndexInExercise,
} from "@/lib/workout-finish-sets-line";

describe("allSetsLineFromSession", () => {
  it("oznacza najlepszą serię, pominięte i niewykonane po kolei", () => {
    const sets = [
      { reps: 8, weight: 80, done: true },
      { reps: 7, weight: 80, done: true },
      { reps: 5, weight: 80, done: true, skipped: true },
      { reps: null, weight: 0, done: false },
    ];
    const lines = allSetsLineFromSession(sets, estimated1RM);
    expect(lines).toEqual([
      { ordinal: 1, label: "80×8", state: "best" },
      { ordinal: 2, label: "80×7", state: "done" },
      { ordinal: 3, label: "pominięta", state: "skipped" },
      { ordinal: 4, label: "niewykonana", state: "incomplete" },
    ]);
  });

  it("masa ciała: najlepsza = najwięcej powtórzeń, etykieta w „powt.”", () => {
    const sets = [
      { reps: 10, weight: 0, done: true },
      { reps: 12, weight: 0, done: true },
    ];
    const lines = allSetsLineFromSession(sets, estimated1RM);
    expect(lines[0]).toEqual({ ordinal: 1, label: "10 powt.", state: "done" });
    expect(lines[1]).toEqual({ ordinal: 2, label: "12 powt.", state: "best" });
  });

  it("bez zaliczonej serii: bestSetIndexInExercise zwraca null", () => {
    const sets = [{ reps: null, weight: 0, done: false }];
    expect(bestSetIndexInExercise(sets, estimated1RM)).toBeNull();
  });
});
