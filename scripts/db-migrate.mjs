#!/usr/bin/env node
// Z40: `npm run db:migrate:run [-- --dry-run] [-- --strict]`
// Nakłada migracje z db/migrations na TURSO_DATABASE_URL (domyślnie file:./local.db).
import { createClient } from "@libsql/client";
import path from "node:path";
import { applyMigrations, pendingMigrations } from "./db-migrations.mjs";

const args = new Set(process.argv.slice(2));
const url = process.env.TURSO_DATABASE_URL ?? "file:./local.db";
const client = createClient({
  url,
  ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
});
const dir = path.join(process.cwd(), "db", "migrations");
try {
  if (args.has("--check")) {
    const pending = await pendingMigrations(client, dir);
    console.log(pending.length ? `Oczekujące migracje: ${pending.join(", ")}` : "Schemat aktualny.");
    process.exit(pending.length ? 1 : 0);
  }
  const applied = await applyMigrations(client, dir, {
    tolerateExisting: !args.has("--strict"),
    dryRun: args.has("--dry-run"),
  });
  console.log(applied.length ? `Nałożono: ${applied.join(", ")}` : "Brak nowych migracji.");
} finally {
  client.close();
}
