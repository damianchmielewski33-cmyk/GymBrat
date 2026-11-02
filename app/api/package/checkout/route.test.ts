import type { Client } from "@libsql/client";
import { NextResponse } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import { createMemoryDb } from "@/db/test-memory-db";

let db: Database;
const auth = vi.fn();
const assertCsrf = vi.fn((): NextResponse | null => null);
const checkRateLimitAsync = vi.fn(async () => ({ ok: true as const, retryAfterSec: 0 }));
const getSubscriptionPlanBySku = vi.fn();
let configured = true;

vi.mock("@/db", () => ({ getDb: () => db }));
vi.mock("@/db/ensure-schema", () => ({ ensureCriticalSchema: async () => undefined }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/csrf", () => ({ assertCsrf }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitAsync,
  RATE: { adminMutation: { limit: 120, windowMs: 60_000 } },
}));
vi.mock("@/lib/subscription-plans", () => ({ getSubscriptionPlanBySku }));
vi.mock("@/lib/hotpay", () => ({
  hotpayConfigured: () => configured,
  hotpayPaymentUrl: () => "https://platnosc.hotpay.pl/",
  hotpaySekret: () => "sekret-testowy",
  buildHotpayPaymentHash: () => "hash-testowy",
  formatHotpayKwota: (g: number) => (g / 100).toFixed(2),
}));

const { POST } = await import("@/app/api/package/checkout/route");

function checkout(body: unknown = { sku: "m1" }) {
  return POST(
    new Request("http://localhost/api/package/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("POST /api/package/checkout", () => {
  let client: Client;

  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
  });
  afterAll(() => {
    client.close();
  });

  beforeEach(async () => {
    configured = true;
    auth.mockReset().mockResolvedValue({ user: { id: "u1", email: "u1@example.com" } });
    assertCsrf.mockReset().mockReturnValue(null);
    checkRateLimitAsync.mockReset().mockResolvedValue({ ok: true, retryAfterSec: 0 });
    getSubscriptionPlanBySku
      .mockReset()
      .mockResolvedValue({ id: "plan1", sku: "m1", title: "30 dni", days: 30, priceGrosze: 1999, active: 1 });
    await client.execute(`DELETE FROM subscription_orders`);
  });

  async function orders() {
    return (await client.execute(`SELECT status, amount_grosze AS a, days, plan_sku AS sku FROM subscription_orders`)).rows;
  }

  it("zalogowany + aktywny plan: zamówienie pending z ceną i dniami z planu, pola formularza HotPay", async () => {
    const res = await checkout();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.fields.KWOTA).toBe("19.99");
    expect(json.fields.HASH).toBe("hash-testowy");
    expect(json.fields.ID_ZAMOWIENIA).toBeTruthy();
    const rows = await orders();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "pending", a: 1999, days: 30, sku: "m1" });
  });

  it("cena pochodzi z bazy, nie z żądania", async () => {
    const res = await checkout({ sku: "m1", priceGrosze: 1, amount: "0.01" });
    expect(res.status).toBe(200);
    expect((await orders())[0]!.a).toBe(1999);
  });

  it("brak CSRF: odpowiedź z assertCsrf, bez zamówienia i bez sprawdzania sesji", async () => {
    assertCsrf.mockReturnValue(NextResponse.json({ ok: false }, { status: 403 }));
    expect((await checkout()).status).toBe(403);
    expect(auth).not.toHaveBeenCalled();
    expect(await orders()).toHaveLength(0);
  });

  it("brak sesji: 401 bez zamówienia", async () => {
    auth.mockResolvedValue(null);
    expect((await checkout()).status).toBe(401);
    expect(await orders()).toHaveLength(0);
  });

  it("brak konfiguracji HotPay: 503 bez zamówienia", async () => {
    configured = false;
    expect((await checkout()).status).toBe(503);
    expect(await orders()).toHaveLength(0);
  });

  it("limit żądań: 429 z Retry-After", async () => {
    checkRateLimitAsync.mockResolvedValue({ ok: false as unknown as true, retryAfterSec: 7 });
    const res = await checkout();
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("7");
    expect(await orders()).toHaveLength(0);
  });

  it("nieprawidłowy JSON i brak sku: 400", async () => {
    expect((await checkout("{nie-json")).status).toBe(400);
    expect((await checkout({})).status).toBe(400);
    expect((await checkout({ sku: "" })).status).toBe(400);
    expect(await orders()).toHaveLength(0);
  });

  it("nieistniejący lub nieaktywny plan: 404 bez zamówienia", async () => {
    getSubscriptionPlanBySku.mockResolvedValue(null);
    expect((await checkout({ sku: "x" })).status).toBe(404);
    getSubscriptionPlanBySku.mockResolvedValue({
      id: "plan1", sku: "m1", title: "30 dni", days: 30, priceGrosze: 1999, active: 0,
    });
    expect((await checkout()).status).toBe(404);
    expect(await orders()).toHaveLength(0);
  });
});
