import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createMemoryDb } from "@/db/test-memory-db";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db/index", () => ({ getDb: () => state.db }));

const INDEXES = ["idx_workouts_user_plan_date", "idx_workouts_user_date"];
const LAST_SESSION_SQL =
  "SELECT exercises FROM workouts WHERE user_id = 'u1' AND workout_plan_id = 'p1' ORDER BY date DESC, rowid DESC LIMIT 1";

async function workoutIndexNames(client: Client): Promise<string[]> {
  const rs = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'workouts' AND name LIKE 'idx_workouts_%' ORDER BY name",
  );
  return rs.rows.map((r) => String(r.name));
}

async function queryPlan(client: Client, sql: string): Promise<string> {
  const rs = await client.execute(`EXPLAIN QUERY PLAN ${sql}`);
  return rs.rows.map((r) => String(r.detail)).join(" | ");
}

describe("indeksy tabeli workouts", () => {
  let client: Client;

  beforeAll(async () => {
    ({ client } = await createMemoryDb());
  });
  afterAll(() => client.close());

  it("schemat Drizzle tworzy oba indeksy", async () => {
    expect(await workoutIndexNames(client)).toEqual([...INDEXES].sort());
  });

  it("zapytanie „ostatnia sesja planu” używa indeksu (SEARCH, bez SCAN i TEMP B-TREE)", async () => {
    const plan = await queryPlan(client, LAST_SESSION_SQL);
    expect(plan).toContain("SEARCH");
    expect(plan).toContain("idx_workouts_user_plan_date");
    expect(plan).not.toMatch(/SCAN|TEMP B-TREE/);
  });

  it("migracja 0032 jest idempotentna i tworzy indeksy na istniejących danych", async () => {
    const legacy = createClient({ url: ":memory:" });
    try {
      await legacy.execute(
        "CREATE TABLE workouts (id text PRIMARY KEY NOT NULL, user_id text NOT NULL, workout_plan_id text, date text NOT NULL, cardio_minutes integer NOT NULL DEFAULT 0, exercises text NOT NULL)",
      );
      await legacy.execute(
        "INSERT INTO workouts (id, user_id, workout_plan_id, date, exercises) VALUES ('w1','u1','p1','2026-10-01','{}')",
      );
      const sql = readFileSync(
        path.join(process.cwd(), "db", "migrations", "0032_workouts_user_indexes.sql"),
        "utf8",
      );
      const statements = sql.split("--> statement-breakpoint").map((s) => s.trim());
      for (let run = 0; run < 2; run++) {
        for (const statement of statements) await legacy.execute(statement);
      }
      expect(await workoutIndexNames(legacy)).toEqual([...INDEXES].sort());
      const count = await legacy.execute("SELECT COUNT(*) AS c FROM workouts");
      expect(Number(count.rows[0]?.c)).toBe(1);
    } finally {
      legacy.close();
    }
  });

  it("ensureCriticalSchema dopisuje brakujące indeksy idempotentnie", async () => {
    const { client: bare, db } = await createMemoryDb();
    try {
      for (const name of INDEXES) await bare.execute(`DROP INDEX "${name}"`);
      expect(await workoutIndexNames(bare)).toEqual([]);
      state.db = db;
      const { ensureCriticalSchema } = await import("@/db/ensure-schema");
      await ensureCriticalSchema();
      expect(await workoutIndexNames(bare)).toEqual([...INDEXES].sort());
    } finally {
      bare.close();
    }
  });

  it("ensureCriticalSchema dopisuje kolumnę operation_id i indeks uq_workouts_user_operation, gdy migracja 0033 nie została uruchomiona (P3)", async () => {
    // Symuluje produkcję zainicjalizowaną wyłącznie przez ensure-schema (bez folderu
    // db/migrations w paczce, patrz docs/wydajnosc/005-koniec-treningu-przeplyw.md P3):
    // pełny schemat Drizzle jest obecny, ale bez kolumny/indeksu z migracji 0033.
    const { client: bare, db } = await createMemoryDb();
    try {
      await bare.execute(`DROP INDEX "uq_workouts_user_operation"`);
      await bare.execute(`ALTER TABLE "workouts" DROP COLUMN "operation_id"`);
      const columnsBefore = await bare.execute("PRAGMA table_info(workouts)");
      expect(columnsBefore.rows.some((r) => String(r.name) === "operation_id")).toBe(false);
      await bare.execute(
        "INSERT INTO workouts (id, user_id, date, cardio_minutes, exercises) VALUES ('w1','u1','2026-10-01',0,'{}')",
      );

      state.db = db;
      // `ensureCriticalSchema` memoizuje sukces per proces (patrz docstring w db/ensure-schema.ts);
      // testy wcześniejsze w tym pliku już go wywołały, więc wymuszamy świeży import modułu.
      vi.resetModules();
      const fresh = await import("@/db/ensure-schema");
      await fresh.ensureCriticalSchema();

      const columnsAfter = await bare.execute("PRAGMA table_info(workouts)");
      expect(columnsAfter.rows.some((r) => String(r.name) === "operation_id")).toBe(true);
      const indexNames = await bare.execute(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'workouts' AND name = 'uq_workouts_user_operation'",
      );
      expect(indexNames.rows.length).toBe(1);

      // Idempotencja: druga próba (kolumna i indeks już istnieją) nie rzuca.
      await fresh.ensureCriticalSchema();

      const count = await bare.execute("SELECT COUNT(*) AS c FROM workouts");
      expect(Number(count.rows[0]?.c)).toBe(1);
    } finally {
      bare.close();
    }
  });
});
