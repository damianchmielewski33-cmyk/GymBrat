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
});
