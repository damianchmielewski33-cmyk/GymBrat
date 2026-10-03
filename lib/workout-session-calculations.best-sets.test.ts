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
      kind: "weighted",
    });
  });

  it("dla masy ciała bierze max powtórzeń", () => {
    const rows = bestSetsFromSession(
      [
        {
          id: "p",
          name: "Pompki",
          sets: [
            { reps: 12, weight: 0, done: true },
            { reps: 15, weight: 0, done: true },
            { reps: 20, weight: 0, done: true, skipped: true },
          ],
        },
      ],
      estimated1RM,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      exerciseId: "p",
      exerciseName: "Pompki",
      weight: 0,
      reps: 15,
      e1rm: 0,
      kind: "bodyweight",
    });
  });
});
