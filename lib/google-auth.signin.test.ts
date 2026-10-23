import type { Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { countRows, createMemoryDb } from "@/db/test-memory-db";

const state = vi.hoisted(() => ({ db: null as unknown as Database }));
vi.mock("@/db", () => ({ getDb: () => state.db }));
vi.mock("@/db/ensure-schema", () => ({ ensureCriticalSchema: async () => undefined }));

const { findUserByOAuthLink, resolveOAuthSignIn } = await import("@/lib/google-auth");

const google = {
  provider: "google" as const,
  providerAccountId: "g-1",
  email: "Jan@Example.com",
  providerEmailVerified: true,
  givenName: "Jan",
  familyName: "Kowalski",
};

describe("resolveOAuthSignIn (integracja)", () => {
  let client: Client;

  beforeAll(async () => {
    const mem = await createMemoryDb();
    client = mem.client;
    state.db = mem.db;
  });

  afterAll(() => {
    client.close();
  });

  beforeEach(async () => {
    for (const t of ["users", "user_settings", "oauth_accounts", "admin_audit_log", "site_activity_log"]) {
      await client.execute(`DELETE FROM ${t}`);
    }
  });

  async function addUser(id: string, email: string, verified: boolean) {
    await state.db.insert(schema.users).values({
      id,
      email,
      passwordHash: "x",
      emailVerifiedAt: verified ? new Date() : null,
    });
  }

  it("Google z potwierdzonym adresem tworzy konto zweryfikowane z powiązaniem", async () => {
    expect(await resolveOAuthSignIn(google)).toEqual({ kind: "create", emailVerified: true });
    const linked = await findUserByOAuthLink("google", "g-1");
    expect(linked).toMatchObject({ email: "jan@example.com", emailVerified: true, sessionVersion: 0 });
    expect(await count("user_settings")).toBe(1);
    const audit = await client.execute(`SELECT action, meta_json FROM admin_audit_log`);
    expect(audit.rows[0]!.action).toBe("security.oauth_register");
    expect(String(audit.rows[0]!.meta_json)).not.toContain("@");
  });

  it("konto zweryfikowane: powiązanie bez e-maila w dzienniku aktywności", async () => {
    await addUser("u1", "jan@example.com", true);
    expect(await resolveOAuthSignIn(google)).toEqual({ kind: "link_existing", userId: "u1" });
    expect((await findUserByOAuthLink("google", "g-1"))?.id).toBe("u1");
    const activity = await client.execute(`SELECT meta_json FROM site_activity_log`);
    expect(String(activity.rows[0]!.meta_json)).not.toContain("@");
  });

  it("istniejące powiązanie nie jest przenoszone na konto o innym e-mailu", async () => {
    await addUser("owner", "owner@example.com", true);
    await addUser("other", "jan@example.com", true);
    await state.db
      .insert(schema.oauthAccounts)
      .values({ userId: "owner", provider: "google", providerAccountId: "g-1" });
    expect(await resolveOAuthSignIn(google)).toEqual({ kind: "login_linked", userId: "owner" });
    expect(await count("oauth_accounts", `user_id = 'other'`)).toBe(0);
  });

  it("Facebook przy istniejącym koncie: odmowa i zdarzenie bez e-maila", async () => {
    await addUser("u1", "jan@example.com", false);
    expect(
      await resolveOAuthSignIn({ ...google, provider: "facebook", providerAccountId: "fb-1" }),
    ).toEqual({ kind: "reject", code: "OAuthLinkRefused" });
    expect(await count("oauth_accounts")).toBe(0);
    const audit = await client.execute(`SELECT action, target_user_id, meta_json FROM admin_audit_log`);
    expect(audit.rows[0]!.action).toBe("security.oauth_link_rejected");
    expect(audit.rows[0]!.target_user_id).toBe("u1");
    expect(String(audit.rows[0]!.meta_json)).toContain("OAuthLinkRefused");
  });

  it("Google bez potwierdzenia i bez konta: odmowa bez wpisu w dzienniku", async () => {
    expect(await resolveOAuthSignIn({ ...google, providerEmailVerified: false })).toEqual({
      kind: "reject",
      code: "OAuthEmailUnverified",
    });
    expect(await count("users")).toBe(0);
    expect(await count("admin_audit_log")).toBe(0);
  });

  it("konto niezweryfikowane = takeover_confirm bez zmian w bazie", async () => {
    await addUser("u1", "jan@example.com", false);
    expect(await resolveOAuthSignIn(google)).toEqual({ kind: "takeover_confirm", userId: "u1" });
    expect(await count("oauth_accounts")).toBe(0);
  });

  const count = (table: string, where?: string) => countRows(client, table, where);
});
