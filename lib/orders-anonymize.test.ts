import type { Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";

/**
 * Z7: usunięcie konta nie kasuje dokumentacji sprzedaży — zamówienie zostaje z `user_id = NULL`.
 * Baza testowa ma wyłączone klucze obce, więc włączamy je jak na Turso, żeby sprawdzić ON DELETE SET NULL.
 */
describe("zamówienia po usunięciu konta (Z7)", () => {
  let client: Client;
  let db: Database;

  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
    await client.execute("PRAGMA foreign_keys = ON");
  });
  afterAll(() => client.close());

  it("schemat: user_id jest nullable, a klucz ma ON DELETE SET NULL", async () => {
    const cols = await client.execute(`PRAGMA table_info("subscription_orders")`);
    const userId = cols.rows.find((r) => String(r.name) === "user_id");
    expect(Number(userId!.notnull)).toBe(0);
    const fks = await client.execute(`PRAGMA foreign_key_list("subscription_orders")`);
    const userFk = fks.rows.find((r) => String(r.from) === "user_id");
    expect(String(userFk!.on_delete).toUpperCase()).toBe("SET NULL");
  });

  it("usunięcie użytkownika zostawia zamówienia, odpina je od konta i zachowuje dane rozliczeniowe", async () => {
    await db.insert(schema.users).values({ id: "u1", email: "u1@example.com", passwordHash: "x" });
    await db.insert(schema.subscriptionOrders).values([
      {
        id: "o1",
        userId: "u1",
        planSku: "m1",
        days: 30,
        amountGrosze: 1999,
        status: "paid",
        hotpayPaymentId: "p1",
        paidAt: new Date(1_700_000_000_000),
      },
      { id: "o2", userId: "u1", planSku: "d7", days: 7, amountGrosze: 399, status: "pending" },
    ]);

    await db.delete(schema.users).where(eq(schema.users.id, "u1"));

    const rows = await client.execute(
      `SELECT id, user_id, plan_sku, amount_grosze, status, hotpay_payment_id, paid_at FROM subscription_orders ORDER BY id`,
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.every((r) => r.user_id === null)).toBe(true);
    expect(rows.rows[0]).toMatchObject({
      plan_sku: "m1",
      amount_grosze: 1999,
      status: "paid",
      hotpay_payment_id: "p1",
    });
    expect(Number(rows.rows[0]!.paid_at)).toBe(1_700_000_000_000);
  });

  it("zamówienie może powstać bez użytkownika (anonimowy wiersz)", async () => {
    await db.insert(schema.subscriptionOrders).values({
      id: "o3",
      userId: null,
      planSku: "d30",
      days: 30,
      amountGrosze: 899,
      status: "paid",
    });
    const rs = await client.execute(`SELECT user_id FROM subscription_orders WHERE id = 'o3'`);
    expect(rs.rows[0]!.user_id).toBeNull();
  });
});
