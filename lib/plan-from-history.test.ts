import { describe, expect, it } from "vitest";
import {
  buildPlanDaysFromWorkouts,
  shouldShowOnboarding,
  shouldShowReportCount,
} from "@/lib/plan-from-history";
import { validateWorkoutPlanPayload } from "@/lib/workout-plan/plan-validation";

const NOW = 1_800_000_000_000;
const D = 86_400_000;
const set = (reps: number, extra: object = {}) => ({ reps, weight: 50, done: true, ...extra });
const row = (daysAgo: number, session: object) => ({
  date: new Date(NOW - daysAgo * D),
  exercises: JSON.stringify(session),
});

describe("buildPlanDaysFromWorkouts", () => {
  it("jeden dzień na nazwę, z ostatniego wystąpienia; pomija kardio i stare sesje", () => {
    const plans = buildPlanDaysFromWorkouts(
      [
        row(10, { title: "Push", exercises: [{ name: "Wyciskanie sztangi leżąc", sets: [set(5), set(5)] }] }),
        row(2, {
          title: "Push",
          exercises: [
            {
              name: "Wyciskanie sztangi leżąc",
              sets: [set(8, { warmup: true }), set(8), set(7), set(6, { skipped: true, done: false })],
            },
          ],
        }),
        row(3, { title: "Pull", exercises: [{ name: "Nieznane ćwiczenie xyz", sets: [set(12)] }] }),
        row(1, { kind: "cardio_log", title: "Bieg", exercises: [] }),
        row(45, { title: "Legs", exercises: [{ name: "Przysiad", sets: [set(5)] }] }),
      ],
      { now: NOW },
    );
    expect(plans.map((p) => p.planName)).toEqual(["Push", "Pull"]);
    expect(plans[0]!.exercises[0]).toMatchObject({ sets: 2, reps: 7 });
    expect(plans[1]!.exercises[0]!.categoryId).toBe("core");
    expect(plans[1]!.userCustomExerciseNames).toEqual(["Nieznane ćwiczenie xyz"]);
    for (const p of plans) expect(validateWorkoutPlanPayload(p).ok).toBe(true);
  });

  it("limit 6 planów i pusta historia", () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      row(i + 1, { title: `Dzień ${i}`, exercises: [{ name: "Podciąganie", sets: [set(5)] }] }),
    );
    expect(buildPlanDaysFromWorkouts(many, { now: NOW })).toHaveLength(6);
    expect(buildPlanDaysFromWorkouts([], { now: NOW })).toEqual([]);
    expect(buildPlanDaysFromWorkouts([{ date: NOW, exercises: "{zepsute" }], { now: NOW })).toEqual([]);
  });
});

describe("stany Pulpitu (Z58)", () => {
  it("baner onboardingu znika, gdy są treningi", () => {
    expect(shouldShowOnboarding({ onboardingCompleted: false, workoutCount: 0 })).toBe(true);
    expect(shouldShowOnboarding({ onboardingCompleted: false, workoutCount: 3 })).toBe(false);
    expect(shouldShowOnboarding({ onboardingCompleted: true, workoutCount: 0 })).toBe(false);
  });

  it("licznik raportów: tylko gdy > 0 albo konto < 14 dni", () => {
    const young = new Date(NOW - 5 * D);
    const old = new Date(NOW - 30 * D);
    expect(shouldShowReportCount({ reportCount: 0, accountCreatedAt: old, now: NOW })).toBe(false);
    expect(shouldShowReportCount({ reportCount: 0, accountCreatedAt: young, now: NOW })).toBe(true);
    expect(shouldShowReportCount({ reportCount: 2, accountCreatedAt: old, now: NOW })).toBe(true);
  });
});
