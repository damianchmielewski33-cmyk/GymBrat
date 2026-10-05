import { describe, expect, it } from "vitest";
import {
  buildLiveCoachTipAfterCompletedSet,
  buildLiveCoachTipForOpenSet,
} from "@/lib/live-set-coach";
import type { WorkoutExerciseState } from "@/components/workout/types";

function ex(partial: Partial<WorkoutExerciseState> & Pick<WorkoutExerciseState, "sets">): WorkoutExerciseState {
  return {
    id: "e1",
    name: "Incline DB Press",
    targetReps: 10,
    targetRir: 1,
    ...partial,
  };
}

describe("live-set-coach", () => {
  it("pierwsza seria: góra zakresu z historii → +ciężar", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [{ reps: 8, weight: 0, done: false }],
        lastSessionSets: [{ reps: 10, weight: 36, done: true, rir: 1 }],
      }),
      0,
    );
    expect(tip).not.toBeNull();
    expect(tip!.apply?.weightKg).toBe(38.5);
    expect(tip!.apply?.reps).toBe(8);
    expect(tip!.body).toMatch(/spróbuj|Dziś spróbuj/i);
  });

  it("po twardej serii w sesji → zdejmij ciężar", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [
          { reps: 6, weight: 40, done: true, rir: 0 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      1,
    );
    expect(tip).not.toBeNull();
    expect(tip!.tone).toBe("caution");
    expect(tip!.apply?.weightKg).toBe(37.5);
  });

  it("po łatwej serii na górze zakresu → +ciężar", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [
          { reps: 10, weight: 36, done: true, rir: 3 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      1,
    );
    expect(tip).not.toBeNull();
    expect(tip!.tone).toBe("progress");
    expect(tip!.apply?.weightKg).toBe(38.5);
  });

  it("rada na przerwie wskazuje następną serię", () => {
    const tip = buildLiveCoachTipAfterCompletedSet(
      ex({
        sets: [
          { reps: 8, weight: 36, done: true, rir: 2 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      0,
    );
    expect(tip).not.toBeNull();
    expect(tip!.body).toMatch(/następn/i);
    expect(tip!.apply?.reps).toBe(9);
  });
});
