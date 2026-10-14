import { describe, expect, it } from "vitest";
import type { WorkoutPlanExercise } from "@/lib/workout-plan-types";
import {
  backfillSessionExerciseCategories,
  planExercisesToSession,
  resolveSessionCategoryId,
} from "@/lib/start-workout-session";

describe("planExercisesToSession / categoryId", () => {
  it("przenosi categoryId z planu do sesji (manekin na pauzie)", () => {
    const plan: WorkoutPlanExercise[] = [
      {
        id: "1",
        name: "Uginanie sztangą",
        categoryId: "biceps",
        reps: 10,
        sets: 3,
      },
    ];
    const session = planExercisesToSession(plan);
    expect(session[0]?.categoryId).toBe("biceps");
  });

  it("gdy categoryId z planu jest pusty, bierze z katalogu po nazwie", () => {
    expect(
      resolveSessionCategoryId("Uginanie przedramion ze sztangą", ""),
    ).toBe("biceps");
  });

  it("backfill uzupełnia brakujące categoryId w trwającej sesji", () => {
    const filled = backfillSessionExerciseCategories([
      {
        id: "1",
        name: "Bench press",
        sets: [{ reps: 8, weight: 60, done: false }],
      },
      {
        id: "2",
        name: "Custom XYZ",
        categoryId: "chest",
        sets: [{ reps: 8, weight: 60, done: false }],
      },
    ]);
    expect(filled[0]?.categoryId).toBe("chest");
    expect(filled[1]?.categoryId).toBe("chest");
  });
});
