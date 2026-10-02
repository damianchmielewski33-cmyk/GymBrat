import { describe, expect, it } from "vitest";
import { bestSetsFromSession } from "@/lib/workout-session-calculations";
import { estimated1RM } from "@/lib/workout-history";

describe("bestSetsFromSession", () => {
  it("bierze serię z najwyższym e1RM na ćwiczenie", () => {
    const rows = bestSetsFromSession(
      [
        {
          id: "a",
          name: "Bench Press",
          sets: [
            { reps: 10, weight: 60, done: true },
            { reps: 8, weight: 70, done: true },
            { reps: 5, weight: 50, done: true, skipped: true },
          ],
        },
        {
          id: "b",
          name: "Pompki",
          sets: [{ reps: null, weight: 0, done: false }],
        },
      ],
      estimated1RM,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      exerciseId: "a",
      exerciseName: "Bench Press",
      weight: 70,
      reps: 8,
      e1rm: Math.round(estimated1RM(70, 8)),
    });
  });
});
