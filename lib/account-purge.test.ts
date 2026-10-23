import type { Client } from "@libsql/client";
import { is, sql } from "drizzle-orm";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { Database } from "@/db";
import { countRows, createMemoryDb } from "@/db/test-memory-db";
import {
  buildUserDataPurgeStatements,
  buildUserDataPurgeSteps,
  PURGE_EXCLUDED_TABLES,
} from "@/lib/account-purge";

const steps = buildUserDataPurgeSteps("u-target");
const deletedTables = new Set(steps.filter((s) => s.action === "delete").map((s) => s.table));

describe("buildUserDataPurgeSteps", () => {
  it("obejmuje dane ciała, zdrowia, posiłków, treningów, społeczności i powiązania", () => {
    for (const t of [
      "body_reports",
      "body_report_photos",
      "weight_logs",
      "meal_logs",
      "workouts",
      "daily_checkins",
      "user_settings",
      "oauth_accounts",
      "push_subscriptions",
      "chat_messages",
      "team_posts",
    ]) {
      expect(deletedTables, t).toContain(t);
    }
  });

  it("pomija dowody zdarzeń, wiersz users i zamówienia (A9)", () => {
    for (const t of ["site_activity_log", "page_views", "admin_audit_log", "users"]) {
      expect(steps.some((s) => s.table === t), t).toBe(false);
    }
    expect(PURGE_EXCLUDED_TABLES.has("subscription_orders")).toBe(true);
    expect(steps.some((s) => s.table === "subscription_orders")).toBe(false);
  });

  it("dzieci są usuwane przed rodzicami na tej samej ścieżce", () => {
    const index = (path: string) => steps.findIndex((s) => s.path === path);
    expect(index("users > body_reports > body_report_photos")).toBeLessThan(
      index("users > body_reports"),
    );
    steps.forEach((step, idx) => {
      const parentPath = step.path.split(" > ").slice(0, -1).join(" > ");
      if (parentPath === "users") return;
      const parentLater = steps
        .slice(idx + 1)
        .some((s) => s.path === parentPath && s.action === "delete");
      expect(parentLater, step.path).toBe(true);
    });
  });

  it("każda kolumna user_id ma klucz obcy do users (inaczej purge ją pominie, ryzyko A3)", () => {
    const missing: string[] = [];
    for (const table of Object.values(schema)) {
      if (!is(table, SQLiteTable)) continue;
      const config = getTableConfig(table);
      const fkColumns = new Set(
        config.foreignKeys.flatMap((fk) => fk.reference().columns.map((c) => c.name)),
      );
      for (const col of config.columns) {
        if (col.name === "user_id" && !fkColumns.has(col.name)) missing.push(config.name);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("buildUserDataPurgeStatements (integracja, klucze obce wyłączone)", () => {
  let client: Client;
  let db: Database;

  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
  });

  afterAll(() => {
    client.close();
  });

  const count = (table: string, where?: string) => countRows(client, table, where);

  async function seedUser(id: string, verified: boolean) {
    const now = new Date();
    await db.insert(schema.users).values({
      id,
      email: `${id}@example.com`,
      passwordHash: "x",
      createdAt: now,
      emailVerifiedAt: verified ? now : null,
    });
    await db.insert(schema.userSettings).values({ userId: id });
    await db.insert(schema.bodyReports).values({ id: `br-${id}`, userId: id });
    await db
      .insert(schema.bodyReportPhotos)
      .values({ id: `brp-${id}`, reportId: `br-${id}`, dataUrl: "data:" });
    await db.insert(schema.weightLogs).values({ userId: id, weightKg: 80 });
    await db
      .insert(schema.oauthAccounts)
      .values({ userId: id, provider: "google", providerAccountId: `g-${id}` });
    await db.insert(schema.siteActivityLog).values({ userId: id, action: "Logowanie" });
    await db.insert(schema.subscriptionOrders).values({
      userId: id,
      planSku: "d30",
      days: 30,
      amountGrosze: 999,
      status: "paid",
    });
  }

  it("usuwa dane zależne, zostawia users, dowody i zamówienia; nie rusza innych kont", async () => {
    await seedUser("u-target", false);
    await seedUser("u-other", false);

    await db.batch(
      buildUserDataPurgeStatements(db, "u-target") as unknown as Parameters<Database["batch"]>[0],
    );

    for (const t of ["user_settings", "body_reports", "weight_logs", "oauth_accounts"]) {
      expect(await count(t, `user_id = 'u-target'`), t).toBe(0);
      expect(await count(t, `user_id = 'u-other'`), t).toBe(1);
    }
    expect(await count("body_report_photos", `id = 'brp-u-target'`)).toBe(0);
    expect(await count("body_report_photos", `id = 'brp-u-other'`)).toBe(1);
    expect(await count("users", `id = 'u-target'`)).toBe(1);
    expect(await count("site_activity_log", `user_id = 'u-target'`)).toBe(1);
    expect(await count("subscription_orders", `user_id = 'u-target'`)).toBe(1);
  });

  it("guard: nic nie usuwa, gdy warunek nie jest spełniony", async () => {
    await seedUser("u-verified", true);
    await db.batch(
      buildUserDataPurgeStatements(db, "u-verified", {
        guard: sql`EXISTS (SELECT 1 FROM users WHERE id = 'u-verified' AND email_verified_at IS NULL)`,
      }) as unknown as Parameters<Database["batch"]>[0],
    );
    expect(await count("body_reports", `user_id = 'u-verified'`)).toBe(1);
    expect(await count("body_report_photos", `id = 'brp-u-verified'`)).toBe(1);
  });
});
