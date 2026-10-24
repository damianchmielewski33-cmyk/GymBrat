import type { Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import { workoutPlans, workouts } from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";
import { loadWorkoutPlansWithLastWorkout } from "@/lib/workout-plans-with-last-workout";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDb: () => state.db }));

function planJson(name: string, exercises: number): string {
  return JSON.stringify({
    version: 2,
    path: "custom",
    planName: name,
    exercises: Array.from({ length: exercises }, (_, i) => ({
      id: `${name}-e${i}`,
      name: "Przysiad ze sztangą",
      categoryId: "quads",
      reps: 8,
      sets: 3,
    })),
    userCustomExerciseNames: [],
  });
}

describe("loadWorkoutPlansWithLastWorkout (baza w pamięci)", () => {
  let client: Client;
  let db: Database;

  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
    state.db = db;
  });

  afterAll(() => client.close());

  beforeEach(async () => {
    await client.execute("DELETE FROM workouts");
    await client.execute("DELETE FROM workout_plans");
  });

  const at = (day: number) => new Date(Date.UTC(2026, 0, day));

  it("dayNumber wg created_at niezależny od kolejki; zwrot w kolejności kolejki", async () => {
    await db.insert(workoutPlans).values([
      { id: "p-c", userId: "u1", planJson: planJson("C", 2), createdAt: at(3), updatedAt: at(9) },
      { id: "p-a", userId: "u1", planJson: planJson("A", 2), createdAt: at(1), updatedAt: at(1) },
      { id: "p-b", userId: "u1", planJson: planJson("B", 2), createdAt: at(2), updatedAt: at(2) },
    ]);
    await db.insert(workouts).values([
      { userId: "u1", workoutPlanId: "p-a", date: "2026-10-20", exercises: "{}" },
      { userId: "u1", workoutPlanId: "p-a", date: "2026-10-01", exercises: "{}" },
      { userId: "u1", workoutPlanId: "p-b", date: "2026-10-10", exercises: "{}" },
    ]);

    const rows = await loadWorkoutPlansWithLastWorkout("u1");
    expect(rows.map((r) => [r.id, r.dayNumber, r.lastWorkoutDate])).toEqual([
      ["p-c", 3, null],
      ["p-b", 2, "2026-10-10"],
      ["p-a", 1, "2026-10-20"],
    ]);
  });

  it("numeracja ciągła przy uszkodzonym JSON planu", async () => {
    await db.insert(workoutPlans).values([
      { id: "p1", userId: "u1", planJson: planJson("A", 1), createdAt: at(1) },
      { id: "p-bad", userId: "u1", planJson: "{nie-json", createdAt: at(2) },
      { id: "p-old", userId: "u1", planJson: JSON.stringify({ foo: 1 }), createdAt: at(3) },
      { id: "p2", userId: "u1", planJson: planJson("B", 1), createdAt: at(4) },
    ]);
    const rows = await loadWorkoutPlansWithLastWorkout("u1");
    expect(rows.map((r) => [r.id, r.dayNumber])).toEqual([
      ["p1", 1],
      ["p2", 2],
    ]);
  });

  it("filtr user_id: plany i treningi innego użytkownika nie wpływają na wynik", async () => {
    await db.insert(workoutPlans).values([
      { id: "p-other", userId: "u2", planJson: planJson("X", 1), createdAt: at(1) },
      { id: "p-mine", userId: "u1", planJson: planJson("A", 1), createdAt: at(2) },
    ]);
    await db.insert(workouts).values([
      { userId: "u2", workoutPlanId: "p-mine", date: "2026-10-20", exercises: "{}" },
      { userId: "u2", workoutPlanId: "p-other", date: "2026-10-20", exercises: "{}" },
    ]);
    const rows = await loadWorkoutPlansWithLastWorkout("u1");
    expect(rows.map((r) => [r.id, r.dayNumber, r.lastWorkoutDate])).toEqual([
      ["p-mine", 1, null],
    ]);
    expect(await loadWorkoutPlansWithLastWorkout("u3")).toEqual([]);
  });

  it("remis kolejki (nigdy niewykonane) → niższy numer dnia, nie ostatnio edytowany", async () => {
    await db.insert(workoutPlans).values([
      { id: "p1", userId: "u1", planJson: planJson("A", 1), createdAt: at(1), updatedAt: at(1) },
      { id: "p2", userId: "u1", planJson: planJson("B", 1), createdAt: at(2), updatedAt: at(20) },
    ]);
    const rows = await loadWorkoutPlansWithLastWorkout("u1");
    expect(rows.map((r) => r.id)).toEqual(["p1", "p2"]);
  });
});
