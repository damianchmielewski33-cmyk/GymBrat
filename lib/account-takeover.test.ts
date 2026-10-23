import type { Client } from "@libsql/client";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { countRows, createMemoryDb } from "@/db/test-memory-db";
import {
  buildTakeoverStatements,
  signTakeoverToken,
  TAKEOVER_TOKEN_TTL_MS,
  verifyTakeoverToken,
} from "@/lib/account-takeover";

vi.stubEnv("AUTH_SECRET", "test-secret-for-takeover");

describe("token przejęcia", () => {
  it("poprawny token zwraca ładunek", () => {
    const now = 1_800_000_000_000;
    const token = signTakeoverToken({ uid: "u1", pid: "g1" }, now);
    expect(verifyTakeoverToken(token, now + 1000)).toEqual({
      uid: "u1",
      pid: "g1",
      exp: now + TAKEOVER_TOKEN_TTL_MS,
    });
  });

  it("wygasły token = null", () => {
    const now = 1_800_000_000_000;
    const token = signTakeoverToken({ uid: "u1", pid: "g1" }, now);
    expect(verifyTakeoverToken(token, now + TAKEOVER_TOKEN_TTL_MS)).toBeNull();
  });

  it("zmieniony ładunek albo podpis = null", () => {
    const now = 1_800_000_000_000;
    const token = signTakeoverToken({ uid: "u1", pid: "g1" }, now);
    const [, sig] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ uid: "u2", pid: "g1", exp: now + TAKEOVER_TOKEN_TTL_MS }),
    ).toString("base64url");
    expect(verifyTakeoverToken(`${forged}.${sig}`, now)).toBeNull();
    expect(verifyTakeoverToken(`${token}x`, now)).toBeNull();
    expect(verifyTakeoverToken("", now)).toBeNull();
    expect(verifyTakeoverToken("a.b.c", now)).toBeNull();
  });

  it("inny sekret = null", () => {
    const now = 1_800_000_000_000;
    const token = signTakeoverToken({ uid: "u1", pid: "g1" }, now);
    vi.stubEnv("AUTH_SECRET", "other-secret");
    expect(verifyTakeoverToken(token, now)).toBeNull();
    vi.stubEnv("AUTH_SECRET", "test-secret-for-takeover");
  });
});

describe("buildTakeoverStatements (integracja)", () => {
  let client: Client;
  let db: Database;
  const uid = "u-unverified";

  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
  });

  afterAll(() => {
    client.close();
  });

  beforeEach(async () => {
    await client.execute(`DELETE FROM users`);
    await client.execute(`DELETE FROM user_settings`);
    await client.execute(`DELETE FROM weight_logs`);
    await client.execute(`DELETE FROM oauth_accounts`);
    await client.execute(`DELETE FROM admin_audit_log`);
    await db.insert(schema.users).values({
      id: uid,
      email: "victim@example.com",
      passwordHash: "old-hash",
      name: "Stary",
      weightKg: 90,
      appRole: "trener",
      sessionVersion: 0,
    });
    await db.insert(schema.userSettings).values({ userId: uid, weeklyCardioGoalMinutes: 300 });
    await db.insert(schema.weightLogs).values({ userId: uid, weightKg: 90 });
  });

  const count = (table: string, where?: string) => countRows(client, table, where);

  function statements(now: Date) {
    return buildTakeoverStatements(db, {
      userId: uid,
      providerAccountId: "google-sub",
      passwordHash: "new-hash",
      now,
    });
  }

  it("przejmuje konto: reset pól, purge, nowe ustawienia, powiązanie i zdarzenie", async () => {
    const [first, ...rest] = statements(new Date(1_800_000_000_000));
    const [reset] = await db.batch([first, ...rest]);
    expect(reset.rowsAffected).toBe(1);

    const rs = await client.execute(`SELECT * FROM users WHERE id = '${uid}'`);
    const row = rs.rows[0]!;
    expect(row.password_hash).toBe("new-hash");
    expect(row.session_version).toBe(1);
    expect(row.app_role).toBe("zawodnik");
    expect(row.name).toBeNull();
    expect(row.weight_kg).toBeNull();
    expect(row.email_verified_at).toBe(1_800_000_000_000);

    expect(await count("weight_logs")).toBe(0);
    expect(await count("user_settings", `user_id = '${uid}' AND weekly_cardio_goal_minutes = 150`)).toBe(1);
    expect(await count("oauth_accounts", `user_id = '${uid}' AND provider_account_id = 'google-sub'`)).toBe(1);
    const audit = await client.execute(`SELECT action, meta_json FROM admin_audit_log`);
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]!.action).toBe("security.account_takeover");
    expect(String(audit.rows[0]!.meta_json)).not.toContain("@");
  });

  it("drugie wywołanie nic nie zmienia", async () => {
    const [a, ...ra] = statements(new Date(1_800_000_000_000));
    await db.batch([a, ...ra]);
    await db.insert(schema.weightLogs).values({ userId: uid, weightKg: 70 });

    const [b, ...rb] = statements(new Date(1_800_000_000_500));
    const [reset] = await db.batch([b, ...rb]);
    expect(reset.rowsAffected).toBe(0);
    expect(await count("weight_logs")).toBe(1);
    expect(await count("admin_audit_log")).toBe(1);
    const rs = await client.execute(`SELECT session_version FROM users WHERE id = '${uid}'`);
    expect(rs.rows[0]!.session_version).toBe(1);
  });

  it("admin bez weryfikacji nie jest przejmowany", async () => {
    await client.execute(`UPDATE users SET app_role = 'admin' WHERE id = '${uid}'`);
    const [first, ...rest] = statements(new Date(1_800_000_000_000));
    const [reset] = await db.batch([first, ...rest]);
    expect(reset.rowsAffected).toBe(0);
    expect(await count("weight_logs")).toBe(1);
    expect(await count("oauth_accounts")).toBe(0);
  });

  it("błąd ostatniej instrukcji wycofuje cały batch", async () => {
    const [first, ...rest] = statements(new Date(1_800_000_000_000));
    await expect(
      db.batch([first, ...rest, db.run(sql`INSERT INTO "no_such_table" (x) VALUES (1)`)]),
    ).rejects.toThrow();

    const rs = await client.execute(`SELECT password_hash, session_version, email_verified_at FROM users`);
    expect(rs.rows[0]!.password_hash).toBe("old-hash");
    expect(rs.rows[0]!.session_version).toBe(0);
    expect(rs.rows[0]!.email_verified_at).toBeNull();
    expect(await count("weight_logs")).toBe(1);
    expect(await count("user_settings", "weekly_cardio_goal_minutes = 300")).toBe(1);
    expect(await count("oauth_accounts")).toBe(0);
    expect(await count("admin_audit_log")).toBe(0);
  });
});
