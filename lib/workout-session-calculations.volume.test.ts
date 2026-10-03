import { describe, expect, it } from "vitest";
import {
  countPerformedSets,
  exerciseTotalReps,
  exerciseVolume,
  isCountedPerformedSet,
  isCountedVolumeSet,
  sessionVolume,
} from "@/lib/workout-session-calculations";

describe("session volume — done / skipped", () => {
  it("nie liczy pominiętych ani niedokończonych serii do tonażu", () => {
    const exercises = [
      {
        sets: [
          { reps: 8, weight: 60, done: true, skipped: false },
          { reps: 8, weight: 60, done: true, skipped: true },
          { reps: 8, weight: 60, done: false },
          { reps: 10, weight: 50 }, // legacy bez flag
        ],
      },
    ];
    expect(sessionVolume(exercises)).toBe(8 * 60 + 10 * 50);
    expect(exerciseVolume(exercises[0]!.sets)).toBe(8 * 60 + 10 * 50);
  });

  it("masa ciała (0 kg) nie daje tonażu, ale liczy powtórzenia", () => {
    const sets = [
      { reps: 15, weight: 0, done: true },
      { reps: 12, weight: 0, done: true, skipped: true },
    ];
    expect(isCountedVolumeSet(sets[0]!)).toBe(false);
    expect(isCountedPerformedSet(sets[0]!)).toBe(true);
    expect(exerciseVolume(sets)).toBe(0);
    expect(exerciseTotalReps(sets)).toBe(15);
    expect(countPerformedSets([{ sets }])).toBe(1);
  });

  it("skipped z zachowanym ciężarem nie zawyża volume", () => {
    expect(
      sessionVolume([
        {
          sets: [
            { reps: 5, weight: 100, done: true, skipped: true },
            { reps: 5, weight: 100, done: true },
          ],
        },
      ]),
    ).toBe(500);
  });
});
