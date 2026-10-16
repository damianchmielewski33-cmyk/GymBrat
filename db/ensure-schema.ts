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
  "expected_behavior" text DEFAULT '' NOT NULL,
  "steps_to_reproduce" text DEFAULT '' NOT NULL,
  "priority" text NOT NULL,
  "status" text DEFAULT 'analysis' NOT NULL,
  "created_at" integer NOT NULL,
  "resolved_at" integer,
  "admin_seen_at" integer,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await tryAddColumn(
    `ALTER TABLE "bug_reports" ADD COLUMN "admin_seen_at" integer`,
  );
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

  /** Jednorazowo: mapowanie starych priorytetów/statusów zgłoszeń błędów. */
  const bugWorkflowFlag = "bug_report_workflow_v1";
  const bugWorkflowRows = await client.execute({
    sql: `SELECT value FROM schema_flags WHERE key = ? LIMIT 1`,
    args: [bugWorkflowFlag],
  });
  if ((bugWorkflowRows.rows?.length ?? 0) === 0) {
    await client.execute(
      `UPDATE bug_reports SET priority = 'critical' WHERE priority = 'highest'`,
    );
    await client.execute(
      `UPDATE bug_reports SET priority = 'normal' WHERE priority = 'medium'`,
    );
    await client.execute(
      `UPDATE bug_reports SET priority = 'low' WHERE priority = 'lowest'`,
    );
    await client.execute(
      `UPDATE bug_reports SET status = 'analysis' WHERE status = 'open'`,
    );
    await client.execute(
      `UPDATE bug_reports SET status = 'retest' WHERE status = 'fixed'`,
    );
    await client.execute({
      sql: `INSERT INTO schema_flags ("key", "value", "updated_at") VALUES (?, ?, ?)`,
      args: [bugWorkflowFlag, "1", Date.now()],
    });
  }

  /** Jednorazowo: historyczne zgłoszenia traktuj jako już widziane (badge od nowych). */
  const bugSeenFlag = "bug_report_admin_seen_v1";
  const bugSeenRows = await client.execute({
    sql: `SELECT value FROM schema_flags WHERE key = ? LIMIT 1`,
    args: [bugSeenFlag],
  });
  if ((bugSeenRows.rows?.length ?? 0) === 0) {
    await client.execute({
      sql: `UPDATE bug_reports SET admin_seen_at = COALESCE(created_at, ?) WHERE admin_seen_at IS NULL`,
      args: [Date.now()],
    });
    await client.execute({
      sql: `INSERT INTO schema_flags ("key", "value", "updated_at") VALUES (?, ?, ?)`,
      args: [bugSeenFlag, "1", Date.now()],
    });
  }

  await tryAddColumn(
    `ALTER TABLE "users" ADD COLUMN "package_ends_at" integer`,
  );
  await tryAddColumn(`ALTER TABLE "users" ADD COLUMN "package_plan_sku" text`);
  await tryAddColumn(`ALTER TABLE "users" ADD COLUMN "admin_note" text`);

  await client.execute(`
CREATE TABLE IF NOT EXISTS "subscription_plans" (
  "id" text PRIMARY KEY NOT NULL,
  "sku" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "days" integer NOT NULL,
  "price_grosze" integer NOT NULL,
  "active" integer DEFAULT 1 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "updated_at" integer NOT NULL
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "subscription_plans_active_sort" ON "subscription_plans" ("active", "sort_order")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "subscription_orders" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "plan_id" text,
  "plan_sku" text NOT NULL,
  "days" integer NOT NULL,
  "amount_grosze" integer NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "hotpay_payment_id" text,
  "source" text DEFAULT 'hotpay' NOT NULL,
  "created_at" integer NOT NULL,
  "paid_at" integer,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON UPDATE NO ACTION ON DELETE SET NULL
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "subscription_orders_user_created" ON "subscription_orders" ("user_id", "created_at")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "subscription_orders_status" ON "subscription_orders" ("status")`,
  );

  /** Seed domyślnych pakietów (ceny edytowalne w adminie). */
  const planSeedFlag = "subscription_plans_seed_v1";
  const planSeedRows = await client.execute({
    sql: `SELECT value FROM schema_flags WHERE key = ? LIMIT 1`,
    args: [planSeedFlag],
  });
  if ((planSeedRows.rows?.length ?? 0) === 0) {
    const now = Date.now();
    const seeds: Array<[string, string, string, string, number, number, number]> =
      [
        [
          crypto.randomUUID(),
          "d7",
          "7 dni",
          "Krótki dostęp bez reklam — idealny na tydzień startu.",
          7,
          399,
          10,
        ],
        [
          crypto.randomUUID(),
          "d30",
          "30 dni",
          "Miesiąc pełnego GymBrat bez reklam AdMob.",
          30,
          899,
          20,
        ],
        [
          crypto.randomUUID(),
          "d90",
          "90 dni",
          "Trzy miesiące spokojnego treningu i diety bez przerw reklamowych.",
          90,
          2499,
          30,
        ],
        [
          crypto.randomUUID(),
          "d365",
          "Rok",
          "Cały rok bez reklam — najlepszy stosunek ceny do czasu.",
          365,
          7999,
          40,
        ],
      ];
    for (const [id, sku, title, description, days, price, sort] of seeds) {
      await client.execute({
        sql: `INSERT OR IGNORE INTO subscription_plans ("id","sku","title","description","days","price_grosze","active","sort_order","updated_at") VALUES (?,?,?,?,?,?,1,?,?)`,
        args: [id, sku, title, description, days, price, sort, now],
      });
    }
    await client.execute({
      sql: `INSERT INTO schema_flags ("key", "value", "updated_at") VALUES (?, ?, ?)`,
      args: [planSeedFlag, "1", now],
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
