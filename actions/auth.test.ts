import type { Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import { countRows, createMemoryDb } from "@/db/test-memory-db";

const state = vi.hoisted(() => ({
  db: null as unknown as Database,
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

const { registerUser } = await import("@/actions/auth");

function form(email: string) {
  return {
    firstName: "Jan",
    lastName: "Kowalski",
    email,
    password: "bardzo-tajne-haslo",
    confirmPassword: "bardzo-tajne-haslo",
    weightKg: 80,
    heightCm: 180,
    age: 30,
    activityLevel: "medium",
    weeklySessionsTarget: 3,
    role: "zawodnik",
  };
}

describe("actions/auth", () => {
  let client: Client;

  beforeAll(async () => {
    const mem = await createMemoryDb();
    client = mem.client;
    state.db = mem.db;
    vi.stubEnv("AUTH_SECRET", "test-secret");
  });

  afterAll(() => {
    client.close();
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    for (const t of ["users", "user_settings", "admin_audit_log", "site_activity_log", "user_consents"]) {
      await client.execute(`DELETE FROM ${t}`);
    }
  });

  const count = (table: string, where?: string) => countRows(client, table, where);

  it("tworzy konto od razu aktywne, z niepotwierdzonym adresem i bez maila", async () => {
    expect(await registerUser(form("Test@Example.com"))).toEqual({ ok: true });
    const rs = await client.execute(
      `SELECT email, first_name, weight_kg, email_verified_at FROM users`,
    );
    expect(rs.rows).toHaveLength(1);
    expect(rs.rows[0]!.email).toBe("test@example.com");
    expect(rs.rows[0]!.email_verified_at).toBeNull();
    const audit = await client.execute(`SELECT action, meta_json FROM admin_audit_log`);
    expect(audit.rows[0]!.action).toBe("security.register");
    expect(String(audit.rows[0]!.meta_json)).toContain("instant");
    expect(String(audit.rows[0]!.meta_json)).not.toContain("@");
  });

  it("odrzuca różne hasła i nie tworzy konta", async () => {
    const result = await registerUser({ ...form("a@example.com"), confirmPassword: "inne-haslo-123" });
    expect(result).toMatchObject({ ok: false, code: "invalid_form" });
    expect(result.ok === false && result.fieldErrors?.confirmPassword?.length).toBeTruthy();
    expect(await count("users")).toBe(0);
  });

  it("rejestracja zapisuje oświadczenie 16+ i tylko zaznaczone zgody (Z11, Z13)", async () => {
    expect(await registerUser({ ...form("zgody@example.com"), healthConsent: true })).toEqual({
      ok: true,
    });
    const rs = await client.execute(
      `SELECT type, granted, source FROM user_consents ORDER BY type`,
    );
    expect(rs.rows.map((r) => String(r.type))).toEqual(["age_16", "health"]);
    expect(rs.rows.every((r) => Number(r.granted) === 1 && r.source === "registration")).toBe(true);
  });

  it("rejestracja bez zaznaczonych zgód zapisuje tylko oświadczenie wieku", async () => {
    expect(await registerUser(form("bez@example.com"))).toEqual({ ok: true });
    const rs = await client.execute(`SELECT type FROM user_consents`);
    expect(rs.rows.map((r) => String(r.type))).toEqual(["age_16"]);
  });

  it("wiek 15 jest odrzucany (min. 16) i nie tworzy konta", async () => {
    const result = await registerUser({ ...form("mlody@example.com"), age: 15 });
    expect(result).toMatchObject({ ok: false, code: "invalid_form" });
    expect(await count("users")).toBe(0);
    expect(await count("user_consents")).toBe(0);
  });

  it("istniejące konto = account_exists", async () => {
    await registerUser(form("dup@example.com"));
    expect(await registerUser(form("dup@example.com"))).toMatchObject({
      ok: false,
      code: "account_exists",
    });
    expect(await count("users")).toBe(1);
  });
});
