import { describe, expect, it } from "vitest";
import { validateWorkoutPlanPayload } from "@/lib/workout-plan/plan-validation";

describe("validateWorkoutPlanPayload", () => {
  it("akceptuje poprawny plan", () => {
    const res = validateWorkoutPlanPayload({
      version: 2,
      path: "custom",
      planName: "Push A",
      userCustomExerciseNames: [],
      exercises: [
        {
          id: "1",
          name: "Wyciskanie",
          categoryId: "chest",
          sets: 3,
          reps: 10,
          rir: 1,
        },
      ],
    });
    expect(res.ok).toBe(true);
  });

  it("odrzuca pustą nazwę", () => {
    const res = validateWorkoutPlanPayload({
      version: 2,
      path: "custom",
      planName: "  ",
      userCustomExerciseNames: [],
      exercises: [],
    });
    expect(res.ok).toBe(false);
  });
});
