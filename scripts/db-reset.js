/**
 * Usuwa wszystkie dane aplikacji (konta, treningi, posiłki, statystyki, logi).
 * Ładuje `.env.local` / `.env` tak jak drizzle.config.ts.
 *
 * Użycie:
 *   npm run db:reset
 *   # albo z env już ustawionym:
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run db:reset
 */
async function loadEnvFiles() {
  const { existsSync, readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
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

/** Kolejność: tabele zależne od users / body_reports najpierw, users na końcu. */
const deletes = [
  "DELETE FROM body_report_photos",
  "DELETE FROM body_reports",
  "DELETE FROM meal_logs",
  "DELETE FROM daily_checkins",
  "DELETE FROM workouts",
  "DELETE FROM training_sessions",
  "DELETE FROM weight_logs",
  "DELETE FROM workout_plans",
  "DELETE FROM user_settings",
  "DELETE FROM page_views",
  "DELETE FROM site_activity_log",
  "DELETE FROM admin_audit_log",
  "DELETE FROM email_verification_codes",
  "DELETE FROM app_settings",
  "DELETE FROM users",
];

const countTables = [
  "users",
  "user_settings",
  "workouts",
  "workout_plans",
  "training_sessions",
  "weight_logs",
  "body_reports",
  "body_report_photos",
  "meal_logs",
  "daily_checkins",
  "page_views",
  "site_activity_log",
  "admin_audit_log",
  "email_verification_codes",
  "app_settings",
];

async function countRows(client, table) {
  try {
    const rs = await client.execute(`SELECT COUNT(*) AS c FROM ${table}`);
    return Number(rs.rows[0]?.c ?? 0);
  } catch {
    return null;
  }
}

async function main() {
  await loadEnvFiles();

  const url = process.env.TURSO_DATABASE_URL ?? "file:./local.db";
  const masked = url.replace(/\/\/.*@/, "//***@");

  if (!process.env.TURSO_DATABASE_URL) {
    console.warn(
      "Uwaga: brak TURSO_DATABASE_URL — używam lokalnego file:./local.db",
    );
  }
  if (url.startsWith("libsql://") && !process.env.TURSO_AUTH_TOKEN) {
    console.error("Brak TURSO_AUTH_TOKEN dla zdalnej bazy Turso.");
    process.exit(1);
  }

  const { createClient } = await import("@libsql/client");
  const client = createClient({
    url,
    ...(process.env.TURSO_AUTH_TOKEN
      ? { authToken: process.env.TURSO_AUTH_TOKEN }
      : {}),
  });

  try {
    const before = {};
    for (const t of countTables) {
      before[t] = await countRows(client, t);
    }
    console.log("Przed czyszczeniem:", before);

    for (const sql of deletes) {
      try {
        await client.execute(sql);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Tabela może nie istnieć na starszej bazie — pomiń.
        if (/no such table/i.test(msg)) {
          console.warn("Pominięto (brak tabeli):", sql);
          continue;
        }
        throw err;
      }
    }

    const after = {};
    for (const t of countTables) {
      after[t] = await countRows(client, t);
    }
    console.log("Po czyszczeniu:", after);
    console.log("Baza wyczyszczona:", masked);
  } finally {
    client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
