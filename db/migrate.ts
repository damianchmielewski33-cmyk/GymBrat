import path from "node:path";
import { access, constants } from "node:fs/promises";
import { migrate } from "drizzle-orm/libsql/migrator";
import { getDb } from "./index";

async function migrationsFolderReady(folder: string): Promise<boolean> {
  try {
    await access(path.join(folder, "meta", "_journal.json"), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function isAlreadyAppliedSchemaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /already exists|duplicate column|SQL_INPUT_ERROR/i.test(msg);
}

/**
 * Uruchamia migracje SQL z `db/migrations` na aktualnym `TURSO_DATABASE_URL`.
 * Na Vercel folder bywa poza tracingiem — wtedy pomijamy (schema i tak dopełnia `ensureCriticalSchema`).
 * Gdy baza była wcześniej zbudowana przez `ensureCriticalSchema` / inny host (ten sam Turso),
 * pierwszy CREATE TABLE pada na „already exists” — traktujemy to jako OK, nie blokujemy startu.
 */
export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.join(process.cwd(), "db", "migrations");
  if (!(await migrationsFolderReady(migrationsFolder))) {
    console.warn(
      "[migrate] Brak db/migrations/meta/_journal.json w runtime — pomijam Drizzle migrate (ensureCriticalSchema pokrywa schemat).",
    );
    return;
  }
  const db = getDb();
  try {
    await migrate(db, { migrationsFolder });
  } catch (err) {
    if (isAlreadyAppliedSchemaError(err)) {
      console.warn(
        "[migrate] Schemat już istnieje w Turso (np. po Vercel / ensureCriticalSchema) — pomijam konflikt migracji.",
      );
      return;
    }
    throw err;
  }
}
