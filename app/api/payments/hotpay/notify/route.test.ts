import type { Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";

let db: Database;
const logServerError = vi.fn();

vi.mock("@/db", () => ({ getDb: () => db }));
vi.mock("@/db/ensure-schema", () => ({ ensureCriticalSchema: async () => undefined }));
vi.mock("@/lib/hotpay", () => ({ verifyHotpayNotificationHash: () => true }));
vi.mock("@/lib/errors/server-log", async (orig) => ({
  ...(await orig<typeof import("@/lib/errors/server-log")>()),
  logServerError,
}));

const { POST } = await import("@/app/api/payments/hotpay/notify/route");

function notify(status: "SUCCESS" | "FAILURE", orderId = "o1", kwota = "19.99") {
  return POST(
    new Request("http://localhost/api/payments/hotpay/notify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        KWOTA: kwota,
        ID_PLATNOSCI: "pay-1",
        ID_ZAMOWIENIA: orderId,
        STATUS: status,
        SEKRET: "s",
        HASH: "h",
      }),
    }),
  );
}

describe("HotPay notify: przedłużenie pakietu tylko przy przejściu pending → paid i zgodnej kwocie", () => {
  let client: Client;

  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
  });

  afterAll(() => {
    client.close();
  });

  async function seedOrder(status: string) {
    await db.insert(schema.subscriptionOrders).values({
      id: "o1",
      userId: "u1",
      planSku: "m1",
      days: 30,
      amountGrosze: 1999,
      status,
    });
  }

  async function packageEndsAt(): Promise<number | null> {
    const rs = await client.execute(`SELECT package_ends_at AS e FROM users WHERE id = 'u1'`);
    const v = rs.rows[0]?.e;
    return v == null ? null : Number(v);
  }

  async function orderStatus() {
    const rs = await client.execute(`SELECT status FROM subscription_orders WHERE id = 'o1'`);
    return rs.rows[0]!.status;
  }

  beforeEach(async () => {
    await client.execute(`DELETE FROM subscription_orders`);
    await client.execute(`DELETE FROM users`);
    await db.insert(schema.users).values({ id: "u1", email: "u1@example.com", passwordHash: "x" });
    logServerError.mockClear();
  });

  it("pending + SUCCESS: paid i jedno przedłużenie o 30 dni", async () => {
    await seedOrder("pending");
    const before = Date.now();
    expect((await notify("SUCCESS")).status).toBe(200);
    expect(await orderStatus()).toBe("paid");
    const ends = await packageEndsAt();
    expect(ends).not.toBeNull();
    const thirtyDays = 30 * 86_400_000;
    expect(ends!).toBeGreaterThanOrEqual(before + thirtyDays);
    expect(ends!).toBeLessThanOrEqual(Date.now() + thirtyDays);
    const plan = await client.execute(`SELECT package_plan_sku AS p FROM users WHERE id = 'u1'`);
    expect(plan.rows[0]!.p).toBe("m1");
  });

  it("aktywny pakiet jest przedłużany od jego końca, nie od teraz", async () => {
    const future = Date.now() + 10 * 86_400_000;
    await client.execute({ sql: `UPDATE users SET package_ends_at = ? WHERE id = 'u1'`, args: [future] });
    await seedOrder("pending");
    await notify("SUCCESS");
    expect(await packageEndsAt()).toBe(future + 30 * 86_400_000);
  });

  it("powtórzone SUCCESS nie przedłuża drugi raz", async () => {
    await seedOrder("pending");
    await notify("SUCCESS");
    const first = await packageEndsAt();
    await notify("SUCCESS");
    expect(await packageEndsAt()).toBe(first);
    expect(logServerError).not.toHaveBeenCalled();
  });

  it("równoległe powiadomienia SUCCESS przedłużają pakiet dokładnie raz", async () => {
    await seedOrder("pending");
    const before = Date.now();
    const results = await Promise.all([notify("SUCCESS"), notify("SUCCESS"), notify("SUCCESS")]);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    const ends = await packageEndsAt();
    expect(ends!).toBeLessThan(before + 2 * 30 * 86_400_000);
    expect(await orderStatus()).toBe("paid");
  });

  it("niezgodna kwota (19,99 zł vs 0.01): amount_mismatch, bez pakietu, log do ręcznej obsługi", async () => {
    await seedOrder("pending");
    expect((await notify("SUCCESS", "o1", "0.01")).status).toBe(200);
    expect(await orderStatus()).toBe("amount_mismatch");
    expect(await packageEndsAt()).toBeNull();
    expect(logServerError).toHaveBeenCalledTimes(1);
    const [error] = logServerError.mock.calls[0] as unknown as [Error];
    expect(error.message).toContain("amount_mismatch order o1");
    expect(error.message).not.toContain("u1");
  });

  it.each(["", "abc", "-19.99", "19.999", "1e2"])("nieprawidłowa kwota %j: amount_mismatch, bez pakietu", async (kwota) => {
    await seedOrder("pending");
    // pusta KWOTA kończy się 400 MISSING przed księgowaniem — zamówienie zostaje pending
    const res = await notify("SUCCESS", "o1", kwota);
    if (kwota === "") {
      expect(res.status).toBe(400);
      expect(await orderStatus()).toBe("pending");
    } else {
      expect(await orderStatus()).toBe("amount_mismatch");
    }
    expect(await packageEndsAt()).toBeNull();
  });

  it("kwota z przecinkiem (19,99) jest zgodna", async () => {
    await seedOrder("pending");
    await notify("SUCCESS", "o1", "19,99");
    expect(await orderStatus()).toBe("paid");
  });

  it("SUCCESS po amount_mismatch nie daje pakietu (do ręcznej obsługi)", async () => {
    await seedOrder("pending");
    await notify("SUCCESS", "o1", "0.01");
    logServerError.mockClear();
    await notify("SUCCESS", "o1", "19.99");
    expect(await orderStatus()).toBe("amount_mismatch");
    expect(await packageEndsAt()).toBeNull();
    expect(logServerError).toHaveBeenCalledTimes(1);
  });

  it.each(["cancelled", "failed"])(
    "%s + SUCCESS: bez pakietu, status bez zmian, log do ręcznej obsługi bez danych osobowych",
    async (status) => {
      await seedOrder(status);
      expect((await notify("SUCCESS")).status).toBe(200);
      expect(await orderStatus()).toBe(status);
      expect(await packageEndsAt()).toBeNull();
      expect(logServerError).toHaveBeenCalledTimes(1);
      const [error] = logServerError.mock.calls[0] as unknown as [Error];
      expect(error.message).toContain(`paid_${status}_order o1`);
      expect(error.message).not.toContain("u1");
    },
  );

  it("FAILURE dla pending: failed bez pakietu", async () => {
    await seedOrder("pending");
    await notify("FAILURE");
    expect(await orderStatus()).toBe("failed");
    expect(await packageEndsAt()).toBeNull();
  });

  it("FAILURE po paid nie cofa płatności", async () => {
    await seedOrder("pending");
    await notify("SUCCESS");
    await notify("FAILURE");
    expect(await orderStatus()).toBe("paid");
  });

  it("nieznane zamówienie: 404", async () => {
    expect((await notify("SUCCESS", "brak")).status).toBe(404);
  });
});
