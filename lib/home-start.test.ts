import type { Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import { workoutPlans, workouts } from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";
import {
  consecutiveWorkoutStreakFromKeys,
  consecutiveWorkoutWeeksFromKeys,
  getNextWorkoutPlan,
  mergeWeightPointsByDay,
} from "@/lib/home-start";
import { pickNextWorkoutPlan } from "@/lib/workout-plan-queue";
import { loadWorkoutPlansWithLastWorkout } from "@/lib/workout-plans-with-last-workout";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDb: () => state.db }));

describe("consecutiveWorkoutStreakFromKeys", () => {
  it("liczy serię od dziś wstecz", () => {
    const keys = new Set(["2026-09-19", "2026-09-18", "2026-09-17"]);
    expect(consecutiveWorkoutStreakFromKeys("2026-09-19", keys)).toBe(3);
  });

  it("przerywa przy braku dnia", () => {
    const keys = new Set(["2026-09-19", "2026-09-17"]);
    expect(consecutiveWorkoutStreakFromKeys("2026-09-19", keys)).toBe(1);
  });

  it("zwraca 0 gdy dziś bez treningu", () => {
    const keys = new Set(["2026-09-18"]);
    expect(consecutiveWorkoutStreakFromKeys("2026-09-19", keys)).toBe(0);
  });
});

describe("consecutiveWorkoutWeeksFromKeys", () => {
  // 2026-09-25 = piątek; tydzień pon–niedz: 21–27 wrz
  it("liczy kolejne tygodnie z treningiem", () => {
    const keys = new Set([
      "2026-09-22", // ten tydzień
      "2026-09-15", // poprzedni
      "2026-09-08", // jeszcze wcześniejszy
    ]);
    expect(consecutiveWorkoutWeeksFromKeys("2026-09-25", keys)).toBe(3);
  });

  it("pomija pusty bieżący tydzień i liczy wcześniejsze", () => {
    const keys = new Set(["2026-09-15", "2026-09-08"]);
    expect(consecutiveWorkoutWeeksFromKeys("2026-09-25", keys)).toBe(2);
  });

  it("przerywa przy pustym tygodniu w środku", () => {
    const keys = new Set(["2026-09-22", "2026-09-08"]);
    expect(consecutiveWorkoutWeeksFromKeys("2026-09-25", keys)).toBe(1);
  });
});

describe("mergeWeightPointsByDay", () => {
  it("łączy wagi z raportu i ważenia — nowszy wygrywa", () => {
    const merged = mergeWeightPointsByDay([
      { date: "2026-09-01", kg: 80, atMs: 1 },
      { date: "2026-09-10", kg: 79, atMs: 10 },
      { date: "2026-09-10", kg: 78.5, atMs: 20 },
    ]);
    expect(merged).toEqual([
      { date: "2026-09-01", kg: 80 },
      { date: "2026-09-10", kg: 78.5 },
    ]);
  });
});

describe("getNextWorkoutPlan (regresja: wspólna kolejka z ekranem Trening)", () => {
  let client: Client;
  let db: Database;
  const at = (day: number) => new Date(Date.UTC(2026, 0, day));
  const planJson = (name: string, exerciseNames: string[]) =>
    JSON.stringify({
      version: 2,
      path: "custom",
      planName: name,
      exercises: exerciseNames.map((n, i) => ({
        id: `${name}-${i}`,
        name: n,
        categoryId: "chest",
        reps: 8,
        sets: 3,
      })),
      userCustomExerciseNames: [],
    });

  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
    state.db = db;
  });

  afterAll(() => client.close());

  beforeEach(async () => {
    await client.execute("DELETE FROM workouts");
    await client.execute("DELETE FROM workout_plans");
  });

  it("remis nigdy niewykonanych → najniższy numer dnia (nie ostatnio edytowany); kształt bez zmian", async () => {
    await db.insert(workoutPlans).values([
      { id: "p1", userId: "u1", planJson: planJson("Push", ["Wyciskanie", " ", "Pompki"]), createdAt: at(1), updatedAt: at(1) },
      { id: "p2", userId: "u1", planJson: planJson("Pull", ["Wiosłowanie"]), createdAt: at(2), updatedAt: at(30) },
      { id: "p3", userId: "u1", planJson: planJson("Legs", ["Przysiad"]), createdAt: at(3), updatedAt: at(3) },
    ]);
    await db.insert(workouts).values({
      userId: "u1",
      workoutPlanId: "p3",
      date: "2026-10-20",
      exercises: "{}",
    });

    const next = await getNextWorkoutPlan("u1");
    expect(next).toEqual({
      planId: "p1",
      planName: "Push",
      exerciseCount: 3,
      lastWorkoutDate: null,
      exerciseNames: ["Wyciskanie", "Pompki"],
      firstTime: true,
    });
    expect(next?.planId).toBe(pickNextWorkoutPlan(await loadWorkoutPlansWithLastWorkout("u1"))?.id);
  });

  it("pusty dzień nie jest polecany, gdy istnieje dzień z ćwiczeniami (BR-4)", async () => {
    await db.insert(workoutPlans).values([
      { id: "p-empty", userId: "u1", planJson: planJson("Pusty", []), createdAt: at(1), updatedAt: at(40) },
      { id: "p-full", userId: "u1", planJson: planJson("Full", ["Przysiad"]), createdAt: at(2), updatedAt: at(2) },
    ]);
    await db.insert(workouts).values({
      userId: "u1",
      workoutPlanId: "p-full",
      date: "2026-10-20",
      exercises: "{}",
    });
    const next = await getNextWorkoutPlan("u1");
    expect(next).toMatchObject({ planId: "p-full", firstTime: false, lastWorkoutDate: "2026-10-20" });
  });

  it("najstarsza data wygrywa; brak planów → null", async () => {
    expect(await getNextWorkoutPlan("u1")).toBeNull();
    await db.insert(workoutPlans).values([
      { id: "p1", userId: "u1", planJson: planJson("A", ["Przysiad"]), createdAt: at(1) },
      { id: "p2", userId: "u1", planJson: planJson("B", ["Przysiad"]), createdAt: at(2) },
    ]);
    await db.insert(workouts).values([
      { userId: "u1", workoutPlanId: "p1", date: "2026-10-20", exercises: "{}" },
      { userId: "u1", workoutPlanId: "p2", date: "2026-10-05", exercises: "{}" },
    ]);
    expect((await getNextWorkoutPlan("u1"))?.planId).toBe("p2");
  });
});
