import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rows: Array<Record<string, unknown>> = [];
const select = vi.fn(() => ({
  from: () => ({ where: () => ({ limit: async () => rows }) }),
}));

vi.mock("@/db", () => ({ getDb: () => ({ select }) }));

const {
  ACCOUNT_AUTH_STATE_TTL_MS,
  getAccountAuthState,
  invalidateAccountAuthState,
  isTokenRevoked,
} = await import("@/lib/account-auth-state");

const LIVE = {
  exists: true,
  email: "a@x.pl",
  appRole: "zawodnik",
  emailVerified: true,
  sessionVersion: 2,
};

describe("isTokenRevoked", () => {
  it("brak konta = unieważniony", () => {
    expect(isTokenRevoked({ id: "u1", sv: 0 }, { ...LIVE, exists: false })).toBe(true);
  });

  it("różna wersja sesji = unieważniony, ta sama = ważny", () => {
    expect(isTokenRevoked({ id: "u1", sv: 1 }, LIVE)).toBe(true);
    expect(isTokenRevoked({ id: "u1", sv: 2 }, LIVE)).toBe(false);
  });

  it("stary token bez sv liczy się jako 0", () => {
    expect(isTokenRevoked({ id: "u1" }, { ...LIVE, sessionVersion: 0 })).toBe(false);
    expect(isTokenRevoked({ id: "u1" }, LIVE)).toBe(true);
    expect(isTokenRevoked({ id: "u1", sv: "2" }, LIVE)).toBe(true);
  });

  it("token bez id = unieważniony", () => {
    expect(isTokenRevoked({ sv: 2 }, LIVE)).toBe(true);
  });
});

describe("getAccountAuthState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    select.mockClear();
    rows.length = 0;
    rows.push({
      email: "a@x.pl",
      appRole: "admin",
      emailVerifiedAt: new Date(),
      sessionVersion: 3,
    });
    invalidateAccountAuthState("u1");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("czyta bazę raz w oknie TTL i ponownie po nim", async () => {
    const first = await getAccountAuthState("u1");
    expect(first).toEqual({
      exists: true,
      email: "a@x.pl",
      appRole: "admin",
      emailVerified: true,
      sessionVersion: 3,
    });
    await getAccountAuthState("u1");
    expect(select).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(ACCOUNT_AUTH_STATE_TTL_MS + 1);
    await getAccountAuthState("u1");
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("invalidateAccountAuthState wymusza odczyt od razu", async () => {
    await getAccountAuthState("u1");
    rows[0] = { ...rows[0], sessionVersion: 4 };
    invalidateAccountAuthState("u1");
    expect((await getAccountAuthState("u1")).sessionVersion).toBe(4);
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("brak wiersza = exists false", async () => {
    rows.length = 0;
    const state = await getAccountAuthState("u1");
    expect(state.exists).toBe(false);
    expect(state.emailVerified).toBe(false);
  });
});
