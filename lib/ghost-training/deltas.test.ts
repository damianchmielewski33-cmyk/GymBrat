import { describe, expect, it } from "vitest";
import { computeGhostDelta } from "@/lib/ghost-training/deltas";
import { buildGhostTimeline } from "@/lib/ghost-training/timeline";

describe("ghost deltas", () => {
  it("marks ahead when more sets done", () => {
    const timeline = buildGhostTimeline({
      sourceKind: "self",
      sourceUserId: "u1",
      sourceLabel: "Ty",
      workoutId: "w1",
      planId: null,
      title: "Test",
      exercisesJson: JSON.stringify([
        {
          id: "e1",
          name: "Squat",
          sets: [
            { reps: 5, weight: 100, done: true, elapsedSecondsAtCompletion: 60 },
            { reps: 5, weight: 100, done: true, elapsedSecondsAtCompletion: 180 },
          ],
        },
      ]),
    });
    expect(timeline.synthetic).toBe(false);
    const d = computeGhostDelta({
      timeline,
      myElapsedSeconds: 90,
      myCompletedSets: 2,
      myVolumeKg: 1000,
      myProgressPct: 100,
    });
    expect(d.setsDelta).toBeGreaterThan(0);
  });
});
