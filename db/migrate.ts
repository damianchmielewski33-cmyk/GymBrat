import path from "node:path";
import type { Client } from "@libsql/client";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { getDb, type Database } from "./index";

const MIGRATIONS_TABLE = "__drizzle_migrations";

type DbWithClient = Database & { $client: Client };

/**
 * Konflikty schematu typowe przy wspólnej bazie APK / GymBrat albo gdy
 * `ensureCriticalSchema` dodał kolumny zanim migracja plikowa została zapisana
 * w `__drizzle_migrations`.
 */
export function isIgnorableSchemaConflict(error: unknown): boolean {
  const msg = String(error);
  return /duplicate column|already exists|table .+ already exists/i.test(msg);
}

async function ensureMigrationsTable(client: Client): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash text NOT NULL,
      created_at numeric
    )
  `);
}

async function getLastMigrationCreatedAt(
  client: Client,
): Promise<number | undefined> {
  const result = await client.execute(
    `SELECT id, hash, created_at FROM "${MIGRATIONS_TABLE}" ORDER BY created_at DESC LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) return undefined;
  const createdAt = Number(row.created_at);
  return Number.isFinite(createdAt) ? createdAt : undefined;
}

/**
 * Uruchamia migracje SQL z `db/migrations` na aktualnym `TURSO_DATABASE_URL`.
 * Każde zdanie jest idempotentne względem „duplicate column / already exists”,
 * żeby start nie padał, gdy baza z APK ma już kolumny (np. `arm_cm`).
 */
export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.join(process.cwd(), "db", "migrations");
  const db = getDb() as DbWithClient;
  const client = db.$client;
  const migrations = readMigrationFiles({ migrationsFolder });

  await ensureMigrationsTable(client);
  const lastCreatedAt = await getLastMigrationCreatedAt(client);

  for (const migration of migrations) {
    if (
      lastCreatedAt !== undefined &&
      !(lastCreatedAt < migration.folderMillis)
    ) {
      continue;
    }

    for (const stmt of migration.sql) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      try {
        await client.execute(trimmed);
      } catch (error) {
        if (!isIgnorableSchemaConflict(error)) throw error;
      }
    }

    await client.execute({
      sql: `INSERT INTO "${MIGRATIONS_TABLE}" ("hash", "created_at") VALUES (?, ?)`,
      args: [migration.hash, migration.folderMillis],
    });
  }
}
