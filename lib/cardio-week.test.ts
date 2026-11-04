import type { Client } from "@libsql/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import { userSettings, workouts } from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";
import { getCardioWeekSummary } from "@/lib/cardio-week";
import { getTreningiHubStats } from "@/lib/treningi-hub-stats";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDb: () => state.db }));

const cardio = JSON.stringify({ kind: "cardio_log", title: "Bieg" });

describe("getCardioWeekSummary (baza w pamięci)", () => {
  let client: Client;
  let db: Database;

  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
    state.db = db;
    await db.insert(userSettings).values([
      { userId: "cal", weeklyCardioGoalMinutes: 100 },
      { userId: "roll", weeklyCardioGoalMinutes: 100, cardioWeekMode: "rolling" },
    ]);
    // Środa 2026-11-04: poprzedni tydzień (pt 10-30) i bieżący (wt 11-03). Brak planu.
    for (const userId of ["cal", "roll", "noset"]) {
      await db.insert(workouts).values([
        { id: `${userId}-a`, userId, date: "2026-10-30", cardioMinutes: 45, exercises: cardio },
        { id: `${userId}-b`, userId, date: "2026-11-03", cardioMinutes: 20, exercises: cardio },
      ]);
    }
  });

  afterAll(() => client.close());

  it("domyślnie tydzień pon–niedz: 20 min, także bez planu i bez ustawień", async () => {
    for (const userId of ["cal", "noset"]) {
      const s = await getCardioWeekSummary(userId, { todayKey: "2026-11-04" });
      expect(s.minutes).toBe(20);
      expect(s.sessions).toBe(1);
      expect(s.range).toEqual({ mode: "calendar", from: "2026-11-02", to: "2026-11-08" });
    }
    expect((await getCardioWeekSummary("noset", { todayKey: "2026-11-04" })).goalMinutes).toBe(150);
  });

  it("tryb rolling z ustawień: ostatnie 7 dni = 65 min", async () => {
    const s = await getCardioWeekSummary("roll", { todayKey: "2026-11-04" });
    expect(s.mode).toBe("rolling");
    expect(s.minutes).toBe(65);
    expect(s.percent).toBe(65);
  });

  it("Pulpit i Trening dają tę samą liczbę minut", async () => {
    const summary = await getCardioWeekSummary("cal", { todayKey: "2026-11-04" });
    const hub = await getTreningiHubStats("cal", "2026-11-04");
    expect(hub.cardioMinutesThisWeek).toBe(summary.minutes);
    expect(hub.cardioGoalMinutes).toBe(summary.goalMinutes);
  });
});
