/**
 * Jednorazowy seed: CATALOG_EXERCISES + exercise_technique_links → exercises.
 * Idempotentny — pomija istniejące id.
 *
 * Usage: npx tsx scripts/seed-exercises-from-catalog.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@libsql/client";
import { CATALOG_EXERCISES } from "../lib/workout-exercise-catalog";

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
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvFiles();
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("Missing TURSO_DATABASE_URL.");
  const token = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({
    url,
    ...(token ? { authToken: token } : {}),
  });

  await client.execute(`
CREATE TABLE IF NOT EXISTS "exercises" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "category_id" text NOT NULL,
  "secondary_category_ids" text,
  "aliases_en" text,
  "aliases_pl" text,
  "equipment" text,
  "difficulty" text,
  "description" text,
  "cues" text,
  "technique_youtube_url" text,
  "technique_youtube_title" text,
  "is_active" integer DEFAULT 1 NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  "created_by_user_id" text,
  "updated_by_user_id" text
);
`);

  const technique = await client.execute(
    `SELECT id, youtube_url, updated_at, updated_by_user_id FROM exercise_technique_links`,
  ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));

  const techniqueById = new Map<
    string,
    { url: string; updatedAt: number | null; updatedBy: string | null }
  >();
  for (const row of technique.rows) {
    const id = String(row.id ?? "");
    const youtubeUrl = String(row.youtube_url ?? "");
    if (!id || !youtubeUrl) continue;
    techniqueById.set(id, {
      url: youtubeUrl,
      updatedAt:
        row.updated_at == null ? null : Number(row.updated_at),
      updatedBy:
        row.updated_by_user_id == null
          ? null
          : String(row.updated_by_user_id),
    });
  }

  let inserted = 0;
  let skipped = 0;
  const now = Date.now();

  for (const ex of CATALOG_EXERCISES) {
    const existing = await client.execute({
      sql: `SELECT id FROM exercises WHERE id = ? LIMIT 1`,
      args: [ex.id],
    });
    if (existing.rows.length > 0) {
      skipped += 1;
      continue;
    }
    const tech = techniqueById.get(ex.id);
    await client.execute({
      sql: `INSERT INTO exercises (
        id, name, category_id, aliases_en, technique_youtube_url,
        is_active, created_at, updated_at, updated_by_user_id
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      args: [
        ex.id,
        ex.name,
        ex.categoryId,
        ex.aliasesEn ? JSON.stringify(ex.aliasesEn) : null,
        tech?.url ?? null,
        now,
        tech?.updatedAt ?? now,
        tech?.updatedBy ?? null,
      ],
    });
    inserted += 1;
  }

  console.log(
    `seed-exercises: inserted=${inserted} skipped=${skipped} catalog=${CATALOG_EXERCISES.length} techniqueLinks=${techniqueById.size}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
