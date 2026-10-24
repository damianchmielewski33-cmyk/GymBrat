import type { Client } from "@libsql/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import { workouts } from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";
import { getTreningiHubStats } from "@/lib/treningi-hub-stats";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDb: () => state.db }));

const strength = JSON.stringify({
  kind: "completed_session",
  title: "Trening",
  exercises: [{ name: "Przysiad", sets: [{ reps: 5, weight: 100, done: true }] }],
});
const cardio = JSON.stringify({ kind: "cardio_log", title: "Rower" });

describe("getTreningiHubStats (baza w pamięci)", () => {
  let client: Client;
  let db: Database;

  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
    state.db = db;
    await db.insert(workouts).values([
      { id: "w-07", userId: "u1", date: "2026-10-07", exercises: strength },
      { id: "w-18", userId: "u1", date: "2026-10-18", exercises: strength },
      { id: "w-19", userId: "u1", date: "2026-10-19", exercises: strength },
      { id: "w-20", userId: "u1", date: "2026-10-20", cardioMinutes: 30, exercises: cardio },
      { id: "w-25", userId: "u1", date: "2026-10-25", exercises: strength },
      { id: "w-other", userId: "u2", date: "2026-10-21", exercises: strength },
    ]);
  });

  afterAll(() => client.close());

  it("przekazany todayKey wyznacza tydzień pon–niedz.", async () => {
    const week = await getTreningiHubStats("u1", "2026-10-21");
    expect(week.workoutsThisWeek).toBe(2);
    expect(week.cardioMinutesThisWeek).toBe(30);
    expect(week.cardioSessionsThisWeek).toBe(1);
    expect(week.tonnageThisWeekKg).toBe(1000);

    const previous = await getTreningiHubStats("u1", "2026-10-14");
    expect(previous.workoutsThisWeek).toBe(1);
    expect(previous.cardioMinutesThisWeek).toBe(0);
  });

  it("niedziela należy do tygodnia od poniedziałku", async () => {
    expect((await getTreningiHubStats("u1", "2026-10-25")).workoutsThisWeek).toBe(2);
  });

  it("streakWeeks bez zmian (P-4): pusty bieżący tydzień przerywa serię", async () => {
    expect((await getTreningiHubStats("u1", "2026-10-21")).streakWeeks).toBe(3);
    expect((await getTreningiHubStats("u1", "2026-10-26")).streakWeeks).toBe(0);
  });

  it("dane innego użytkownika nie wpływają na statystyki", async () => {
    const stats = await getTreningiHubStats("u1", "2026-10-21");
    expect(stats.recentWorkouts.map((w) => w.id)).not.toContain("w-other");
  });
});
