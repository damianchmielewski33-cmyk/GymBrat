import type { Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import { workouts } from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";
import { CATALOG_EXERCISES } from "@/lib/workout-exercise-catalog";

const state = vi.hoisted(() => ({ db: null as unknown as Database }));
vi.mock("@/db", () => ({ getDb: () => state.db }));

const { computeStrengthOverview } = await import("@/lib/strength-overview-service");

const TODAY = "2026-11-04";
const chest = CATALOG_EXERCISES.find((e) => e.categoryId === "chest")!;

/** 3 powtórzenia → e1RM = ciężar × 1,1 (bez błędu zaokrąglenia w asercjach). */
function sessionJson(name: string, weight: number) {
  return JSON.stringify({
    kind: "completed_session",
    exercises: [{ name, sets: [{ weight, reps: 3, done: true }] }],
  });
}

describe("computeStrengthOverview", () => {
  let client: Client;
  let db: Database;

  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
    state.db = db;
  });
  afterAll(() => client.close());
  beforeEach(async () => {
    await client.execute("DELETE FROM workouts");
  });

  // bieżące 30 dni: 06.10–04.11, poprzednie: 06.09–05.10
  async function seed(userId: string, name: string, prev: number, cur: number) {
    await db.insert(workouts).values([
      { userId, date: "2026-09-10", exercises: sessionJson(name, prev) },
      { userId, date: "2026-09-25", exercises: sessionJson(name, prev) },
      { userId, date: "2026-10-12", exercises: sessionJson(name, cur) },
      { userId, date: "2026-10-28", exercises: sessionJson(name, cur) },
    ]);
  }

  it("niepoprawne wejście (nieznany klucz, zły preset, zła data) → ok:false", async () => {
    for (const input of [
      { preset: "30", extra: 1 },
      { preset: "14" },
      { preset: "range", from: "2026-1-01", to: "2026-10-31" },
      null,
      "30",
    ]) {
      const res = await computeStrengthOverview("u1", input, TODAY);
      expect(res.ok).toBe(false);
    }
  });

  it("niepoprawny zakres (odwrócony, z przyszłości, za długi) → ok:false", async () => {
    for (const input of [
      { preset: "range", from: "2026-10-31", to: "2026-10-01" },
      { preset: "range", from: "2026-10-01", to: "2026-11-05" },
      { preset: "range", from: "2025-01-01", to: "2026-11-04" },
      { preset: "range" },
    ]) {
      const res = await computeStrengthOverview("u1", input, TODAY);
      expect(res.ok).toBe(false);
    }
  });

  it("liczy wynik z danych użytkownika (preset 30 dni)", async () => {
    await seed("u1", chest.name, 100, 110);
    const res = await computeStrengthOverview("u1", { preset: "30" }, TODAY);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.overview.from).toBe("2026-10-06");
    expect(res.overview.to).toBe(TODAY);
    expect(res.overview.exercises).toHaveLength(1);
    expect(res.overview.exercises[0]).toMatchObject({ status: "up", sessionsPrevious: 2, sessionsCurrent: 2 });
    expect(res.overview.exercises[0]!.deltaPct).toBe(10);
  });

  it("nie miesza danych innych użytkowników", async () => {
    await seed("u1", chest.name, 100, 110);
    await seed("u2", "Cudze ćwiczenie", 50, 20);
    const res = await computeStrengthOverview("u1", { preset: "30" }, TODAY);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.overview.exercises.map((e) => e.name)).toEqual([chest.name]);
    expect(res.overview.indexDeltaPct).toBe(10);

    const other = await computeStrengthOverview("u2", { preset: "30" }, TODAY);
    expect(other.ok && other.overview.exercises.map((e) => e.name)).toEqual(["Cudze ćwiczenie"]);
  });

  it("własny zakres jest włączny na obu końcach", async () => {
    await seed("u1", chest.name, 100, 110);
    const res = await computeStrengthOverview(
      "u1",
      { preset: "range", from: "2026-10-12", to: "2026-10-28" },
      TODAY,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.overview.days).toBe(17);
    expect(res.overview.exercises[0]!.sessionsCurrent).toBe(2);
  });

  it("brak danych → pusty wynik „za mało danych”", async () => {
    const res = await computeStrengthOverview("u1", { preset: "90" }, TODAY);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.overview.verdict).toBe("insufficient");
  });
});
