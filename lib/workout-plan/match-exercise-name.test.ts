import { describe, expect, it } from "vitest";
import { bestExerciseNameMatch } from "@/lib/workout-plan/match-exercise-name";
import { CATALOG_EXERCISES } from "@/lib/workout-exercise-catalog";

describe("bestExerciseNameMatch", () => {
  it("dopasowuje bench press do wyciskania sztangi", () => {
    const match = bestExerciseNameMatch("bench press", CATALOG_EXERCISES);
    expect(match?.exercise.id).toBe("c-bench-bar");
  });

  it("zwraca null dla śmieci", () => {
    expect(bestExerciseNameMatch("xyzzy123", CATALOG_EXERCISES)).toBeNull();
  });
});
