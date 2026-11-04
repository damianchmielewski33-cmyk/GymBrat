import type { Client } from "@libsql/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";

let db: Database;
let userId: string | null = "u1";
vi.mock("@/db", () => ({ getDb: () => db }));
vi.mock("@/db/ensure-schema", () => ({ ensureCriticalSchema: async () => undefined }));
vi.mock("@/auth", () => ({ auth: async () => (userId ? { user: { id: userId } } : null) }));

const { GET } = await import("@/app/api/package/orders/[id]/route");
const call = (id: string) =>
  GET(new Request("http://localhost/x"), { params: Promise.resolve({ id }) });

describe("GET /api/package/orders/[id]", () => {
  let client: Client;
  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
    await db.insert(schema.users).values([
      { id: "u1", email: "a@example.com", passwordHash: "x" },
      { id: "u2", email: "b@example.com", passwordHash: "x" },
    ]);
    await db.insert(schema.subscriptionOrders).values([
      { id: "o1", userId: "u1", planSku: "m1", days: 30, amountGrosze: 1999, status: "pending" },
      { id: "o2", userId: "u2", planSku: "m1", days: 30, amountGrosze: 1999, status: "paid" },
    ]);
  });
  afterAll(() => client.close());

  it("zwraca status własnego zamówienia", async () => {
    const res = await call("o1");
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("pending");
  });
  it("cudze zamówienie → 404, brak sesji → 401", async () => {
    expect((await call("o2")).status).toBe(404);
    userId = null;
    expect((await call("o1")).status).toBe(401);
    userId = "u1";
  });
});
