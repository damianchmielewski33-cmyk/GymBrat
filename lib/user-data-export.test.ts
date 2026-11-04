import type { Client } from "@libsql/client";
import { is } from "drizzle-orm";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";
import { buildUserDataPurgeSteps, PURGE_EXCLUDED_TABLES } from "@/lib/account-purge";
import { EXPORT_MAIN_TABLES, EXPORT_SECRET_TABLES, extraExportTables } from "@/lib/user-data-export-extra";

let db: Database;
vi.mock("@/db", () => ({ getDb: () => db }));

const { buildUserDataExport } = await import("@/lib/user-data-export");

describe("kompletność eksportu danych (Z26)", () => {
  it("każda tabela z user_id jest eksportowana, świadomie wyłączona albo obsłużona osobno", () => {
    const covered = new Set<string>([
      ...EXPORT_MAIN_TABLES,
      ...EXPORT_SECRET_TABLES,
      ...extraExportTables(),
      // zamówienia: osobna sekcja `orders`; users: sekcja `user`
      "subscription_orders",
      "users",
      // dowody zdarzeń (analityka): `set null` do users, zostają po usunięciu konta (LR-27)
      "page_views",
      "site_activity_log",
    ]);
    // Wiersze, które purge/eksport pomijają celowo: dowody zdarzeń (`set null` do users).
    const evidence = new Set(
      buildUserDataPurgeSteps("x")
        .filter((s) => s.action === "set_null")
        .map((s) => s.table),
    );
    const missing: string[] = [];
    for (const table of Object.values(schema)) {
      if (!is(table, SQLiteTable)) continue;
      const config = getTableConfig(table);
      if (!config.columns.some((c) => c.name === "user_id")) continue;
      if (covered.has(config.name) || evidence.has(config.name)) continue;
      if (PURGE_EXCLUDED_TABLES.has(config.name)) continue;
      missing.push(config.name);
    }
    expect(missing).toEqual([]);
  });
});

describe("buildUserDataExport (integracja)", () => {
  let client: Client;
  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
    await db.insert(schema.users).values([
      { id: "u1", email: "u1@example.com", passwordHash: "x" },
      { id: "u2", email: "u2@example.com", passwordHash: "x" },
    ]);
    await db.insert(schema.subscriptionOrders).values([
      { id: "o1", userId: "u1", planSku: "m1", days: 30, amountGrosze: 1999, status: "paid" },
      { id: "o2", userId: "u2", planSku: "m1", days: 30, amountGrosze: 1999, status: "paid" },
    ]);
    await db.insert(schema.userConsents).values([
      { userId: "u1", type: "health", granted: true, source: "profile", textVersion: "t", decidedAt: new Date() },
      { userId: "u2", type: "health", granted: true, source: "profile", textVersion: "t", decidedAt: new Date() },
    ] as never);
  });
  afterAll(() => client.close());

  it("zawiera zamówienia i zgody tylko tego użytkownika oraz nie zawiera sekretów", async () => {
    const data = await buildUserDataExport("u1");
    expect(data.exportVersion).toBe(2);
    expect(data.orders.map((o) => o.id)).toEqual(["o1"]);
    expect(data.otherData.user_consents).toHaveLength(1);
    expect(data.otherData.push_subscriptions).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain("u2@example.com");
    expect(JSON.stringify(data.user)).not.toContain("passwordHash");
  });
});
