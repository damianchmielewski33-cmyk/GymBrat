import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { getDb } from "./index";

/** Uruchamia migracje SQL z `db/migrations` na aktualnym `TURSO_DATABASE_URL` (np. przy starcie serwera). */
export async function runMigrations(): Promise<void> {
  const db = getDb();
  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "db", "migrations"),
  });
}
