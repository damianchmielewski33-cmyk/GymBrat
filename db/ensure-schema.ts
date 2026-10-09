import type { Client } from "@libsql/client";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { getDb } from "./index";
import * as schema from "./schema";
import { withDbRetry } from "./with-retry";

type DbWithClient = LibSQLDatabase<typeof schema> & { $client: Client };

let schemaEnsurePromise: Promise<void> | null = null;
let schemaEnsured = false;

/**
 * Uzupełnia braki w schemacie bez polegania na plikach `db/migrations` w paczce serwera (Vercel).
 * Idempotentne — raz na proces (kolejne nawigacje nie czekają na dziesiątki DDL).
 */
export async function ensureCriticalSchema(): Promise<void> {
  if (schemaEnsured) return;
  if (!schemaEnsurePromise) {
    schemaEnsurePromise = withDbRetry(() => ensureCriticalSchemaOnce(), {
      attempts: 3,
      label: "ensureCriticalSchema",
    })
      .then(() => {
        schemaEnsured = true;
      })
      .catch((err) => {
        schemaEnsurePromise = null;
        throw err;
      });
  }
  await schemaEnsurePromise;
}

async function ensureCriticalSchemaOnce(): Promise<void> {
  const db = getDb() as DbWithClient;
  const client = db.$client;
  const tryAddColumn = async (sql: string) => {
    try {
      await client.execute(sql);
    } catch (e) {
      const msg = String(e);
      if (!/duplicate column|already exists/i.test(msg)) throw e;
    }
  };
  await tryAddColumn(
    `ALTER TABLE "page_views" ADD COLUMN "deployment_env" text`,
  );
  await tryAddColumn(
    `ALTER TABLE "site_activity_log" ADD COLUMN "deployment_env" text`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "meal_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "date" text NOT NULL,
  "name" text,
  "slot" text,
  "barcode" text,
  "calories" real NOT NULL,
  "protein_g" real NOT NULL,
  "fat_g" real NOT NULL,
  "carbs_g" real NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await tryAddColumn(`ALTER TABLE "meal_logs" ADD COLUMN "slot" text`);
  await tryAddColumn(`ALTER TABLE "meal_logs" ADD COLUMN "barcode" text`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "idx_meal_logs_user_date" ON "meal_logs" ("user_id","date")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "oauth_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "provider" text NOT NULL,
  "provider_account_id" text NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "oauth_accounts_provider_account" ON "oauth_accounts" ("provider","provider_account_id")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "oauth_accounts_user" ON "oauth_accounts" ("user_id")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "email_verification_codes" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "purpose" text DEFAULT 'register' NOT NULL,
  "code_hash" text NOT NULL,
  "expires_at" integer NOT NULL,
  "created_at" integer NOT NULL,
  "consumed_at" integer,
  "send_count" integer DEFAULT 1 NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "last_sent_at" integer NOT NULL
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "idx_email_verification_codes_email_purpose" ON "email_verification_codes" ("email","purpose")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "idx_email_verification_codes_expires" ON "email_verification_codes" ("expires_at")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "daily_checkins" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "date" text NOT NULL,
  "sleep_quality" integer,
  "day_energy" integer,
  "stress" integer,
  "weight_kg" real,
  "notes" text,
  "day_closed_at" integer,
  "summary_json" text,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "idx_daily_checkins_user_date" ON "daily_checkins" ("user_id","date")`,
  );

  await tryAddColumn(`ALTER TABLE "user_settings" ADD COLUMN "reminders_json" text`);
  await tryAddColumn(`ALTER TABLE "user_settings" ADD COLUMN "meal_templates_json" text`);
  await tryAddColumn(`ALTER TABLE "user_settings" ADD COLUMN "fitness_goals_json" text`);
  await tryAddColumn(
    `ALTER TABLE "user_settings" ADD COLUMN "onboarding_completed_at" integer`,
  );
  await tryAddColumn(
    `ALTER TABLE "user_settings" ADD COLUMN "ai_features_disabled" integer NOT NULL DEFAULT 0`,
  );
  await tryAddColumn(
    `ALTER TABLE "user_settings" ADD COLUMN "ai_entitled" integer NOT NULL DEFAULT 1`,
  );

  await tryAddColumn(
    `ALTER TABLE "user_settings" ADD COLUMN "report_cadence_days" integer NOT NULL DEFAULT 14`,
  );
  await tryAddColumn(
    `ALTER TABLE "user_settings" ADD COLUMN "progress_delta_unit" text NOT NULL DEFAULT 'percent'`,
  );
  await tryAddColumn(
    `ALTER TABLE "user_settings" ADD COLUMN "start_photo_data_url" text`,
  );

  await tryAddColumn(`ALTER TABLE "body_reports" ADD COLUMN "arm_cm" real`);
  await tryAddColumn(`ALTER TABLE "body_reports" ADD COLUMN "abdomen_cm" real`);

  await client.execute(`
CREATE TABLE IF NOT EXISTS "app_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "ai_globally_disabled" integer NOT NULL DEFAULT 0,
  "updated_at" integer NOT NULL
);
`);

  await client.execute(`
CREATE TABLE IF NOT EXISTS "admin_audit_log" (
  "id" text PRIMARY KEY NOT NULL,
  "actor_user_id" text NOT NULL,
  "action" text NOT NULL,
  "target_user_id" text,
  "meta_json" text,
  "deployment_env" text,
  "created_at" integer NOT NULL
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "idx_admin_audit_created" ON "admin_audit_log" ("created_at")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "active_workout_sessions" (
  "user_id" text PRIMARY KEY NOT NULL,
  "payload_json" text NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "device_id" text NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);

  await client.execute(`
CREATE TABLE IF NOT EXISTS "meal_catalog" (
  "id" text PRIMARY KEY NOT NULL,
  "payload_json" text NOT NULL,
  "updated_at" integer NOT NULL,
  "updated_by_user_id" text
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "idx_meal_catalog_updated" ON "meal_catalog" ("updated_at")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "meal_catalog_images" (
  "meal_id" text PRIMARY KEY NOT NULL,
  "mime_type" text NOT NULL,
  "data_url" text NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("meal_id") REFERENCES "meal_catalog"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);

  await client.execute(`
CREATE TABLE IF NOT EXISTS "exercise_technique_links" (
  "id" text PRIMARY KEY NOT NULL,
  "youtube_url" text NOT NULL,
  "updated_at" integer NOT NULL,
  "updated_by_user_id" text
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "idx_exercise_technique_updated" ON "exercise_technique_links" ("updated_at")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "app_branding_assets" (
  "slot" text PRIMARY KEY NOT NULL,
  "mime_type" text NOT NULL,
  "data_url" text NOT NULL,
  "updated_at" integer NOT NULL
);
`);

  await client.execute(`
CREATE TABLE IF NOT EXISTS "bug_reports" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "description" text NOT NULL,
  "expected_behavior" text NOT NULL,
  "steps_to_reproduce" text NOT NULL,
  "priority" text NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "created_at" integer NOT NULL,
  "resolved_at" integer,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "bug_reports_status_created" ON "bug_reports" ("status", "created_at")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "bug_reports_user" ON "bug_reports" ("user_id")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "bug_report_photos" (
  "id" text PRIMARY KEY NOT NULL,
  "bug_report_id" text NOT NULL,
  "data_url" text NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("bug_report_id") REFERENCES "bug_reports"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "bug_report_photos_bug" ON "bug_report_photos" ("bug_report_id")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "schema_flags" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL,
  "updated_at" integer NOT NULL
);
`);

  /** Jednorazowo: usuń wbudowany pakiet ~100 startowych przepisów z bazy. */
  const purgeFlag = "purge_starter_meal_catalog_v1";
  const flagRows = await client.execute({
    sql: `SELECT value FROM schema_flags WHERE key = ? LIMIT 1`,
    args: [purgeFlag],
  });
  if ((flagRows.rows?.length ?? 0) === 0) {
    await client.execute(`DELETE FROM meal_catalog`);
    await client.execute({
      sql: `INSERT INTO schema_flags ("key", "value", "updated_at") VALUES (?, ?, ?)`,
      args: [purgeFlag, "1", Date.now()],
    });
  }
}

let mealLogsEnsured = false;

/** Jednorazowo na proces — przed SELECT na meal_logs (np. gdy migracje plikowe nie dołączyły się do deployu). */
export async function ensureMealLogsTableOncePerProcess(): Promise<void> {
  if (mealLogsEnsured) return;
  await ensureCriticalSchema();
  mealLogsEnsured = true;
}
