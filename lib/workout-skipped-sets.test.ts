import { describe, expect, it } from "vitest";
import type { WorkoutExerciseState } from "@/components/workout/types";
import {
  canCompleteWorkoutSet,
  countSkippedWorkoutSets,
  findFirstSkippedWorkoutTarget,
  isCompletedWorkoutSet,
  isSkippedWorkoutSet,
} from "@/lib/workout-skipped-sets";

describe("workout-skipped-sets", () => {
  it("wykrywa pominiętą serię po fladze i po pustym wykonaniu", () => {
    expect(
      isSkippedWorkoutSet({ done: true, skipped: true, reps: 8, weight: 50 }),
    ).toBe(true);
    expect(
      isSkippedWorkoutSet({ done: true, reps: null, weight: 0 }),
    ).toBe(true);
    expect(
      isSkippedWorkoutSet({ done: true, reps: 8, weight: 50 }),
    ).toBe(false);
  });

  it("zielone zaliczenie wymaga ciężaru i powtórzeń", () => {
    expect(canCompleteWorkoutSet(0, 8)).toBe(false);
    expect(canCompleteWorkoutSet(60, null)).toBe(false);
    expect(canCompleteWorkoutSet(60, 8)).toBe(true);
    expect(
      isCompletedWorkoutSet({ done: true, reps: 8, weight: 60 }),
    ).toBe(true);
    expect(
      isCompletedWorkoutSet({ done: true, reps: 8, weight: 0 }),
    ).toBe(false);
  });

  it("liczy wiele pominiętych serii i wskazuje pierwszą", () => {
    const exercises: WorkoutExerciseState[] = [
      {
        id: "a",
        name: "Przysiad",
        sets: [
          { reps: 5, weight: 100, done: true, skipped: true },
          { reps: 5, weight: 100, done: true, skipped: true },
        ],
      },
      {
        id: "b",
        name: "Martwy ciąg",
        sets: [
          { reps: 5, weight: 120, done: true },
          { reps: 5, weight: 120, done: true, skipped: true },
        ],
      },
    ];
    expect(countSkippedWorkoutSets(exercises)).toBe(3);
    expect(findFirstSkippedWorkoutTarget(exercises)).toEqual({
      exerciseId: "a",
      exerciseName: "Przysiad",
      setIndex: 0,
    });
  });
});
