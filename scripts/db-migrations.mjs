// Z40: runner migracji SQL (bez drizzle-kit) z własną tabelą wersji `schema_migrations`.
// Używany przez `npm run db:migrate:run` oraz test zgodności schema.ts ↔ migracje.
import { readFileSync } from "node:fs";
import path from "node:path";

const BREAKPOINT = "--> statement-breakpoint";
const ALREADY_APPLIED = /already exists|duplicate column/i;

export function loadMigrations(dir) {
  const journal = JSON.parse(
    readFileSync(path.join(dir, "meta", "_journal.json"), "utf8"),
  );
  return journal.entries
    .slice()
    .sort((a, b) => a.idx - b.idx)
    .map((e) => ({
      tag: e.tag,
      statements: readFileSync(path.join(dir, `${e.tag}.sql`), "utf8")
        .split(BREAKPOINT)
        .map((s) => s.trim())
        .filter(Boolean),
    }));
}

export async function ensureVersionTable(client) {
  await client.execute(
    "CREATE TABLE IF NOT EXISTS schema_migrations (tag TEXT PRIMARY KEY NOT NULL, applied_at INTEGER NOT NULL)",
  );
}

export async function appliedTags(client) {
  await ensureVersionTable(client);
  const rs = await client.execute("SELECT tag FROM schema_migrations");
  return new Set(rs.rows.map((r) => String(r.tag)));
}

/**
 * Stosuje brakujące migracje po kolei. `tolerateExisting` (domyślnie true) pomija instrukcje,
 * które padają na „already exists / duplicate column” — baza zbudowana wcześniej przez
 * ensure-schema zostaje „zbaselinowana” bez błędu.
 */
export async function applyMigrations(client, dir, opts = {}) {
  const tolerateExisting = opts.tolerateExisting ?? true;
  const dryRun = opts.dryRun ?? false;
  const done = await appliedTags(client);
  const applied = [];
  for (const m of loadMigrations(dir)) {
    if (done.has(m.tag)) continue;
    if (!dryRun) {
      for (const sql of m.statements) {
        try {
          await client.execute(sql);
        } catch (e) {
          if (!(tolerateExisting && ALREADY_APPLIED.test(String(e)))) {
            throw new Error(`Migracja ${m.tag} nie powiodła się: ${e}`);
          }
        }
      }
      await client.execute({
        sql: "INSERT INTO schema_migrations (tag, applied_at) VALUES (?, ?)",
        args: [m.tag, Date.now()],
      });
    }
    applied.push(m.tag);
  }
  return applied;
}

/** Brakujące (nienałożone) migracje — do kontroli wersji na starcie. */
export async function pendingMigrations(client, dir) {
  const done = await appliedTags(client);
  return loadMigrations(dir)
    .map((m) => m.tag)
    .filter((t) => !done.has(t));
}
