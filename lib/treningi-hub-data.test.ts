import type { Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import type { Database } from "@/db";
import { workoutPlans, workouts } from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";
import { buildTreningiHubDays, getTreningiHubData } from "@/lib/treningi-hub-data";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDb: () => state.db }));

const loadsSpy = vi.hoisted(() => ({ calls: 0 }));
vi.mock("@/lib/plan-last-session-loads", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/plan-last-session-loads")>();
  return {
    ...mod,
    getLastSessionLoadsForPlan: (...args: Parameters<typeof mod.getLastSessionLoadsForPlan>) => {
      loadsSpy.calls += 1;
      return mod.getLastSessionLoadsForPlan(...args);
    },
  };
});

const SQUAT = "Przysiad ze sztangą";

function row(
  id: string,
  dayNumber: number,
  lastWorkoutDate: string | null,
): WorkoutPlanWithLastWorkoutDTO {
  return {
    id,
    dayNumber,
    lastWorkoutDate,
    updatedAt: "2026-01-01T00:00:00.000Z",
    plan: {
      version: 2,
      path: "custom",
      planName: id,
      exercises: [{ id: `${id}-e`, name: SQUAT, categoryId: "quads", reps: 5, sets: 3 }],
      userCustomExerciseNames: [],
    },
  };
}

const WEEK = { todayKey: "2026-10-21", startKey: "2026-10-19", endKey: "2026-10-25" };

describe("buildTreningiHubDays", () => {
  it("sortuje po dayNumber i nie mutuje wejścia", () => {
    const plans = Object.freeze([row("c", 3, null), row("a", 1, null), row("b", 2, null)]);
    expect(buildTreningiHubDays(plans, WEEK).map((d) => d.row.dayNumber)).toEqual([1, 2, 3]);
    expect(plans.map((p) => p.id)).toEqual(["c", "a", "b"]);
  });

  it("doneThisWeek na granicach tygodnia", () => {
    const days = buildTreningiHubDays(
      [
        row("mon", 1, "2026-10-19"),
        row("sun", 2, "2026-10-25"),
        row("prevSun", 3, "2026-10-18"),
        row("nextMon", 4, "2026-10-26"),
        row("never", 5, null),
      ],
      WEEK,
    );
    expect(days.map((d) => [d.row.id, d.doneThisWeek])).toEqual([
      ["mon", true],
      ["sun", true],
      ["prevSun", false],
      ["nextMon", false],
      ["never", false],
    ]);
  });

  it("liczy partie mięśni dnia", () => {
    const [day] = buildTreningiHubDays([row("a", 1, null)], WEEK);
    expect(day?.muscles?.groups).toEqual(["nogi"]);
  });
});

