import type { Client } from "@libsql/client";
import { compare } from "bcryptjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import { countRows, createMemoryDb } from "@/db/test-memory-db";

const state = vi.hoisted(() => ({
  db: null as unknown as Database,
  sendMail: vi.fn<(p: { to: string; code: string }) => Promise<void>>(),
}));

vi.mock("@/db", () => ({ getDb: () => state.db }));
vi.mock("@/lib/action-guard", () => ({
  guardAction: vi.fn(async () => undefined),
  currentClientIp: vi.fn(async () => "127.0.0.1"),
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimitAsync: vi.fn(async () => ({ ok: true, remaining: 1, retryAfterSec: 0 })),
}));
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendPasswordResetCodeEmail: state.sendMail,
}));

const { requestPasswordReset, resetPassword } = await import("@/actions/password-reset");
const { registerUser, sendRegisterCode } = await import("@/actions/auth");

const SMTP = { SMTP_HOST: "smtp.example.com", SMTP_USER: "u", SMTP_PASS: "p" };
const EMAIL = "jan@example.com";

function setEnv(vars: Record<string, string>) {
  vi.unstubAllEnvs();
  vi.stubEnv("AUTH_SECRET", "test-secret");
  for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "RENDER", "VERCEL"]) {
    vi.stubEnv(key, "");
  }
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
}

/** Konto zakładane w trybie testowym (kod 123456), potem env przełączany wg potrzeb testu. */
async function seedUser() {
  setEnv({});
  await sendRegisterCode({ email: EMAIL });
  const res = await registerUser({
    firstName: "Jan",
    lastName: "Kowalski",
    email: EMAIL,
    emailCode: "123456",
    password: "stare-haslo-123",
    weightKg: 80,
    heightCm: 180,
    age: 30,
    activityLevel: "medium",
    weeklySessionsTarget: 3,
    role: "zawodnik",
  });
  expect(res.ok).toBe(true);
}

describe("actions/password-reset", () => {
  let client: Client;

  beforeAll(async () => {
    const mem = await createMemoryDb();
    client = mem.client;
    state.db = mem.db;
  });

  afterAll(() => {
    client.close();
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    for (const t of ["users", "user_settings", "email_verification_codes", "admin_audit_log", "site_activity_log"]) {
      await client.execute(`DELETE FROM ${t}`);
    }
    state.sendMail.mockReset();
    state.sendMail.mockResolvedValue(undefined);
    await seedUser();
  });

  it("zmienia hasło, unieważnia sesje i zużywa kod", async () => {
    setEnv({});
    expect(await requestPasswordReset({ email: EMAIL })).toEqual({ ok: true, mode: "test" });
    const res = await resetPassword({ email: EMAIL, code: "123456", password: "nowe-haslo-456" });
    expect(res).toEqual({ ok: true });

    const rs = await client.execute(`SELECT password_hash, session_version FROM users`);
    expect(await compare("nowe-haslo-456", String(rs.rows[0]!.password_hash))).toBe(true);
    expect(Number(rs.rows[0]!.session_version)).toBe(1);
    expect(await countRows(client, "email_verification_codes")).toBe(0);

    const again = await resetPassword({ email: EMAIL, code: "123456", password: "jeszcze-inne-1" });
    expect(again.ok).toBe(false);
  });

  it("nieistniejący adres: ta sama odpowiedź, brak kodu i wiadomości", async () => {
    setEnv(SMTP);
    const res = await requestPasswordReset({ email: "nikt@example.com" });
    expect(res).toEqual({ ok: true, mode: "smtp" });
    expect(state.sendMail).not.toHaveBeenCalled();
    expect(await countRows(client, "email_verification_codes")).toBe(0);
  });

  it("istniejący adres: wysyła kod e-mailem (SMTP)", async () => {
    setEnv(SMTP);
    await requestPasswordReset({ email: EMAIL });
    expect(state.sendMail).toHaveBeenCalledTimes(1);
    expect(state.sendMail.mock.calls[0]![0].to).toBe(EMAIL);
  });

  it("błędny kod nie zmienia hasła, po 5 próbach kod wygasa", async () => {
    setEnv({});
    await requestPasswordReset({ email: EMAIL });
    for (let i = 0; i < 4; i++) {
      const res = await resetPassword({ email: EMAIL, code: "000000", password: "nowe-haslo-456" });
      expect(res.ok === false && res.code).toBe("code_invalid");
    }
    const last = await resetPassword({ email: EMAIL, code: "000000", password: "nowe-haslo-456" });
    expect(last.ok === false && last.code).toBe("code_expired");
    const good = await resetPassword({ email: EMAIL, code: "123456", password: "nowe-haslo-456" });
    expect(good.ok).toBe(false);

    const rs = await client.execute(`SELECT password_hash FROM users`);
    expect(await compare("stare-haslo-123", String(rs.rows[0]!.password_hash))).toBe(true);
  });

  it("kod rejestracji nie działa przy resecie", async () => {
    setEnv({});
    await sendRegisterCode({ email: "inny@example.com" });
    const res = await resetPassword({ email: "inny@example.com", code: "123456", password: "nowe-haslo-456" });
    expect(res.ok === false && res.code).toBe("code_expired");
  });

  it("za krótkie hasło: invalid_form z błędem pola", async () => {
    setEnv({});
    const res = await resetPassword({ email: EMAIL, code: "123456", password: "krotkie" });
    expect(res.ok === false && res.code).toBe("invalid_form");
    expect(res.ok === false && res.fieldErrors?.password?.[0]).toBe("Użyj minimum 8 znaków");
  });

  it("bez SMTP na hostingu reset jest niedostępny", async () => {
    setEnv({ RENDER: "1" });
    const res = await requestPasswordReset({ email: EMAIL });
    expect(res.ok === false && res.code).toBe("reset_unavailable");
  });
});
