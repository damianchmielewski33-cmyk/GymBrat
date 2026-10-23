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
    `ALTER TABLE "user_settings" ADD COLUMN "intro_tour_completed_at" integer`,
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
  await tryAddColumn(`ALTER TABLE "users" ADD COLUMN "sex" text`);

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

  await client.execute(`
CREATE TABLE IF NOT EXISTS "teams" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_user_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "privacy" text DEFAULT 'private' NOT NULL,
  "invite_code" text NOT NULL,
  "avatar_emoji" text DEFAULT '🏋️' NOT NULL,
  "banner_color" text DEFAULT '#1a1a1c' NOT NULL,
  "ranking_metric" text DEFAULT 'fcs' NOT NULL,
  "max_members" integer DEFAULT 50 NOT NULL,
  "member_count" integer DEFAULT 1 NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  "archived_at" integer,
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "teams_invite_code_uidx" ON "teams" ("invite_code")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "teams_owner_created_idx" ON "teams" ("owner_user_id","created_at")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "teams_privacy_name_idx" ON "teams" ("privacy","name")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "teams_archived_idx" ON "teams" ("archived_at")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "team_members" (
  "id" text PRIMARY KEY NOT NULL,
  "team_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" text DEFAULT 'member' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "muted_notifications" integer DEFAULT 0 NOT NULL,
  "joined_at" integer NOT NULL,
  "left_at" integer,
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "team_members_team_user_uidx" ON "team_members" ("team_id","user_id")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "team_members_user_status_idx" ON "team_members" ("user_id","status")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "team_members_team_status_idx" ON "team_members" ("team_id","status")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "team_invitations" (
  "id" text PRIMARY KEY NOT NULL,
  "team_id" text NOT NULL,
  "invited_by_user_id" text NOT NULL,
  "invitee_user_id" text,
  "invitee_email" text,
  "role" text DEFAULT 'member' NOT NULL,
  "token" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" integer NOT NULL,
  "expires_at" integer NOT NULL,
  "responded_at" integer,
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("invitee_user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "team_invitations_token_uidx" ON "team_invitations" ("token")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "team_invitations_team_status_idx" ON "team_invitations" ("team_id","status")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "team_invitations_invitee_user_idx" ON "team_invitations" ("invitee_user_id","status")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "team_invitations_invitee_email_idx" ON "team_invitations" ("invitee_email","status")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "team_posts" (
  "id" text PRIMARY KEY NOT NULL,
  "team_id" text NOT NULL,
  "author_user_id" text NOT NULL,
  "type" text NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "snapshot_json" text DEFAULT '{}' NOT NULL,
  "source_key" text,
  "reaction_count" integer DEFAULT 0 NOT NULL,
  "comment_count" integer DEFAULT 0 NOT NULL,
  "moderation_status" text DEFAULT 'visible' NOT NULL,
  "created_at" integer NOT NULL,
  "edited_at" integer,
  "deleted_at" integer,
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "team_posts_team_created_idx" ON "team_posts" ("team_id","created_at")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "team_posts_author_created_idx" ON "team_posts" ("author_user_id","created_at")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "team_posts_team_mod_created_idx" ON "team_posts" ("team_id","moderation_status","created_at")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "team_posts_team_visible_created_idx" ON "team_posts" ("team_id","created_at") WHERE "deleted_at" IS NULL AND "moderation_status" = 'visible'`,
  );
  await db.$client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "team_posts_team_source_uidx" ON "team_posts" ("team_id","source_key")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "team_post_media" (
  "id" text PRIMARY KEY NOT NULL,
  "post_id" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "mime_type" text NOT NULL,
  "data_url" text NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("post_id") REFERENCES "team_posts"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "team_post_media_post_idx" ON "team_post_media" ("post_id","sort_order")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "team_post_comments" (
  "id" text PRIMARY KEY NOT NULL,
  "post_id" text NOT NULL,
  "author_user_id" text NOT NULL,
  "parent_comment_id" text,
  "body" text NOT NULL,
  "created_at" integer NOT NULL,
  "deleted_at" integer,
  FOREIGN KEY ("post_id") REFERENCES "team_posts"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "team_post_comments_post_created_idx" ON "team_post_comments" ("post_id","created_at")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "team_post_comments_parent_idx" ON "team_post_comments" ("parent_comment_id")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "team_post_comments_post_deleted_created_idx" ON "team_post_comments" ("post_id","deleted_at","created_at")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "team_post_comments_post_live_created_idx" ON "team_post_comments" ("post_id","created_at") WHERE "deleted_at" IS NULL`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "team_post_reactions" (
  "id" text PRIMARY KEY NOT NULL,
  "post_id" text NOT NULL,
  "user_id" text NOT NULL,
  "kind" text NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("post_id") REFERENCES "team_posts"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "team_post_reactions_post_user_uidx" ON "team_post_reactions" ("post_id","user_id")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "team_post_reactions_post_kind_idx" ON "team_post_reactions" ("post_id","kind")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "team_post_mentions" (
  "id" text PRIMARY KEY NOT NULL,
  "post_id" text NOT NULL,
  "comment_id" text,
  "mentioned_user_id" text NOT NULL,
  "created_by_user_id" text NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("post_id") REFERENCES "team_posts"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("comment_id") REFERENCES "team_post_comments"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("mentioned_user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "team_post_mentions_post_idx" ON "team_post_mentions" ("post_id")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "team_post_mentions_user_idx" ON "team_post_mentions" ("mentioned_user_id")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "team_feed_events" (
  "id" text PRIMARY KEY NOT NULL,
  "team_id" text NOT NULL,
  "kind" text NOT NULL,
  "entity_id" text NOT NULL,
  "actor_user_id" text,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "team_feed_events_team_created_idx" ON "team_feed_events" ("team_id","created_at")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "community_milestones" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "kind" text NOT NULL,
  "milestone_key" text NOT NULL,
  "unlocked_at" integer NOT NULL,
  "meta_json" text DEFAULT '{}' NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "community_milestones_user_kind_key_uidx" ON "community_milestones" ("user_id","kind","milestone_key")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "group_workout_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "team_id" text NOT NULL,
  "host_user_id" text NOT NULL,
  "title" text DEFAULT 'Trening grupowy' NOT NULL,
  "status" text DEFAULT 'live' NOT NULL,
  "created_at" integer NOT NULL,
  "ended_at" integer,
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "group_workout_sessions_team_status_idx" ON "group_workout_sessions" ("team_id","status")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "group_workout_sessions_host_idx" ON "group_workout_sessions" ("host_user_id","status")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "group_workout_participants" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "user_id" text NOT NULL,
  "status" text DEFAULT 'joined' NOT NULL,
  "presence_json" text DEFAULT '{}' NOT NULL,
  "joined_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  "left_at" integer,
  FOREIGN KEY ("session_id") REFERENCES "group_workout_sessions"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "group_workout_participants_session_user_uidx" ON "group_workout_participants" ("session_id","user_id")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "group_workout_participants_session_status_idx" ON "group_workout_participants" ("session_id","status")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "chat_channels" (
  "id" text PRIMARY KEY NOT NULL,
  "scope_key" text NOT NULL,
  "kind" text NOT NULL,
  "team_id" text,
  "group_session_id" text,
  "challenge_id" text,
  "title" text DEFAULT '' NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("group_session_id") REFERENCES "group_workout_sessions"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "chat_channels_scope_uidx" ON "chat_channels" ("scope_key")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "chat_channels_kind_team_idx" ON "chat_channels" ("kind","team_id")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "chat_channels_group_session_idx" ON "chat_channels" ("group_session_id")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "chat_channels_challenge_idx" ON "chat_channels" ("challenge_id")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "channel_id" text NOT NULL,
  "author_user_id" text NOT NULL,
  "body" text NOT NULL,
  "parent_message_id" text,
  "created_at" integer NOT NULL,
  "edited_at" integer,
  "deleted_at" integer,
  FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "chat_messages_channel_created_idx" ON "chat_messages" ("channel_id","created_at")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "chat_messages_channel_deleted_created_idx" ON "chat_messages" ("channel_id","deleted_at","created_at")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "chat_messages_channel_live_created_idx" ON "chat_messages" ("channel_id","created_at") WHERE "deleted_at" IS NULL`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "chat_messages_parent_idx" ON "chat_messages" ("parent_message_id")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "chat_messages_author_idx" ON "chat_messages" ("author_user_id")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "chat_message_reactions" (
  "id" text PRIMARY KEY NOT NULL,
  "message_id" text NOT NULL,
  "user_id" text NOT NULL,
  "emoji" text NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "chat_message_reactions_uidx" ON "chat_message_reactions" ("message_id","user_id","emoji")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "chat_message_reactions_message_idx" ON "chat_message_reactions" ("message_id")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "chat_mentions" (
  "id" text PRIMARY KEY NOT NULL,
  "message_id" text NOT NULL,
  "mentioned_user_id" text NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("mentioned_user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "chat_mentions_message_idx" ON "chat_mentions" ("message_id")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "chat_mentions_user_idx" ON "chat_mentions" ("mentioned_user_id")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "chat_read_states" (
  "user_id" text NOT NULL,
  "channel_id" text NOT NULL,
  "last_read_message_id" text,
  "last_read_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "chat_read_states_uidx" ON "chat_read_states" ("user_id","channel_id")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "chat_read_states_channel_idx" ON "chat_read_states" ("channel_id")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "chat_typing" (
  "channel_id" text NOT NULL,
  "user_id" text NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "chat_typing_uidx" ON "chat_typing" ("channel_id","user_id")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "chat_typing_updated_idx" ON "chat_typing" ("channel_id","updated_at")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "chat_events" (
  "id" text PRIMARY KEY NOT NULL,
  "channel_id" text NOT NULL,
  "kind" text NOT NULL,
  "entity_id" text NOT NULL,
  "actor_user_id" text,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "chat_events_channel_created_idx" ON "chat_events" ("channel_id","created_at")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "challenges" (
  "id" text PRIMARY KEY NOT NULL,
  "scope" text NOT NULL,
  "team_id" text,
  "created_by_user_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "emoji" text DEFAULT '🏆' NOT NULL,
  "metric_kind" text NOT NULL,
  "metric_filter_json" text DEFAULT '{}' NOT NULL,
  "target_value" integer NOT NULL,
  "unit_label" text DEFAULT '' NOT NULL,
  "starts_at" integer NOT NULL,
  "ends_at" integer,
  "reward_xp" integer DEFAULT 100 NOT NULL,
  "reward_badge_key" text,
  "reward_title" text,
  "status" text DEFAULT 'active' NOT NULL,
  "template_key" text,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "challenges_team_status_idx" ON "challenges" ("team_id","status")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "challenges_scope_status_idx" ON "challenges" ("scope","status")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "challenges_ends_at_idx" ON "challenges" ("ends_at")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "challenges_template_idx" ON "challenges" ("template_key")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "challenge_participants" (
  "id" text PRIMARY KEY NOT NULL,
  "challenge_id" text NOT NULL,
  "user_id" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "joined_at" integer NOT NULL,
  "completed_at" integer,
  FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "challenge_participants_uidx" ON "challenge_participants" ("challenge_id","user_id")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "challenge_participants_user_idx" ON "challenge_participants" ("user_id","status")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "challenge_progress" (
  "challenge_id" text NOT NULL,
  "user_id" text NOT NULL,
  "current_value" integer DEFAULT 0 NOT NULL,
  "last_workout_id" text,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "challenge_progress_uidx" ON "challenge_progress" ("challenge_id","user_id")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "challenge_progress_challenge_idx" ON "challenge_progress" ("challenge_id")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "challenge_reward_claims" (
  "id" text PRIMARY KEY NOT NULL,
  "challenge_id" text NOT NULL,
  "user_id" text NOT NULL,
  "xp_awarded" integer DEFAULT 0 NOT NULL,
  "badge_key" text,
  "claimed_at" integer NOT NULL,
  "celebration_seen_at" integer,
  FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "challenge_reward_claims_uidx" ON "challenge_reward_claims" ("challenge_id","user_id")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "challenge_reward_claims_user_idx" ON "challenge_reward_claims" ("user_id")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "user_community_xp" (
  "user_id" text PRIMARY KEY NOT NULL,
  "xp_total" integer DEFAULT 0 NOT NULL,
  "level" integer DEFAULT 1 NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);

  await client.execute(`
CREATE TABLE IF NOT EXISTS "user_badges" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "badge_key" text NOT NULL,
  "title" text NOT NULL,
  "emoji" text DEFAULT '🏅' NOT NULL,
  "challenge_id" text,
  "unlocked_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON UPDATE NO ACTION ON DELETE SET NULL
);
`);
  await db.$client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "user_badges_user_key_uidx" ON "user_badges" ("user_id","badge_key")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "user_badges_user_idx" ON "user_badges" ("user_id")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "href" text DEFAULT '' NOT NULL,
  "actor_user_id" text,
  "team_id" text,
  "entity_type" text,
  "entity_id" text,
  "group_key" text,
  "payload_json" text DEFAULT '{}' NOT NULL,
  "collapsed_count" integer DEFAULT 1 NOT NULL,
  "created_at" integer NOT NULL,
  "read_at" integer,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "notifications_user_created_idx" ON "notifications" ("user_id","created_at")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "notifications_user_read_created_idx" ON "notifications" ("user_id","read_at","created_at")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "notifications_user_kind_created_idx" ON "notifications" ("user_id","kind","created_at")`,
  );
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "notifications_user_group_idx" ON "notifications" ("user_id","group_key")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "notification_events" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "kind" text NOT NULL,
  "notification_id" text NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await db.$client.execute(
    `CREATE INDEX IF NOT EXISTS "notification_events_user_created_idx" ON "notification_events" ("user_id","created_at")`,
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

  await client.execute(`
CREATE TABLE IF NOT EXISTS "friendships" (
  "id" text PRIMARY KEY NOT NULL,
  "user_a_id" text NOT NULL,
  "user_b_id" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "requested_by" text NOT NULL,
  "share_workout_a" integer DEFAULT 0 NOT NULL,
  "share_workout_b" integer DEFAULT 0 NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  "responded_at" integer,
  FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "friendships_pair_uidx" ON "friendships" ("user_a_id","user_b_id")`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "friendships_user_a_status_idx" ON "friendships" ("user_a_id","status")`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "friendships_user_b_status_idx" ON "friendships" ("user_b_id","status")`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "friendships_requested_by_idx" ON "friendships" ("requested_by","status")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "friend_live_presence" (
  "user_id" text PRIMARY KEY NOT NULL,
  "presence_json" text DEFAULT '{}' NOT NULL,
  "active" integer DEFAULT 0 NOT NULL,
  "started_at" integer,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "friend_live_presence_active_updated_idx" ON "friend_live_presence" ("active","updated_at")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "team_fcs_scores" (
  "id" text PRIMARY KEY NOT NULL,
  "team_id" text NOT NULL,
  "user_id" text NOT NULL,
  "week_start" text NOT NULL,
  "fcs" real DEFAULT 0 NOT NULL,
  "components_json" text DEFAULT '{}' NOT NULL,
  "computed_at" integer NOT NULL,
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "team_fcs_scores_team_user_week_uidx" ON "team_fcs_scores" ("team_id","user_id","week_start")`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "team_fcs_scores_team_week_fcs_idx" ON "team_fcs_scores" ("team_id","week_start","fcs")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "user_reputation" (
  "user_id" text PRIMARY KEY NOT NULL,
  "points" integer DEFAULT 0 NOT NULL,
  "tier" text DEFAULT 'bronze' NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await client.execute(`
CREATE TABLE IF NOT EXISTS "user_reputation_events" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "kind" text NOT NULL,
  "points" integer NOT NULL,
  "source_key" text NOT NULL,
  "team_id" text,
  "meta_json" text DEFAULT '{}' NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE SET NULL
);
`);
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "user_reputation_events_source_uidx" ON "user_reputation_events" ("source_key")`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "user_reputation_events_user_created_idx" ON "user_reputation_events" ("user_id","created_at")`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "user_reputation_events_user_kind_created_idx" ON "user_reputation_events" ("user_id","kind","created_at")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "hof_seasons" (
  "key" text PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "starts_at" integer NOT NULL,
  "ends_at" integer NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "archived_at" integer
);
`);
  await client.execute(`
CREATE TABLE IF NOT EXISTS "hof_awards" (
  "id" text PRIMARY KEY NOT NULL,
  "season_key" text NOT NULL,
  "category" text NOT NULL,
  "rank" integer NOT NULL,
  "user_id" text NOT NULL,
  "score" real DEFAULT 0 NOT NULL,
  "score_label" text DEFAULT '' NOT NULL,
  "meta_json" text DEFAULT '{}' NOT NULL,
  "awarded_at" integer NOT NULL,
  FOREIGN KEY ("season_key") REFERENCES "hof_seasons"("key") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "hof_awards_season_cat_rank_uidx" ON "hof_awards" ("season_key","category","rank")`,
  );
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "hof_awards_season_cat_user_uidx" ON "hof_awards" ("season_key","category","user_id")`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "hof_awards_user_idx" ON "hof_awards" ("user_id")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "team_quests" (
  "id" text PRIMARY KEY NOT NULL,
  "team_id" text NOT NULL,
  "template_key" text NOT NULL,
  "title" text NOT NULL,
  "emoji" text DEFAULT '🎯' NOT NULL,
  "metric_kind" text NOT NULL,
  "metric_filter_json" text DEFAULT '{}' NOT NULL,
  "target_value" real NOT NULL,
  "unit_label" text NOT NULL,
  "starts_at" integer NOT NULL,
  "ends_at" integer NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "completed_at" integer,
  "reward_xp_each" integer DEFAULT 100 NOT NULL,
  "reward_badge_key" text NOT NULL,
  "reward_title" text NOT NULL,
  "created_by" text,
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE SET NULL
);
`);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "team_quests_team_status_idx" ON "team_quests" ("team_id","status")`,
  );
  await client.execute(`
CREATE TABLE IF NOT EXISTS "team_quest_contributions" (
  "id" text PRIMARY KEY NOT NULL,
  "quest_id" text NOT NULL,
  "user_id" text NOT NULL,
  "amount" real DEFAULT 0 NOT NULL,
  "last_workout_id" text,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("quest_id") REFERENCES "team_quests"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "team_quest_contrib_quest_user_uidx" ON "team_quest_contributions" ("quest_id","user_id")`,
  );
  await client.execute(`
CREATE TABLE IF NOT EXISTS "team_quest_completions" (
  "id" text PRIMARY KEY NOT NULL,
  "quest_id" text NOT NULL,
  "team_id" text NOT NULL,
  "completed_at" integer NOT NULL,
  "total_value" real DEFAULT 0 NOT NULL,
  "participants_count" integer DEFAULT 0 NOT NULL,
  "meta_json" text DEFAULT '{}' NOT NULL,
  FOREIGN KEY ("quest_id") REFERENCES "team_quests"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "team_quest_completions_quest_uidx" ON "team_quest_completions" ("quest_id")`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "team_quest_completions_team_idx" ON "team_quest_completions" ("team_id","completed_at")`,
  );

  await client.execute(`
CREATE TABLE IF NOT EXISTS "war_seasons" (
  "key" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "starts_at" integer NOT NULL,
  "ends_at" integer NOT NULL,
  "status" text DEFAULT 'open' NOT NULL
);
`);
  await client.execute(`
CREATE TABLE IF NOT EXISTS "team_war_stats" (
  "team_id" text PRIMARY KEY NOT NULL,
  "league" text DEFAULT 'bronze' NOT NULL,
  "lp" integer DEFAULT 0 NOT NULL,
  "wins" integer DEFAULT 0 NOT NULL,
  "losses" integer DEFAULT 0 NOT NULL,
  "draws" integer DEFAULT 0 NOT NULL,
  "season_key" text NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await client.execute(`
CREATE TABLE IF NOT EXISTS "team_war_queue" (
  "id" text PRIMARY KEY NOT NULL,
  "team_id" text NOT NULL,
  "league" text NOT NULL,
  "lp" integer DEFAULT 0 NOT NULL,
  "queued_at" integer NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "team_war_queue_team_uidx" ON "team_war_queue" ("team_id")`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "team_war_queue_league_status_idx" ON "team_war_queue" ("league","status","lp")`,
  );
  await client.execute(`
CREATE TABLE IF NOT EXISTS "wars" (
  "id" text PRIMARY KEY NOT NULL,
  "season_key" text NOT NULL,
  "team_a_id" text NOT NULL,
  "team_b_id" text NOT NULL,
  "starts_at" integer NOT NULL,
  "ends_at" integer NOT NULL,
  "status" text DEFAULT 'live' NOT NULL,
  "score_a" real DEFAULT 0 NOT NULL,
  "score_b" real DEFAULT 0 NOT NULL,
  "winner_team_id" text,
  "summary_json" text DEFAULT '{}' NOT NULL,
  "completed_at" integer,
  FOREIGN KEY ("team_a_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("team_b_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("winner_team_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE SET NULL
);
`);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "wars_status_ends_idx" ON "wars" ("status","ends_at")`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "wars_team_a_idx" ON "wars" ("team_a_id","status")`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "wars_team_b_idx" ON "wars" ("team_b_id","status")`,
  );
  await client.execute(`
CREATE TABLE IF NOT EXISTS "war_score_snapshots" (
  "id" text PRIMARY KEY NOT NULL,
  "war_id" text NOT NULL,
  "team_id" text NOT NULL,
  "captured_at" integer NOT NULL,
  "score" real DEFAULT 0 NOT NULL,
  "components_json" text DEFAULT '{}' NOT NULL,
  FOREIGN KEY ("war_id") REFERENCES "wars"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "war_score_snapshots_war_team_idx" ON "war_score_snapshots" ("war_id","team_id","captured_at")`,
  );

  await tryAddColumn(
    `ALTER TABLE "user_community_xp" ADD COLUMN "prestige" integer NOT NULL DEFAULT 0`,
  );
  await tryAddColumn(
    `ALTER TABLE "user_community_xp" ADD COLUMN "prestige_xp_lifetime" integer NOT NULL DEFAULT 0`,
  );
  await tryAddColumn(`ALTER TABLE "user_community_xp" ADD COLUMN "title_key" text`);
  await tryAddColumn(`ALTER TABLE "user_community_xp" ADD COLUMN "frame_key" text`);
  await tryAddColumn(`ALTER TABLE "user_community_xp" ADD COLUMN "aura_key" text`);

  await client.execute(`
CREATE TABLE IF NOT EXISTS "progression_xp_ledger" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text,
  "team_id" text,
  "track" text NOT NULL,
  "amount" integer NOT NULL,
  "source" text NOT NULL,
  "source_key" text NOT NULL,
  "season_key" text,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE SET NULL
);
`);
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "progression_xp_ledger_source_uidx" ON "progression_xp_ledger" ("source_key")`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "progression_xp_ledger_user_created_idx" ON "progression_xp_ledger" ("user_id","created_at")`,
  );
  await client.execute(`
CREATE TABLE IF NOT EXISTS "team_xp" (
  "team_id" text PRIMARY KEY NOT NULL,
  "xp_total" integer DEFAULT 0 NOT NULL,
  "level" integer DEFAULT 1 NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await client.execute(`
CREATE TABLE IF NOT EXISTS "community_xp" (
  "id" text PRIMARY KEY NOT NULL,
  "xp_total" integer DEFAULT 0 NOT NULL,
  "level" integer DEFAULT 1 NOT NULL,
  "updated_at" integer NOT NULL
);
`);
  await client.execute(`
CREATE TABLE IF NOT EXISTS "user_season_xp" (
  "user_id" text NOT NULL,
  "season_key" text NOT NULL,
  "xp_total" integer DEFAULT 0 NOT NULL,
  "level" integer DEFAULT 1 NOT NULL,
  "finalized" integer DEFAULT 0 NOT NULL,
  PRIMARY KEY ("user_id", "season_key"),
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await client.execute(`
CREATE TABLE IF NOT EXISTS "user_cosmetics" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "cosmetic_key" text NOT NULL,
  "unlocked_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "user_cosmetics_user_key_uidx" ON "user_cosmetics" ("user_id","cosmetic_key")`,
  );
  await client.execute(`
CREATE TABLE IF NOT EXISTS "user_cosmetic_loadout" (
  "user_id" text PRIMARY KEY NOT NULL,
  "frame_key" text,
  "aura_key" text,
  "title_key" text,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);

  await client.execute(`
CREATE TABLE IF NOT EXISTS "user_social_profiles" (
  "user_id" text PRIMARY KEY NOT NULL,
  "visibility" text DEFAULT 'friends' NOT NULL,
  "bio" text,
  "show_stats" integer DEFAULT 1 NOT NULL,
  "show_on_global" integer DEFAULT 1 NOT NULL,
  "discoverable" integer DEFAULT 1 NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await client.execute(`
CREATE TABLE IF NOT EXISTS "user_follows" (
  "id" text PRIMARY KEY NOT NULL,
  "follower_id" text NOT NULL,
  "following_id" text NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY ("following_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "user_follows_pair_uidx" ON "user_follows" ("follower_id","following_id")`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "user_follows_following_idx" ON "user_follows" ("following_id")`,
  );
  await client.execute(`
CREATE TABLE IF NOT EXISTS "user_activity_posts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "meta_json" text DEFAULT '{}' NOT NULL,
  "visibility_snapshot" text DEFAULT 'friends' NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "user_activity_posts_user_created_idx" ON "user_activity_posts" ("user_id","created_at")`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "user_activity_posts_created_idx" ON "user_activity_posts" ("created_at")`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "user_activity_posts_vis_created_idx" ON "user_activity_posts" ("visibility_snapshot","created_at")`,
  );

  // Web Push + dedupe przypomnień (0030_push_reminders).
  await client.execute(`
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_uidx" ON "push_subscriptions" ("endpoint")`,
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS "push_subscriptions_user_idx" ON "push_subscriptions" ("user_id")`,
  );
  await client.execute(`
CREATE TABLE IF NOT EXISTS "reminder_dispatches" (
  "user_id" text NOT NULL,
  "date_key" text NOT NULL,
  "kind" text NOT NULL,
  "sent_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
`);
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "reminder_dispatches_uidx" ON "reminder_dispatches" ("user_id","date_key","kind")`,
  );
}

let mealLogsEnsured = false;

/** Jednorazowo na proces — przed SELECT na meal_logs (np. gdy migracje plikowe nie dołączyły się do deployu). */
export async function ensureMealLogsTableOncePerProcess(): Promise<void> {
  if (mealLogsEnsured) return;
  await ensureCriticalSchema();
  mealLogsEnsured = true;
}
