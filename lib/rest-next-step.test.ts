import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  WorkoutExerciseState,
  WorkoutSetState,
} from "@/components/workout/types";

const tipMock = vi.hoisted(() => ({
  buildLiveCoachTipForOpenSet: vi.fn(),
}));
vi.mock("@/lib/live-set-coach", () => tipMock);

import {
  buildRestCompletedSet,
  buildRestNextStep,
} from "@/lib/rest-next-step";

const saved: WorkoutSetState = { reps: 8, weight: 50, done: true, rir: 2 };
const skipped: WorkoutSetState = {
  reps: 8,
  weight: 50,
  done: true,
  skipped: true,
};
const todo: WorkoutSetState = { reps: 8, weight: 0, done: false };

function ex(
  id: string,
  sets: WorkoutSetState[],
  over: Partial<WorkoutExerciseState> = {},
): WorkoutExerciseState {
  return { id, name: `Ćw ${id}`, sets, ...over };
}

beforeEach(() => {
  tipMock.buildLiveCoachTipForOpenSet.mockReset();
  tipMock.buildLiveCoachTipForOpenSet.mockReturnValue(null);
});

describe("buildRestNextStep", () => {
  it("następna seria tego samego ćwiczenia -> kind set", () => {
    const list = [
      ex("a", [saved, todo, todo], {
        targetReps: 8,
        targetRir: 2,
        suggestedWeights: [50, 52.5, 52.5],
        lastSessionSets: [null, { reps: 8, weight: 50, done: true }],
      }),
    ];
    const next = buildRestNextStep(list, { exerciseId: "a", setIndex: 0 });
    expect(next).toEqual({
      kind: "set",
      exerciseId: "a",
      exerciseName: "Ćw a",
      exerciseOrdinal: 1,
      setIndex: 1,
      setOrdinal: 2,
      setsInExercise: 3,
      targetReps: 8,
      targetRir: 2,
      suggestion: {
        weightKg: 52.5,
        reps: null,
        direction: "up",
        deltaKg: 2.5,
        referenceKg: 50,
        reason: null,
        rule: null,
        source: "progression",
      },
      lastSessionSet: { reps: 8, weight: 50, done: true },
    });
  });

  it("następne ćwiczenie -> kind exercise, sugestia z danych tego ćwiczenia", () => {
    tipMock.buildLiveCoachTipForOpenSet.mockImplementation(
      (exercise: WorkoutExerciseState) =>
        exercise.id === "a"
          ? {
              id: "t",
              tone: "progress",
              body: "",
              prefix: "",
              highlight: null,
              suffix: "",
              apply: { weightKg: 100, reps: 5 },
              decision: "",
              reason: "a",
              readiness: 0,
              confidence: 0,
            }
          : null,
    );
    const list = [
      ex("a", [saved, saved]),
      ex("b", [todo, todo], { suggestedWeights: [20, 20] }),
    ];
    const next = buildRestNextStep(list, { exerciseId: "a", setIndex: 1 });
    expect(next?.kind).toBe("exercise");
    expect(next?.exerciseId).toBe("b");
    expect(next?.exerciseOrdinal).toBe(2);
    expect(next?.setOrdinal).toBe(1);
    expect(next?.suggestion?.weightKg).toBe(20);
    expect(next?.targetReps).toBeNull();
    expect(next?.targetRir).toBeNull();
    expect(next?.lastSessionSet).toBeNull();
    expect(tipMock.buildLiveCoachTipForOpenSet).toHaveBeenCalledWith(
      list[1],
      0,
    );
  });

  it("pomija serie już done (kolejność z resolveAdvanceAfterSet)", () => {
    const list = [ex("a", [saved, saved, todo])];
    expect(
      buildRestNextStep(list, { exerciseId: "a", setIndex: 0 })?.setIndex,
    ).toBe(2);
  });

  it("koniec treningu -> null; nieznane ćwiczenie -> null", () => {
    const list = [ex("a", [saved, skipped])];
    expect(buildRestNextStep(list, { exerciseId: "a", setIndex: 1 })).toBeNull();
    expect(buildRestNextStep(list, { exerciseId: "x", setIndex: 0 })).toBeNull();
  });
});

describe("buildRestCompletedSet", () => {
  it("zapisana seria z exerciseCompleted (BR-3)", () => {
    expect(
      buildRestCompletedSet([ex("a", [saved, saved])], {
        exerciseId: "a",
        setIndex: 1,
      }),
    ).toEqual({ weightKg: 50, reps: 8, rir: 2, exerciseCompleted: true });
  });

  it("pominięcie w ćwiczeniu -> exerciseCompleted false", () => {
    expect(
      buildRestCompletedSet([ex("a", [skipped, saved])], {
        exerciseId: "a",
        setIndex: 1,
      })?.exerciseCompleted,
    ).toBe(false);
  });

  it("niedokończone ćwiczenie -> exerciseCompleted false; rir brak -> null", () => {
    expect(
      buildRestCompletedSet(
        [ex("a", [{ reps: 8, weight: 50, done: true }, todo])],
        { exerciseId: "a", setIndex: 0 },
      ),
    ).toEqual({ weightKg: 50, reps: 8, rir: null, exerciseCompleted: false });
  });

  it("seria pominięta, otwarta albo nieistniejąca -> null", () => {
    const list = [ex("a", [skipped, todo])];
    expect(buildRestCompletedSet(list, { exerciseId: "a", setIndex: 0 })).toBeNull();
    expect(buildRestCompletedSet(list, { exerciseId: "a", setIndex: 1 })).toBeNull();
    expect(buildRestCompletedSet(list, { exerciseId: "a", setIndex: 5 })).toBeNull();
    expect(buildRestCompletedSet(list, { exerciseId: "x", setIndex: 0 })).toBeNull();
  });
});
