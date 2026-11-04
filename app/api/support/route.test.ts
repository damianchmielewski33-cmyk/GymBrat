import type { Client } from "@libsql/client";
import { NextResponse } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";

let db: Database;
const auth = vi.fn();
const sendSupportReceivedEmail = vi.fn(async () => true);
vi.mock("@/db", () => ({ getDb: () => db }));
vi.mock("@/db/ensure-schema", () => ({ ensureCriticalSchema: async () => {} }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/csrf", () => ({ assertCsrf: (): NextResponse | null => null }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitAsync: async () => ({ ok: true, retryAfterSec: 0 }),
  RATE: {},
}));
vi.mock("@/lib/email", () => ({ sendSupportReceivedEmail }));

const { POST } = await import("@/app/api/support/route");

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/support", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const valid = { kind: "complaint", subject: "Brak pakietu", message: "Zapłaciłem, a pakiet nie działa." };

describe("POST /api/support (Z50)", () => {
  let client: Client;
  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
  });
  afterAll(() => client.close());
  beforeEach(async () => {
    await client.execute(`DELETE FROM support_requests`);
    await client.execute(`DELETE FROM users`);
    await db.insert(schema.users).values({ id: "u1", email: "u1@example.com", passwordHash: "x" });
    auth.mockResolvedValue({ user: { id: "u1" } });
    sendSupportReceivedEmail.mockClear();
  });

  it("401 bez sesji", async () => {
    auth.mockResolvedValue(null);
    expect((await post(valid)).status).toBe(401);
  });

  it("400 przy nieprawidłowych danych", async () => {
    expect((await post({ ...valid, subject: "a" })).status).toBe(400);
  });

  it("zapisuje zgłoszenie z terminem +14 dni i wysyła potwierdzenie", async () => {
    const res = await post(valid);
    expect(res.status).toBe(200);
    const row = (await client.execute(`SELECT * FROM support_requests`)).rows[0]!;
    expect(row.status).toBe("new");
    expect(row.contact_email).toBe("u1@example.com");
    const days = (Number(row.due_at) - Number(row.created_at)) / 86_400_000;
    expect(Math.round(days)).toBe(14);
    expect(sendSupportReceivedEmail).toHaveBeenCalledTimes(1);
  });

  it("obce zamówienie jest ignorowane", async () => {
    await post({ ...valid, orderId: "cudze-zamowienie" });
    const row = (await client.execute(`SELECT order_id FROM support_requests`)).rows[0]!;
    expect(row.order_id).toBeNull();
  });

  it("błąd e-maila nie psuje zgłoszenia", async () => {
    sendSupportReceivedEmail.mockRejectedValueOnce(new Error("smtp"));
    const res = await post(valid);
    expect(res.status).toBe(200);
  });
});
