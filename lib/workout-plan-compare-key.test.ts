import { describe, expect, it } from "vitest";
import {
  isSameWorkoutPlanDay,
  normalizePlanLabel,
  workoutPlanCompareKey,
  workoutPlanDisplayLabel,
} from "@/lib/workout-plan-compare-key";

describe("workout-plan-compare-key", () => {
  it("grupuje po nazwie planu (Nogi ≠ Push)", () => {
    expect(
      workoutPlanCompareKey({ planName: "Nogi", title: "Sesja", workoutPlanId: "a" }),
    ).toBe("name:nogi");
    expect(
      workoutPlanCompareKey({ planName: "Push A", title: "Sesja", workoutPlanId: "b" }),
    ).toBe("name:push a");
    expect(
      isSameWorkoutPlanDay(
        { planName: "Nogi", workoutPlanId: "1" },
        { planName: "nogi", workoutPlanId: "2" },
      ),
    ).toBe(true);
    expect(
      isSameWorkoutPlanDay(
        { planName: "Nogi" },
        { planName: "Push A" },
      ),
    ).toBe(false);
  });

  it("gdy brak planName, bierze tytuł sesji", () => {
    expect(workoutPlanCompareKey({ title: "Klatka + Ramiona" })).toBe(
      "name:klatka + ramiona",
    );
    expect(normalizePlanLabel("  Bark  ")).toBe("bark");
  });

  it("wyświetla czytelną etykietę", () => {
    expect(workoutPlanDisplayLabel({ planName: "Nogi", title: "X" })).toBe("Nogi");
    expect(workoutPlanDisplayLabel({ title: "Push A" })).toBe("Push A");
  });
});
