import type { Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import { workouts } from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";
import {
  extractExerciseLastLoads,
  getLastSessionLoadsForPlan,
  pickHeaviestCompletedSet,
} from "@/lib/plan-last-session-loads";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDb: () => state.db }));

const done = (weight: unknown, reps: unknown, extra: Record<string, unknown> = {}) => ({
  weight,
  reps,
  done: true,
  ...extra,
});

describe("pickHeaviestCompletedSet", () => {
  it("najcięższa seria, remis ciężaru → więcej powtórzeń", () => {
    expect(
      pickHeaviestCompletedSet([done(80, 8), done(82.5, 5), done(82.5, 6), done(70, 12)]),
    ).toEqual({ weightKg: 82.5, reps: 6 });
  });

  it("pomija skipped, done: false, powtórzenia 0/null/NaN i wartości ujemne", () => {
    expect(
      pickHeaviestCompletedSet([
        done(200, 5, { skipped: true }),
        { weight: 150, reps: 5, done: false },
        done(140, 0),
        done(130, null),
        done(120, "abc"),
        done(110, -3),
        done(-100, 5),
        done("x", 5),
        done(60, 10),
      ]),
    ).toEqual({ weightKg: 60, reps: 10 });
  });

  it("same serie 0 kg → masa ciała z max powtórzeń", () => {
    expect(pickHeaviestCompletedSet([done(0, 10), done(0, 14), done(undefined, 12)])).toEqual({
      weightKg: 0,
      reps: 14,
    });
  });

  it("seria z ciężarem wygrywa z serią masy ciała", () => {
    expect(pickHeaviestCompletedSet([done(0, 20), done(10, 6)])).toEqual({
      weightKg: 10,
      reps: 6,
    });
  });

  it("seria pominięta z ciężarem 0 (zapis z sesji: skipped: true) nie jest masą ciała", () => {
    expect(pickHeaviestCompletedSet([done(0, 10, { skipped: true })])).toBeNull();
  });

  it("brak kandydatów → null", () => {
    expect(pickHeaviestCompletedSet([])).toBeNull();
    expect(pickHeaviestCompletedSet([{ weight: 50, reps: 5 }])).toBeNull();
  });

  it("akceptuje liczby zapisane jako tekst", () => {
    expect(pickHeaviestCompletedSet([done("52.5", "6")])).toEqual({ weightKg: 52.5, reps: 6 });
  });
});

