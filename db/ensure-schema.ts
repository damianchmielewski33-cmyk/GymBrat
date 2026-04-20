import type { Client } from "@libsql/client";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { getDb } from "./index";
import * as schema from "./schema";

type DbWithClient = LibSQLDatabase<typeof schema> & { $client: Client };

/**
 * Uzupełnia braki w schemacie bez polegania na plikach `db/migrations` w paczce serwera (Vercel).
 * Idempotentne — bezpieczne przy każdym starcie / pierwszym zapytaniu.
 */
export async function ensureCriticalSchema(): Promise<void> {
  const db = getDb() as DbWithClient;
  await db.$client.execute(`
CREATE TABLE IF NOT EXISTS "meal_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "date" text NOT NULL,
  "name" text,
  "calories" real NOT NULL,
  "protein_g" real NOT NULL,
  "fat_g" real NOT NULL,
  "carbs_g" real NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "idx_meal_logs_user_date" ON "meal_logs" ("user_id","date")`,
  );
}

let mealLogsEnsured = false;

/** Jednorazowo na proces — przed SELECT na meal_logs (np. gdy migracje plikowe nie dołączyły się do deployu). */
export async function ensureMealLogsTableOncePerProcess(): Promise<void> {
  if (mealLogsEnsured) return;
  await ensureCriticalSchema();
  mealLogsEnsured = true;
}
