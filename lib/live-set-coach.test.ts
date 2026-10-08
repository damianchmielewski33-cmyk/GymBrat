import { describe, expect, it } from "vitest";
import {
  buildLiveCoachTipAfterCompletedSet,
  buildLiveCoachTipForOpenSet,
  pickCoachVariant,
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
  it("pickCoachVariant jest stabilny dla tego samego seeda", () => {
    const v = ["a", "b", "c"] as const;
    expect(pickCoachVariant("seed-x", v)).toBe(pickCoachVariant("seed-x", v));
    expect(pickCoachVariant("seed-a", v)).not.toBe(
      pickCoachVariant("seed-z-other", v),
    );
  });

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
    expect(tip!.tone).toBe("progress");
    expect(tip!.body).toMatch(/38,5 kg × 8/);
  });

  it("po twardej historii nie dokładaj — zejdź lub utrzymaj", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [{ reps: null, weight: 0, done: false }],
        lastSessionSets: [{ reps: 8, weight: 40, done: true, rir: 0 }],
      }),
      0,
    );
    expect(tip).not.toBeNull();
    expect(tip!.tone).toBe("caution");
    expect(tip!.apply?.weightKg).toBeLessThan(40);
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
    expect(tip!.body).toMatch(/Incline|seria|tward|zejdź|−|hamuj|styk/i);
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

  it("różne ćwiczenia → różne brzmienie tej samej logiki", () => {
    const a = buildLiveCoachTipForOpenSet(
      ex({
        id: "squat",
        name: "Przysiad",
        sets: [
          { reps: 8, weight: 100, done: true, rir: 2 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      1,
    );
    const b = buildLiveCoachTipForOpenSet(
      ex({
        id: "bench",
        name: "Wyciskanie",
        sets: [
          { reps: 8, weight: 100, done: true, rir: 2 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      1,
    );
    expect(a?.apply).toEqual(b?.apply);
    expect(a?.body).not.toBe(b?.body);
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
    expect(tip!.apply?.reps).toBe(9);
    expect(tip!.body).toMatch(/seria|kolejn|następn|przerw|dalej|celuj|baz/i);
  });
});
