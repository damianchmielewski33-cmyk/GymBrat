import type { Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";

let db: Database;
const extendUserPackage = vi.fn(async () => undefined);
const logServerError = vi.fn();

vi.mock("@/db", () => ({ getDb: () => db }));
vi.mock("@/db/ensure-schema", () => ({ ensureCriticalSchema: async () => undefined }));
vi.mock("@/lib/hotpay", () => ({ verifyHotpayNotificationHash: () => true }));
vi.mock("@/lib/user-package", () => ({ extendUserPackage }));
vi.mock("@/lib/errors/server-log", async (orig) => ({
  ...(await orig<typeof import("@/lib/errors/server-log")>()),
  logServerError,
}));

const { POST } = await import("@/app/api/payments/hotpay/notify/route");

function notify(status: "SUCCESS" | "FAILURE", orderId = "o1") {
  return POST(
    new Request("http://localhost/api/payments/hotpay/notify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        KWOTA: "19.99",
        ID_PLATNOSCI: "pay-1",
        ID_ZAMOWIENIA: orderId,
        STATUS: status,
        SEKRET: "s",
        HASH: "h",
      }),
    }),
  );
}

describe("HotPay notify: przedłużenie pakietu tylko przy przejściu pending → paid", () => {
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

  async function orderStatus() {
    const rs = await client.execute(`SELECT status FROM subscription_orders WHERE id = 'o1'`);
    return rs.rows[0]!.status;
  }

  beforeEach(async () => {
    await client.execute(`DELETE FROM subscription_orders`);
    extendUserPackage.mockClear();
    logServerError.mockClear();
  });

  it("pending + SUCCESS: paid i jedno przedłużenie", async () => {
    await seedOrder("pending");
    expect((await notify("SUCCESS")).status).toBe(200);
    expect(await orderStatus()).toBe("paid");
    expect(extendUserPackage).toHaveBeenCalledTimes(1);
    expect(extendUserPackage).toHaveBeenCalledWith({ userId: "u1", days: 30, planSku: "m1" });
  });

  it("powtórzone SUCCESS nie przedłuża drugi raz", async () => {
    await seedOrder("pending");
    await notify("SUCCESS");
    await notify("SUCCESS");
    expect(extendUserPackage).toHaveBeenCalledTimes(1);
    expect(logServerError).not.toHaveBeenCalled();
  });

  it.each(["cancelled", "failed"])(
    "%s + SUCCESS: bez pakietu, status bez zmian, log do ręcznej obsługi bez danych osobowych",
    async (status) => {
      await seedOrder(status);
      expect((await notify("SUCCESS")).status).toBe(200);
      expect(await orderStatus()).toBe(status);
      expect(extendUserPackage).not.toHaveBeenCalled();
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
    expect(extendUserPackage).not.toHaveBeenCalled();
  });
});