describe("extractExerciseLastLoads", () => {
  const plan = [
    { id: "e1", name: "Wyciskanie sztangi na ławce poziomej" },
    { id: "e2", name: "Przysiad ze sztangą" },
    { id: "e3", name: "Pompki" },
  ];

  it("dopasowuje po id, potem po tożsamości nazwy (alias EN z katalogu)", () => {
    const json = JSON.stringify({
      kind: "completed_session",
      exercises: [
        { id: "other", name: "Bench Press", sets: [done(80, 8)] },
        { id: "e2", name: "Zmieniona nazwa", sets: [done(100, 5)] },
      ],
    });
    expect(extractExerciseLastLoads(json, plan)).toEqual({
      e1: { weightKg: 80, reps: 8 },
      e2: { weightKg: 100, reps: 5 },
    });
  });

  it("id wygrywa z dopasowaniem po nazwie", () => {
    const json = JSON.stringify({
      exercises: [
        { id: "x", name: "Wyciskanie sztangi na ławce poziomej", sets: [done(60, 8)] },
        { id: "e1", name: "Coś innego", sets: [done(90, 3)] },
      ],
    });
    expect(extractExerciseLastLoads(json, plan).e1).toEqual({ weightKg: 90, reps: 3 });
  });

  it("ćwiczenie nieobecne albo bez wykonanych serii → brak klucza", () => {
    const json = JSON.stringify({
      exercises: [{ id: "e2", name: "Przysiad ze sztangą", sets: [done(100, 5, { skipped: true })] }],
    });
    expect(extractExerciseLastLoads(json, plan)).toEqual({});
  });

  it("uszkodzony JSON lub nieoczekiwany kształt → {} bez wyjątku i bez logowania (LR-1)", () => {
    const spies = (["error", "warn", "log", "info", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    expect(extractExerciseLastLoads("{\"exercises\": [ {\"name\": \"Przysiad 120 kg", plan)).toEqual(
      {},
    );
    expect(extractExerciseLastLoads("null", plan)).toEqual({});
    expect(extractExerciseLastLoads(JSON.stringify({ exercises: "x" }), plan)).toEqual({});
    expect(
      extractExerciseLastLoads(JSON.stringify({ exercises: [null, { id: "e1", sets: "x" }] }), plan),
    ).toEqual({});
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });

  it("wynik ma zwykły Object.prototype (serializowalny do Client Component)", () => {
    const result = extractExerciseLastLoads(
      JSON.stringify({ exercises: [{ id: "e1", name: "Wyciskanie sztangi na ławce poziomej", sets: [done(80, 5)] }] }),
      plan,
    );
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  it("id ćwiczenia `__proto__` jest zwykłym kluczem, bez zanieczyszczenia globalnego Object.prototype", () => {
    const json = JSON.stringify({
      exercises: [{ id: "__proto__", name: "Przysiad", sets: [done(80, 5)] }],
    });
    const result = extractExerciseLastLoads(json, [{ id: "__proto__", name: "Przysiad" }]);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.keys(result)).toEqual(["__proto__"]);
    expect(result["__proto__"]).toEqual({ weightKg: 80, reps: 5 });
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, "weightKg")).toBe(false);
    expect(({} as { weightKg?: number }).weightKg).toBeUndefined();
  });
});

describe("getLastSessionLoadsForPlan (baza w pamięci)", () => {
  let client: Client;
  let db: Database;
  const plan = [{ id: "e1", name: "Przysiad ze sztangą" }];
  const session = (weight: number) =>
    JSON.stringify({ exercises: [{ id: "e1", name: "Przysiad ze sztangą", sets: [done(weight, 5)] }] });

  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
    state.db = db;
  });

  afterAll(() => client.close());

  beforeEach(async () => {
    await client.execute("DELETE FROM workouts");
  });

  it("bierze najnowszą sesję planu, remis daty → później wstawiona", async () => {
    await db.insert(workouts).values([
      { id: "w-old", userId: "u1", workoutPlanId: "p1", date: "2026-10-01", exercises: session(90) },
      { id: "w-z", userId: "u1", workoutPlanId: "p1", date: "2026-10-10", exercises: session(100) },
      { id: "w-a", userId: "u1", workoutPlanId: "p1", date: "2026-10-10", exercises: session(105) },
    ]);
    expect(await getLastSessionLoadsForPlan("u1", "p1", plan)).toEqual({
      e1: { weightKg: 105, reps: 5 },
    });
  });

  it("ignoruje sesje innego użytkownika i innego planu", async () => {
    await db.insert(workouts).values([
      { id: "w1", userId: "u1", workoutPlanId: "p1", date: "2026-10-01", exercises: session(90) },
      { id: "w2", userId: "u2", workoutPlanId: "p1", date: "2026-10-20", exercises: session(300) },
      { id: "w3", userId: "u1", workoutPlanId: "p2", date: "2026-10-20", exercises: session(200) },
    ]);
    expect(await getLastSessionLoadsForPlan("u1", "p1", plan)).toEqual({
      e1: { weightKg: 90, reps: 5 },
    });
    expect(await getLastSessionLoadsForPlan("u3", "p1", plan)).toEqual({});
  });

  it("ostatnia sesja bez ćwiczenia → brak klucza (bez sięgania do starszych sesji)", async () => {
    await db.insert(workouts).values([
      { id: "w1", userId: "u1", workoutPlanId: "p1", date: "2026-10-01", exercises: session(90) },
      {
        id: "w2",
        userId: "u1",
        workoutPlanId: "p1",
        date: "2026-10-08",
        exercises: JSON.stringify({ exercises: [] }),
      },
    ]);
    expect(await getLastSessionLoadsForPlan("u1", "p1", plan)).toEqual({});
  });

  it("ponawia zapytanie po chwilowym błędzie Turso, bez logowania (LR-1)", async () => {
    await db.insert(workouts).values([
      { id: "w1", userId: "u1", workoutPlanId: "p1", date: "2026-10-01", exercises: session(90) },
    ]);
    const select = vi
      .fn()
      .mockImplementationOnce(() => {
        throw Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
      })
      .mockImplementation((...args: Parameters<Database["select"]>) => db.select(...args));
    state.db = { select };
    const spies = (["error", "warn", "log", "info", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    try {
      const pending = getLastSessionLoadsForPlan("u1", "p1", plan);
      await vi.advanceTimersByTimeAsync(250);
      expect(await pending).toEqual({ e1: { weightKg: 90, reps: 5 } });
      expect(select).toHaveBeenCalledTimes(2);
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      for (const spy of spies) spy.mockRestore();
      state.db = db;
    }
  });

  it("błąd niechwilowy nie jest ponawiany", async () => {
    const select = vi.fn(() => {
      throw new Error("SQLITE_ERROR: no such column");
    });
    state.db = { select };
    try {
      await expect(getLastSessionLoadsForPlan("u1", "p1", plan)).rejects.toThrow("no such column");
      expect(select).toHaveBeenCalledTimes(1);
    } finally {
      state.db = db;
    }
  });
});