describe("getTreningiHubData (baza w pamięci)", () => {
  let client: Client;
  let db: Database;
  const at = (day: number) => new Date(Date.UTC(2026, 0, day));
  const planJson = (name: string, exerciseIds: string[]) =>
    JSON.stringify({
      version: 2,
      path: "custom",
      planName: name,
      exercises: exerciseIds.map((id) => ({ id, name: SQUAT, categoryId: "quads", reps: 5, sets: 3 })),
      userCustomExerciseNames: [],
    });
  const session = (weights: Record<string, number>) =>
    JSON.stringify({
      exercises: Object.entries(weights).map(([id, weight]) => ({
        id,
        name: "x",
        sets: [{ weight, reps: 5, done: true }],
      })),
    });

  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
    state.db = db;
  });

  afterAll(() => client.close());

  beforeEach(async () => {
    loadsSpy.calls = 0;
    await client.execute("DELETE FROM workouts");
    await client.execute("DELETE FROM workout_plans");
  });

  it("kontrakt TreningiHubData: dokładnie 4 pola, bez danych użytkownika brak planu i obciążeń", async () => {
    const hub = await getTreningiHubData("brak-takiego", "2026-10-21");
    expect(Object.keys(hub).sort()).toEqual(["days", "nextLastLoads", "nextPlanId", "week"]);
    expect(hub.days).toEqual([]);
    expect(hub.nextPlanId).toBeNull();
    expect(hub.nextLastLoads).toEqual({});
  });

  it("nie pyta o obciążenia, gdy następny dzień nigdy nie był robiony", async () => {
    await db.insert(workoutPlans).values([
      { id: "p1", userId: "u1", planJson: planJson("A", ["a1"]), createdAt: at(1) },
      { id: "p2", userId: "u1", planJson: planJson("B", ["b1"]), createdAt: at(2) },
    ]);
    await db.insert(workouts).values({
      userId: "u1",
      workoutPlanId: "p1",
      date: "2026-10-20",
      exercises: session({ a1: 100 }),
    });
    const hub = await getTreningiHubData("u1", "2026-10-21");
    expect(hub.nextPlanId).toBe("p2");
    expect(hub.nextLastLoads).toEqual({});
    expect(loadsSpy.calls).toBe(0);
    expect(hub.week).toEqual(WEEK);
    expect(hub.days.map((d) => [d.row.id, d.doneThisWeek])).toEqual([
      ["p1", true],
      ["p2", false],
    ]);
  });

  it("wielokrotne wykonanie dnia w tygodniu = jedno wypełnienie; obciążenia tylko 3 pierwszych ćwiczeń", async () => {
    await db.insert(workoutPlans).values([
      { id: "p1", userId: "u1", planJson: planJson("A", ["a1", "a2", "a3", "a4"]), createdAt: at(1) },
      { id: "p2", userId: "u1", planJson: planJson("B", ["b1"]), createdAt: at(2) },
    ]);
    await db.insert(workouts).values([
      { userId: "u1", workoutPlanId: "p2", date: "2026-10-20", exercises: session({ b1: 50 }) },
      { userId: "u1", workoutPlanId: "p2", date: "2026-10-21", exercises: session({ b1: 55 }) },
      {
        userId: "u1",
        workoutPlanId: "p1",
        date: "2026-10-12",
        exercises: session({ a1: 100, a2: 80, a3: 60, a4: 40 }),
      },
    ]);
    const hub = await getTreningiHubData("u1", "2026-10-21");
    expect(hub.days.filter((d) => d.doneThisWeek).map((d) => d.row.id)).toEqual(["p2"]);
    expect(hub.nextPlanId).toBe("p1");
    expect(loadsSpy.calls).toBe(1);
    expect(hub.nextLastLoads).toEqual({
      a1: { weightKg: 100, reps: 5 },
      a2: { weightKg: 80, reps: 5 },
      a3: { weightKg: 60, reps: 5 },
    });
  });

  it("AC-3.7: serie zapisane jako pominięte (0 kg, skipped) nie dają obciążenia - zostaje zamiennik z planu", async () => {
    await db.insert(workoutPlans).values([
      { id: "p1", userId: "u1", planJson: planJson("A", ["a1", "a2"]), createdAt: at(1) },
    ]);
    await db.insert(workouts).values({
      userId: "u1",
      workoutPlanId: "p1",
      date: "2026-10-12",
      exercises: JSON.stringify({
        exercises: [
          { id: "a1", name: "x", sets: [{ weight: 0, reps: 12, done: true, skipped: true }] },
          {
            id: "a2",
            name: "y",
            sets: [
              { weight: 0, reps: 12, done: true, skipped: true },
              { weight: 40, reps: 8, done: true, skipped: false },
            ],
          },
        ],
      }),
    });
    const hub = await getTreningiHubData("u1", "2026-10-21");
    expect(hub.nextPlanId).toBe("p1");
    expect(hub.nextLastLoads).toEqual({ a2: { weightKg: 40, reps: 8 } });
  });

  it("jeden dzień planu: jest jednocześnie następny, jeden segment, bez błędu bez historii", async () => {
    await db.insert(workoutPlans).values([
      { id: "p1", userId: "u1", planJson: planJson("Solo", ["a1"]), createdAt: at(1) },
    ]);
    const hub = await getTreningiHubData("u1", "2026-10-21");
    expect(hub.days).toHaveLength(1);
    expect(hub.days[0]).toMatchObject({ doneThisWeek: false });
    expect(hub.days[0]!.row.dayNumber).toBe(1);
    expect(hub.nextPlanId).toBe("p1");
    expect(hub.nextLastLoads).toEqual({});
  });

  it("10 dni: stałe numery 1..10, pusty dzień nie jest następny, gdy są dni z ćwiczeniami", async () => {
    await db.insert(workoutPlans).values(
      Array.from({ length: 10 }, (_, i) => ({
        id: `p${i + 1}`,
        userId: "u1",
        planJson: planJson(`D${i + 1}`, i === 0 ? [] : [`e${i + 1}`]),
        createdAt: at(i + 1),
      })),
    );
    const hub = await getTreningiHubData("u1", "2026-10-21");
    expect(hub.days.map((d) => d.row.dayNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(hub.nextPlanId).toBe("p2");
  });

  it("brak planów → pusty hub", async () => {
    const hub = await getTreningiHubData("u1", "2026-10-21");
    expect(hub).toEqual({ week: WEEK, days: [], nextPlanId: null, nextLastLoads: {} });
  });
});
