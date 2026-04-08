/**
 * Jednorazowa migracja: stary schemat `workout_plans` (PK = user_id)
 * → nowy (PK = id, wiele planów na użytkownika).
 *
 * Uruchomienie: npx tsx scripts/migrate-workout-plans-multi.ts
 * Wymaga TURSO_DATABASE_URL (i opcjonalnie TURSO_AUTH_TOKEN) jak aplikacja.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";

function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

async function main() {
  loadEnvFiles();
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    console.error("Brak TURSO_DATABASE_URL.");
    process.exit(1);
  }
  const token = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, ...(token ? { authToken: token } : {}) });

  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='workout_plans'",
  );
  if (tables.rows.length === 0) {
    console.log(
      "Brak tabeli workout_plans — utwórz schemat (np. npm run db:push).",
    );
    return;
  }

  const idCol = await client.execute(
    "SELECT 1 FROM pragma_table_info('workout_plans') WHERE name = 'id' LIMIT 1",
  );
  if (idCol.rows.length > 0) {
    console.log(
      "Tabela workout_plans ma już kolumnę id — migracja nie jest potrzebna.",
    );
    return;
  }

  const old = await client.execute(
    "SELECT user_id, plan_json, updated_at FROM workout_plans",
  );

  await client.execute("DROP TABLE workout_plans");
  await client.execute(`
    CREATE TABLE workout_plans (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  await client.execute(
    "CREATE INDEX IF NOT EXISTS workout_plans_user_id_idx ON workout_plans(user_id)",
  );

  for (const row of old.rows) {
    const r = row as Record<string, unknown>;
    const userId = String(r.user_id ?? "");
    const planJson = String(r.plan_json ?? "");
    const updatedAt = Number(r.updated_at);
    const ts = Number.isFinite(updatedAt) ? updatedAt : Date.now();
    await client.execute({
      sql: `INSERT INTO workout_plans (id, user_id, plan_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [randomUUID(), userId, planJson, ts, ts],
    });
  }

  console.log(`Migracja zakończona: przeniesiono ${old.rows.length} plan(ów).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
