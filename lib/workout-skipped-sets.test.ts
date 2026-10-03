import { describe, expect, it } from "vitest";
import type { WorkoutExerciseState } from "@/components/workout/types";
import {
  canCompleteWorkoutSet,
  countSkippedWorkoutSets,
  findFirstSkippedWorkoutTarget,
  findNextIncompleteExercise,
  isCompletedWorkoutSet,
  isExerciseIncomplete,
  isSkippedWorkoutSet,
  resolveAdvanceAfterSet,
} from "@/lib/workout-skipped-sets";

function set(done: boolean, skipped = false) {
  return { reps: done ? 8 : null, weight: done ? 50 : 0, done, skipped };
}

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

  it("zielone zaliczenie wymaga ciężaru > 0; 0 kg → pomiń", () => {
    expect(canCompleteWorkoutSet(0, 8)).toBe(false);
    expect(canCompleteWorkoutSet(60, null)).toBe(false);
    expect(canCompleteWorkoutSet(60, 8)).toBe(true);
    expect(
      isCompletedWorkoutSet({ done: true, reps: 8, weight: 60 }),
    ).toBe(true);
    expect(
      isCompletedWorkoutSet({ done: true, reps: 8, weight: 0 }),
    ).toBe(false);
    expect(
      isSkippedWorkoutSet({ done: true, reps: 8, weight: 0 }),
    ).toBe(true);
    expect(
      isSkippedWorkoutSet({ done: true, reps: null, weight: 0 }),
    ).toBe(true);
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

  it("po ćwiczeniu 1 pomija już wykonane 2 i idzie do 3", () => {
    const exercises: WorkoutExerciseState[] = [
      { id: "1", name: "Ćw. 1", sets: [set(true)] },
      { id: "2", name: "Ćw. 2", sets: [set(true)] },
      { id: "3", name: "Ćw. 3", sets: [set(false)] },
      { id: "4", name: "Ćw. 4", sets: [set(true)] },
      { id: "5", name: "Ćw. 5", sets: [set(true)] },
      { id: "6", name: "Ćw. 6", sets: [set(true)] },
      { id: "7", name: "Ćw. 7", sets: [set(true)] },
    ];
    expect(isExerciseIncomplete(exercises[2]!)).toBe(true);
    expect(findNextIncompleteExercise(exercises, "1")?.id).toBe("3");
  });

  it("zawija do wcześniejszego niedokończonego ćwiczenia", () => {
    const exercises: WorkoutExerciseState[] = [
      { id: "1", name: "Ćw. 1", sets: [set(false)] },
      { id: "2", name: "Ćw. 2", sets: [set(true)] },
      { id: "3", name: "Ćw. 3", sets: [set(true)] },
    ];
    expect(findNextIncompleteExercise(exercises, "3")?.id).toBe("1");
  });

  it("zwraca null gdy wszystkie ćwiczenia są domknięte", () => {
    const exercises: WorkoutExerciseState[] = [
      { id: "1", name: "Ćw. 1", sets: [set(true)] },
      { id: "2", name: "Ćw. 2", sets: [set(true)] },
    ];
    expect(findNextIncompleteExercise(exercises, "1")).toBeNull();
  });

  it("resolveAdvanceAfterSet: kolejna seria w tym samym ćwiczeniu", () => {
    const exercises: WorkoutExerciseState[] = [
      {
        id: "a",
        name: "Przysiad",
        sets: [
          { reps: 5, weight: 100, done: true, skipped: true },
          { reps: 5, weight: 100, done: false },
          { reps: 5, weight: 100, done: false },
        ],
      },
    ];
    expect(resolveAdvanceAfterSet(exercises, "a", 0)).toEqual({
      exerciseId: "a",
      setIndex: 1,
    });
  });

  it("resolveAdvanceAfterSet: po ostatniej serii idzie do następnego niedokończonego", () => {
    const exercises: WorkoutExerciseState[] = [
      {
        id: "a",
        name: "Przysiad",
        sets: [
          { reps: 5, weight: 100, done: true },
          { reps: 5, weight: 100, done: true, skipped: true },
        ],
      },
      {
        id: "b",
        name: "Martwy",
        sets: [{ reps: 5, weight: 120, done: false }],
      },
    ];
    expect(resolveAdvanceAfterSet(exercises, "a", 1)).toEqual({
      exerciseId: "b",
      setIndex: 0,
    });
  });

  it("resolveAdvanceAfterSet: stale-bug — po pominięciu ostatniej nie wraca do siebie", () => {
    const exercises: WorkoutExerciseState[] = [
      {
        id: "a",
        name: "Przysiad",
        sets: [
          { reps: 5, weight: 100, done: true },
          { reps: 5, weight: 100, done: true, skipped: true },
        ],
      },
      {
        id: "b",
        name: "Wyciskanie",
        sets: [
          { reps: 8, weight: 60, done: false },
          { reps: 8, weight: 60, done: false },
        ],
      },
    ];
    // Świeży stan: a domknięte — musi wskazać b, nie a.
    expect(resolveAdvanceAfterSet(exercises, "a", 1)?.exerciseId).toBe("b");
  });
});
