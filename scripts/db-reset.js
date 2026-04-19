/**
 * Usuwa wszystkie dane aplikacji (konta, treningi, statystyki, widoki stron).
 * Ładuje `.env.local` / `.env` tak jak drizzle.config.ts.
 */
const { createClient } = require("@libsql/client");
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

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

loadEnvFiles();

const url = process.env.TURSO_DATABASE_URL ?? "file:./local.db";

const deletes = [
  "DELETE FROM body_report_photos",
  "DELETE FROM body_reports",
  "DELETE FROM workouts",
  "DELETE FROM training_sessions",
  "DELETE FROM weight_logs",
  "DELETE FROM workout_plans",
  "DELETE FROM user_settings",
  "DELETE FROM page_views",
  "DELETE FROM site_activity_log",
  "DELETE FROM users",
];

async function main() {
  const client = createClient({
    url,
    ...(process.env.TURSO_AUTH_TOKEN
      ? { authToken: process.env.TURSO_AUTH_TOKEN }
      : {}),
  });

  try {
    for (const sql of deletes) {
      await client.execute(sql);
    }
    console.log("Baza wyczyszczona:", url.replace(/\/\/.*@/, "//***@"));
  } finally {
    client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
