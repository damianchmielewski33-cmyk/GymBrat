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

/**
 * Uruchamia migracje SQL z `db/migrations` na aktualnym `TURSO_DATABASE_URL`.
 * Na Vercel folder bywa poza tracingiem — wtedy pomijamy (schema i tak dopełnia `ensureCriticalSchema`).
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
  await migrate(db, { migrationsFolder });
}
