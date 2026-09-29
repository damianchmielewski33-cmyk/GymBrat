import { describe, expect, it } from "vitest";
import type { WorkoutExerciseState } from "@/components/workout/types";
import {
  countSkippedWorkoutSets,
  findFirstSkippedWorkoutTarget,
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

  it("znajduje pierwsze pominięte ćwiczenie/serię", () => {
    const exercises: WorkoutExerciseState[] = [
      {
        id: "a",
        name: "Przysiad",
        sets: [{ reps: 5, weight: 100, done: true }],
      },
      {
        id: "b",
        name: "Martwy ciąg",
        sets: [
          { reps: 5, weight: 120, done: true },
          { reps: null, weight: 0, done: true, skipped: true },
        ],
      },
    ];
    expect(findFirstSkippedWorkoutTarget(exercises)).toEqual({
      exerciseId: "b",
      exerciseName: "Martwy ciąg",
      setIndex: 1,
    });
    expect(countSkippedWorkoutSets(exercises)).toBe(1);
  });
});
