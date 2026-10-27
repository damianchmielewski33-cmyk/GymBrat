import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@libsql/client";
import { computeSessionTonnageKg } from "../lib/analytics/tonnage";

function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator < 0) continue;
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvFiles();
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("Missing TURSO_DATABASE_URL.");
  const token = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, ...(token ? { authToken: token } : {}) });
  let updated = 0;
  let cursor = "";
  while (true) {
    const rows = await client.execute({
      sql: "SELECT id, exercises FROM workouts WHERE tonnage_kg IS NULL AND id > ? ORDER BY id LIMIT 200",
      args: [cursor],
    });
    if (!rows.rows.length) break;
    const batch = rows.rows.map((row) => ({
      sql: "UPDATE workouts SET tonnage_kg = ? WHERE id = ? AND tonnage_kg IS NULL",
      args: [computeSessionTonnageKg(String(row.exercises ?? "")), String(row.id)],
    }));
    await client.batch(batch, "write");
    updated += batch.length;
    cursor = String(rows.rows[rows.rows.length - 1]!.id);
    console.log(`Backfilled ${updated} workout rows`);
  }
  console.log(`Finished. Updated ${updated} workout rows.`);
  client.close();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Backfill failed");
  process.exitCode = 1;
});
