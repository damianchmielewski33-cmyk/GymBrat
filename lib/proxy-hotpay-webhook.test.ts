import { describe, expect, it, vi } from "vitest";

/**
 * Z4: anonimowy POST na webhook HotPay musi przejść przez `proxy.ts` (bez 401),
 * a zwykła trasa API bez sesji nadal dostaje 401.
 */

const getToken = vi.fn(async () => null);

vi.mock("@/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/security-events", () => ({ logAuthFailure: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken }));
vi.mock("@/lib/auth-secret", () => ({ getAuthSecret: () => "secret" }));
vi.mock("@/lib/errors/server-log", async (orig) => ({
  ...(await orig<typeof import("@/lib/errors/server-log")>()),
  logServerError: vi.fn(),
}));

const { proxy } = await import("@/proxy");
const { NextRequest } = await import("next/server");

function anonymous(pathname: string, method = "POST") {
  return proxy(new NextRequest(`http://localhost${pathname}`, { method }));
}

describe("proxy: webhook HotPay bez sesji", () => {
  it("POST /api/payments/hotpay/notify przechodzi dalej (nie 401, nie 307)", async () => {
    const res = await anonymous("/api/payments/hotpay/notify");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("zwykła trasa API bez sesji nadal daje 401", async () => {
    const res = await anonymous("/api/package/checkout");
    expect(res.status).toBe(401);
  });
});
