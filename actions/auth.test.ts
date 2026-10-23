import type { Client } from "@libsql/client";
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
  sendRegisterVerificationCodeEmail: state.sendMail,
}));

const { registerUser, sendRegisterCode } = await import("@/actions/auth");

const SMTP = { SMTP_HOST: "smtp.example.com", SMTP_USER: "u", SMTP_PASS: "p" };

function form(email: string, emailCode: string) {
  return {
    firstName: "Jan",
    lastName: "Kowalski",
    email,
    emailCode,
    password: "bardzo-tajne-haslo",
    weightKg: 80,
    heightCm: 180,
    age: 30,
    activityLevel: "medium",
    weeklySessionsTarget: 3,
    role: "zawodnik",
  };
}

function setEnv(vars: Record<string, string>) {
  vi.unstubAllEnvs();
  vi.stubEnv("AUTH_SECRET", "test-secret");
  for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "RENDER", "VERCEL"]) {
    vi.stubEnv(key, "");
  }
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
}

describe("actions/auth", () => {
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
  });

  const count = (table: string, where?: string) => countRows(client, table, where);

  it("produkcja bez SMTP: registration_disabled bez żadnego zapisu", async () => {
    setEnv({ NODE_ENV: "production" });
    expect(await sendRegisterCode({ email: "a@example.com" })).toMatchObject({
      ok: false,
      code: "registration_disabled",
    });
    expect(await registerUser(form("a@example.com", "123456"))).toMatchObject({
      ok: false,
      code: "registration_disabled",
    });
    expect(await count("email_verification_codes")).toBe(0);
    expect(await count("users")).toBe(0);
  });

  it("tryb testowy przechodzi przez tabelę kodów i tworzy konto niezweryfikowane", async () => {
    setEnv({ NODE_ENV: "test" });
    expect(await sendRegisterCode({ email: "Test@Example.com" })).toEqual({ ok: true, mode: "test" });
    expect(state.sendMail).not.toHaveBeenCalled();
    expect(await count("email_verification_codes", `email = 'test@example.com'`)).toBe(1);

    expect(await registerUser(form("test@example.com", "123456"))).toEqual({ ok: true });
    const rs = await client.execute(`SELECT email_verified_at FROM users WHERE email = 'test@example.com'`);
    expect(rs.rows[0]!.email_verified_at).toBeNull();
    // LR-20: kod usunięty w tym samym batchu co utworzenie konta.
    expect(await count("email_verification_codes")).toBe(0);
    const audit = await client.execute(`SELECT action, meta_json FROM admin_audit_log`);
    expect(audit.rows[0]!.action).toBe("security.register");
    expect(String(audit.rows[0]!.meta_json)).toContain("test_mode");
    expect(String(audit.rows[0]!.meta_json)).not.toContain("@");
  });

  it("z SMTP kod 123456 jest odrzucany, a prawdziwy kod tworzy konto zweryfikowane", async () => {
    setEnv({ NODE_ENV: "production", ...SMTP });
    expect(await sendRegisterCode({ email: "real@example.com" })).toEqual({ ok: true, mode: "smtp" });
    const sent = state.sendMail.mock.calls[0]![0];

    const wrong = sent.code === "123456" ? "654321" : "123456";
    expect(await registerUser(form("real@example.com", wrong))).toMatchObject({
      ok: false,
      code: "code_invalid",
      attemptsLeft: 4,
    });

    expect(await registerUser(form("real@example.com", sent.code))).toEqual({ ok: true });
    const rs = await client.execute(`SELECT email_verified_at FROM users WHERE email = 'real@example.com'`);
    expect(rs.rows[0]!.email_verified_at).not.toBeNull();
  });

  it("kod 4-cyfrowy (1234) odrzuca już schemat", async () => {
    setEnv({ NODE_ENV: "test" });
    await sendRegisterCode({ email: "four@example.com" });
    const result = await registerUser(form("four@example.com", "1234"));
    expect(result).toMatchObject({ ok: false, code: "invalid_form" });
    expect(result.ok === false && result.fieldErrors?.emailCode?.length).toBeTruthy();
  });

  it("send_failed usuwa wiersz kodu, więc ponowienie nie czeka 60 s", async () => {
    setEnv({ NODE_ENV: "production", ...SMTP });
    state.sendMail.mockRejectedValueOnce(new Error("SMTP down for fail@example.com"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await sendRegisterCode({ email: "fail@example.com" })).toMatchObject({
      ok: false,
      code: "send_failed",
    });
    expect(await count("email_verification_codes")).toBe(0);
    expect(errors.mock.calls.flat().join(" ")).not.toContain("fail@example.com");
    errors.mockRestore();

    expect(await sendRegisterCode({ email: "fail@example.com" })).toEqual({ ok: true, mode: "smtp" });
  });

  it("ponowna wysyłka w ciągu 60 s = code_resend_too_soon", async () => {
    setEnv({ NODE_ENV: "test" });
    await sendRegisterCode({ email: "again@example.com" });
    expect(await sendRegisterCode({ email: "again@example.com" })).toMatchObject({
      ok: false,
      code: "code_resend_too_soon",
    });
  });

  it("brak kodu = code_missing; istniejące konto = account_exists", async () => {
    setEnv({ NODE_ENV: "test" });
    expect(await registerUser(form("none@example.com", "123456"))).toMatchObject({
      ok: false,
      code: "code_missing",
    });
    await sendRegisterCode({ email: "dup@example.com" });
    await registerUser(form("dup@example.com", "123456"));
    expect(await sendRegisterCode({ email: "dup@example.com" })).toMatchObject({
      ok: false,
      code: "account_exists",
    });
  });

  it("stare kody (ponad 24 h) są sprzątane przy wysyłce", async () => {
    setEnv({ NODE_ENV: "test" });
    const old = Date.now() - 25 * 60 * 60_000;
    await client.execute({
      sql: `INSERT INTO email_verification_codes (id, email, purpose, code_hash, expires_at, created_at, send_count, attempt_count, last_sent_at)
            VALUES ('old', 'old@example.com', 'register', 'x', ?, ?, 1, 0, ?)`,
      args: [old, old, old],
    });
    await sendRegisterCode({ email: "new@example.com" });
    expect(await count("email_verification_codes", `id = 'old'`)).toBe(0);
  });
});
