import type { Client } from "@libsql/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";

let db: Database;
vi.mock("@/db", () => ({ getDb: () => db }));
vi.mock("@/db/ensure-schema", () => ({ ensureCriticalSchema: async () => undefined }));

const { issueReceipt, getIssuedReceipt } = await import("@/lib/receipts");

describe("potwierdzenia zakupu (Z21)", () => {
  let client: Client;
  const paidAt = new Date("2026-11-02T10:00:00Z");

  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
    await db.insert(schema.users).values([
      { id: "u1", email: "u1@example.com", passwordHash: "x" },
      { id: "u2", email: "u2@example.com", passwordHash: "x" },
    ]);
    await db.insert(schema.subscriptionOrders).values([
      { id: "o1", userId: "u1", planSku: "m1", days: 30, amountGrosze: 1999, status: "paid", paidAt },
      { id: "o2", userId: "u1", planSku: "m1", days: 30, amountGrosze: 1999, status: "paid", paidAt },
      { id: "o3", userId: "u2", planSku: "m1", days: 30, amountGrosze: 1999, status: "paid", paidAt },
      { id: "o4", userId: "u1", planSku: "m1", days: 30, amountGrosze: 1999, status: "pending" },
    ]);
  });
  afterAll(() => client.close());

  const none = { name: null, taxId: null };

  it("numeruje po kolei GB/RRRR/NNNNNN (rok z daty zapłaty)", async () => {
    const a = await issueReceipt("u1", "o1", { name: "Jan", taxId: null });
    const b = await issueReceipt("u2", "o3", none);
    expect(a.ok && a.receipt.number).toBe("GB/2026/000001");
    expect(b.ok && b.receipt.number).toBe("GB/2026/000002");
  });

  it("jest idempotentne: drugie wywołanie nie zmienia numeru, licznika ani danych nabywcy", async () => {
    const again = await issueReceipt("u1", "o1", { name: "Ktoś inny", taxId: "5261040828" });
    expect(again.ok && again.receipt.number).toBe("GB/2026/000001");
    expect(again.ok && again.receipt.buyerName).toBe("Jan");
    const c = await issueReceipt("u1", "o2", none);
    expect(c.ok && c.receipt.number).toBe("GB/2026/000003");
  });

  it("nie wystawia dla nieopłaconego ani cudzego zamówienia", async () => {
    expect(await issueReceipt("u1", "o4", none)).toEqual({ ok: false, reason: "not_paid" });
    expect(await issueReceipt("u1", "o3", none)).toEqual({ ok: false, reason: "not_found" });
    expect(await getIssuedReceipt("u1", "o3")).toBeNull();
    const rs = await client.execute(`SELECT last_number AS n FROM receipt_counters WHERE year = 2026`);
    expect(Number(rs.rows[0].n)).toBe(3);
  });
});
