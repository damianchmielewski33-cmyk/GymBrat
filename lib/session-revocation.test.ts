import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unieważnianie sesji (ADR 0001 D5) w obu miejscach użycia: callback `jwt` (auth.ts) i `proxy.ts`.
 * Prawdziwy `getAccountAuthState` (cache 60 s) z zamockowaną bazą.
 */

const rows: Array<Record<string, unknown>> = [];
let dbError: Error | null = null;
const limit = vi.fn(async () => {
  if (dbError) throw dbError;
  return rows;
});
const select = vi.fn(() => ({ from: () => ({ where: () => ({ limit }) }) }));
const logAuthFailure = vi.fn();
const getToken = vi.fn();
let captured: { callbacks: { jwt: (args: Record<string, unknown>) => Promise<unknown> } };

vi.mock("@/db", () => ({ getDb: () => ({ select }) }));
vi.mock("@/lib/security-events", () => ({ logAuthFailure }));
vi.mock("next-auth", () => ({
  default: (cfg: typeof captured) => {
    captured = cfg;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
  CredentialsSignin: class {},
}));
vi.mock("next-auth/providers/credentials", () => ({ default: () => ({}) }));
vi.mock("next-auth/providers/facebook", () => ({ default: () => ({}) }));
vi.mock("next-auth/providers/google", () => ({ default: () => ({}) }));
vi.mock("next-auth/jwt", () => ({ getToken }));
vi.mock("@/lib/analytics-deployment", () => ({ getAnalyticsDeployment: () => ({}) }));
vi.mock("@/lib/admin-session", () => ({ syncAdminRoleOnLogin: vi.fn() }));
vi.mock("@/lib/google-auth", () => ({
  findUserByOAuthLink: vi.fn(),
  isFacebookAuthConfigured: () => false,
  isGoogleAuthConfigured: () => false,
  resolveOAuthSignIn: vi.fn(),
}));
vi.mock("@/lib/account-takeover", () => ({ signTakeoverToken: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitAsync: vi.fn(),
  clientIpFromHeaders: () => "ip",
  RATE: { loginIp: {}, loginEmail: {} },
}));
vi.mock("@/lib/auth-secret", () => ({ getAuthSecret: () => "secret" }));

const { invalidateAccountAuthState, ACCOUNT_AUTH_STATE_TTL_MS } = await import(
  "@/lib/account-auth-state"
);
await import("@/auth");
const { proxy } = await import("@/proxy");
const { NextRequest } = await import("next/server");

function setAccount(over: Record<string, unknown> = {}) {
  rows.length = 0;
  rows.push({
    email: "a@x.pl",
    appRole: "zawodnik",
    emailVerifiedAt: new Date(),
    sessionVersion: 2,
    ...over,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  select.mockClear();
  limit.mockClear();
  logAuthFailure.mockClear();
  getToken.mockReset();
  dbError = null;
  setAccount();
  invalidateAccountAuthState("u1");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("callback jwt (odświeżenie sesji)", () => {
  const run = (token: Record<string, unknown>) =>
    captured.callbacks.jwt({ token: { profileComplete: true, ...token } });

  it("zgodny session_version: sesja przechodzi, rola z bazy", async () => {
    const out = (await run({ id: "u1", sv: 2 })) as Record<string, unknown>;
    expect(out).toMatchObject({ id: "u1", email: "a@x.pl", role: "zawodnik" });
  });

  it("niższy session_version lub brak sv: sesja unieważniona (null)", async () => {
    expect(await run({ id: "u1", sv: 1 })).toBeNull();
    expect(await run({ id: "u1" })).toBeNull();
  });

  it("usunięte konto: sesja unieważniona", async () => {
    rows.length = 0;
    expect(await run({ id: "u1", sv: 0 })).toBeNull();
  });

  it("rola przez resolveEffectiveRole (admin z bazy, trener)", async () => {
    setAccount({ appRole: "admin" });
    expect(((await run({ id: "u1", sv: 2 })) as { role: string }).role).toBe("admin");
    invalidateAccountAuthState("u1");
    setAccount({ appRole: "trener" });
    expect(((await run({ id: "u1", sv: 2 })) as { role: string }).role).toBe("trener");
  });

  it("cache 60 s: jedno zapytanie w oknie, ponowne po wygaśnięciu", async () => {
    await run({ id: "u1", sv: 2 });
    await run({ id: "u1", sv: 2 });
    expect(select).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(ACCOUNT_AUTH_STATE_TTL_MS + 1);
    await run({ id: "u1", sv: 2 });
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("fail-open przy błędzie bazy: token zachowany, logAuthFailure z throttle", async () => {
    dbError = new Error("db down");
    const out = (await run({ id: "u1", sv: 2, role: "trener" })) as Record<string, unknown>;
    expect(out).toMatchObject({ id: "u1", role: "trener" });
    expect(logAuthFailure).toHaveBeenCalledWith("auth.jwt.sessionState", dbError, {
      throttle: true,
    });
  });
});

describe("proxy (isSessionRevoked i ścieżki publiczne)", () => {
  const req = (path: string) => new NextRequest(`https://gymbrat.test${path}`);

  it("zgodny session_version: żądanie przechodzi", async () => {
    getToken.mockResolvedValue({ id: "u1", sv: 2, profileComplete: true });
    const res = await proxy(req("/treningi"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("niższy sv: przekierowanie na /login?session=expired", async () => {
    getToken.mockResolvedValue({ id: "u1", sv: 1, profileComplete: true });
    const res = await proxy(req("/treningi"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?session=expired");
  });

  it("niższy sv na /api/: 401 zamiast przekierowania", async () => {
    getToken.mockResolvedValue({ id: "u1", sv: 1 });
    const res = await proxy(req("/api/workouts"));
    expect(res.status).toBe(401);
  });

  it("niższy sv na /login?session=expired: bez pętli przekierowań", async () => {
    getToken.mockResolvedValue({ id: "u1", sv: 1 });
    const res = await proxy(req("/login?session=expired"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("cache 60 s w proxy: jedno zapytanie dla kolejnych żądań", async () => {
    getToken.mockResolvedValue({ id: "u1", sv: 2, profileComplete: true });
    await proxy(req("/treningi"));
    await proxy(req("/treningi"));
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("fail-open przy błędzie bazy: żądanie przechodzi, log z throttle", async () => {
    dbError = new Error("db down");
    getToken.mockResolvedValue({ id: "u1", sv: 1, profileComplete: true });
    const res = await proxy(req("/treningi"));
    expect(res.status).toBe(200);
    expect(logAuthFailure).toHaveBeenCalledWith("proxy.sessionState", dbError, {
      throttle: true,
    });
  });

  it("ścieżki publiczne bez tokena nie dotykają bazy", async () => {
    getToken.mockResolvedValue(null);
    for (const p of ["/login", "/api/version", "/api/csrf", "/api/cron/x", "/api/analytics/a"]) {
      const res = await proxy(req(p));
      expect(res.status).toBe(200);
    }
    expect(select).not.toHaveBeenCalled();
  });

  it("chroniona ścieżka bez tokena: /login z callbackUrl, API 401", async () => {
    getToken.mockResolvedValue(null);
    const page = await proxy(req("/treningi"));
    expect(page.headers.get("location")).toContain("/login?callbackUrl=%2Ftreningi");
    expect((await proxy(req("/api/workouts"))).status).toBe(401);
  });
});
