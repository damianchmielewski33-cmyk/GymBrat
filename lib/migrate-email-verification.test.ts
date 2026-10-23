import type { Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";
import {
  GOOGLE_SIGNUP_WINDOW_MS,
  migrateEmailVerification,
} from "@/lib/migrate-email-verification";

const CREATED = new Date(1_700_000_000_000);
const NOW = new Date(1_800_000_000_000);

describe("migrateEmailVerification", () => {
  let client: Client;
  let db: Database;

  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
  });

  afterAll(() => {
    client.close();
    vi.unstubAllEnvs();
  });

  async function addUser(id: string, opts: { appRole?: string; email?: string } = {}) {
    await db.insert(schema.users).values({
      id,
      email: opts.email ?? `${id}@example.com`,
      passwordHash: `hash-${id}`,
      appRole: opts.appRole ?? "zawodnik",
      createdAt: CREATED,
    });
  }

  async function link(userId: string, provider: string, offsetMs: number) {
    await db.insert(schema.oauthAccounts).values({
      userId,
      provider,
      providerAccountId: `${provider}-${userId}`,
      createdAt: new Date(CREATED.getTime() + offsetMs),
    });
  }

  async function user(id: string) {
    const rs = await client.execute({
      sql: `SELECT email_verified_at, password_hash, session_version FROM users WHERE id = ?`,
      args: [id],
    });
    return rs.rows[0]!;
  }

  beforeEach(async () => {
    for (const t of ["users", "oauth_accounts", "admin_audit_log"]) {
      await client.execute(`DELETE FROM ${t}`);
    }
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
    await addUser("google-signup");
    await link("google-signup", "google", 1_000);
    await addUser("linked-later");
    await link("linked-later", "google", GOOGLE_SIGNUP_WINDOW_MS + 60_000);
    await addUser("owner", { appRole: "admin", email: "owner@example.com" });
    await addUser("admin-not-listed", { appRole: "admin" });
    await addUser("password-only");
    await addUser("facebook-only");
    await link("facebook-only", "facebook", 1_000);
  });

  it("R-A: konto z Google = data powiązania", async () => {
    await migrateEmailVerification(db, NOW);
    expect((await user("google-signup")).email_verified_at).toBe(CREATED.getTime() + 1_000);
  });

  it("R-B (DW-5): Google dołączone później = teraz, bez zmiany hasła i wersji sesji, zdarzenie backfill_verified", async () => {
    const result = await migrateEmailVerification(db, NOW);
    expect(result.googleLinkedLater).toBe(1);
    const row = await user("linked-later");
    expect(row.email_verified_at).toBe(NOW.getTime());
    expect(row.password_hash).toBe("hash-linked-later");
    expect(row.session_version).toBe(0);
    const audit = await client.execute(`SELECT action, target_user_id, meta_json FROM admin_audit_log`);
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]!.action).toBe("security.backfill_verified");
    expect(audit.rows[0]!.target_user_id).toBe("linked-later");
    expect(String(audit.rows[0]!.meta_json)).not.toContain("@");
  });

  it("R-C: admin z listy ADMIN_EMAILS = teraz; admin spoza listy bez zmian", async () => {
    await migrateEmailVerification(db, NOW);
    expect((await user("owner")).email_verified_at).toBe(NOW.getTime());
    expect((await user("admin-not-listed")).email_verified_at).toBeNull();
  });

  it("konta hasłowe i tylko z Facebookiem zostają niezweryfikowane", async () => {
    await migrateEmailVerification(db, NOW);
    expect((await user("password-only")).email_verified_at).toBeNull();
    expect((await user("facebook-only")).email_verified_at).toBeNull();
  });

  it("bez ADMIN_EMAILS reguła R-C nie działa", async () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    const result = await migrateEmailVerification(db, NOW);
    expect(result.adminConfig).toBe(0);
    expect((await user("owner")).email_verified_at).toBeNull();
  });

  it("idempotencja: drugie uruchomienie nic nie zmienia", async () => {
    const first = await migrateEmailVerification(db, NOW);
    expect(first).toEqual({ googleSignup: 1, googleLinkedLater: 1, adminConfig: 1 });
    const second = await migrateEmailVerification(db, new Date(NOW.getTime() + 1_000));
    expect(second).toEqual({ googleSignup: 0, googleLinkedLater: 0, adminConfig: 0 });
    expect((await user("linked-later")).email_verified_at).toBe(NOW.getTime());
    const audit = await client.execute(`SELECT COUNT(*) AS c FROM admin_audit_log`);
    expect(Number(audit.rows[0]!.c)).toBe(1);
  });
});
