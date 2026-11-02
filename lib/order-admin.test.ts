import type { Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";
import {
  applyOrderAction,
  expirePendingOrders,
  findReusablePendingOrder,
  getPaymentAlerts,
} from "@/lib/order-admin";

let db: Database;
let client: Client;
const H = 3_600_000;

async function seed(over: Partial<typeof schema.subscriptionOrders.$inferInsert> & { id: string }) {
  await db.insert(schema.subscriptionOrders).values({
    userId: "u1",
    planSku: "m1",
    days: 30,
    amountGrosze: 1999,
    status: "pending",
    ...over,
  });
}
const order = async (id: string) =>
  (await client.execute({ sql: `SELECT * FROM subscription_orders WHERE id = ?`, args: [id] })).rows[0]!;
const ends = async () => {
  const v = (await client.execute(`SELECT package_ends_at AS e FROM users WHERE id='u1'`)).rows[0]!.e;
  return v == null ? null : Number(v);
};

describe("order-admin (Z22/Z23)", () => {
  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
  });
  afterAll(() => client.close());
  beforeEach(async () => {
    await client.execute(`DELETE FROM subscription_orders`);
    await client.execute(`DELETE FROM users`);
    await db.insert(schema.users).values({ id: "u1", email: "u1@example.com", passwordHash: "x" });
  });

  it("expirePendingOrders: pending > 24 h → expired; świeże i z późną płatnością zostają", async () => {
    const now = Date.now();
    await seed({ id: "old", createdAt: new Date(now - 25 * H) });
    await seed({ id: "new", createdAt: new Date(now - 2 * H) });
    await seed({ id: "late", createdAt: new Date(now - 30 * H), latePaymentAt: new Date(now) });
    expect(await expirePendingOrders(db, now)).toBe(1);
    expect((await order("old")).status).toBe("expired");
    expect((await order("new")).status).toBe("pending");
    expect((await order("late")).status).toBe("pending");
  });

  it("findReusablePendingOrder: tylko ta sama kwota/pakiet w 15 min", async () => {
    const now = Date.now();
    await seed({ id: "a", createdAt: new Date(now - 5 * 60_000) });
    expect(await findReusablePendingOrder(db, { userId: "u1", planSku: "m1", amountGrosze: 1999, now })).toBe("a");
    expect(await findReusablePendingOrder(db, { userId: "u1", planSku: "m1", amountGrosze: 2499, now })).toBeNull();
    expect(await findReusablePendingOrder(db, { userId: "u1", planSku: "m1", amountGrosze: 1999, now: now + 20 * 60_000 })).toBeNull();
  });

  it("book: przyznaje pakiet raz, status manual, notatka; powtórka 409 bez drugiego przedłużenia", async () => {
    await seed({ id: "o1", status: "amount_mismatch" });
    expect(await applyOrderAction(db, { orderId: "o1", action: "book", adminEmail: "a@x.pl", note: "ok" })).toEqual({ ok: true });
    const first = await ends();
    expect(first).not.toBeNull();
    const o = await order("o1");
    expect(o.status).toBe("manual");
    expect(o.fulfilled_at).not.toBeNull();
    expect(String(o.admin_note)).toContain("a@x.pl");
    const again = await applyOrderAction(db, { orderId: "o1", action: "book", adminEmail: "a@x.pl" });
    expect(again).toMatchObject({ ok: false, status: 409 });
    expect(await ends()).toBe(first);
  });

  it("book: zamówienie bez konta nie jest księgowane", async () => {
    await seed({ id: "o2", userId: null, status: "pending" });
    expect(await applyOrderAction(db, { orderId: "o2", action: "book", adminEmail: "a@x.pl" })).toMatchObject({ ok: false, status: 409 });
  });

  it("cancel: tylko pending", async () => {
    await seed({ id: "p", status: "pending" });
    await seed({ id: "d", status: "paid" });
    expect(await applyOrderAction(db, { orderId: "p", action: "cancel", adminEmail: "a@x.pl" })).toEqual({ ok: true });
    expect((await order("p")).status).toBe("cancelled");
    expect(await applyOrderAction(db, { orderId: "d", action: "cancel", adminEmail: "a@x.pl" })).toMatchObject({ ok: false, status: 409 });
  });

  it("refund: wymaga notatki, ustawia refunded i nie cofa dni pakietu (DK-20)", async () => {
    const future = Date.now() + 10 * 86_400_000;
    await client.execute({ sql: `UPDATE users SET package_ends_at = ? WHERE id='u1'`, args: [future] });
    await seed({ id: "r", status: "paid" });
    expect(await applyOrderAction(db, { orderId: "r", action: "refund", adminEmail: "a@x.pl" })).toMatchObject({ ok: false, status: 400 });
    expect(await applyOrderAction(db, { orderId: "r", action: "refund", adminEmail: "a@x.pl", note: "HP-1" })).toEqual({ ok: true });
    const o = await order("r");
    expect(o.status).toBe("refunded");
    expect(o.refunded_at).not.toBeNull();
    expect(await ends()).toBe(future);
  });

  it("nieznane zamówienie: 404", async () => {
    expect(await applyOrderAction(db, { orderId: "x", action: "cancel", adminEmail: "a@x.pl" })).toMatchObject({ ok: false, status: 404 });
  });

  it("getPaymentAlerts: pending > 1 h, paid bez fulfilled_at, amount_mismatch, późne płatności", async () => {
    const now = Date.now();
    await seed({ id: "s", createdAt: new Date(now - 2 * H) });
    await seed({ id: "f", createdAt: new Date(now - 10 * 60_000) });
    await seed({ id: "pu", status: "paid" });
    await seed({ id: "pf", status: "paid", fulfilledAt: new Date(now) });
    await seed({ id: "am", status: "amount_mismatch" });
    await seed({ id: "lp", status: "cancelled", latePaymentAt: new Date(now) });
    const a = await getPaymentAlerts(db, now);
    expect(a).toMatchObject({ pendingStale: 1, paidUnfulfilled: 1, amountMismatch: 1, latePayments: 1, total: 4 });
  });
});
