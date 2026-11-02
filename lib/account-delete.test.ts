import type { Client } from "@libsql/client";
import { hash } from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";
import { deleteUserAccount, isFreshLogin, REAUTH_WINDOW_MS, verifyDeleteReauth } from "@/lib/account-delete";

describe("ponowne uwierzytelnienie przy usuwaniu konta (Z14)", () => {
  const now = 1_800_000_000_000;
  let passwordHash: string;
  beforeAll(async () => {
    passwordHash = await hash("tajne-haslo", 4);
  });

  it("świeże logowanie: tylko w oknie czasowym", () => {
    expect(isFreshLogin(now - 1000, now)).toBe(true);
    expect(isFreshLogin(now - REAUTH_WINDOW_MS - 1, now)).toBe(false);
    expect(isFreshLogin(undefined, now)).toBe(false);
    expect(isFreshLogin(now + 60_000, now)).toBe(false);
  });

  it("poprawne hasło przechodzi, błędne nie (nawet przy świeżej sesji)", async () => {
    expect(await verifyDeleteReauth({ password: "tajne-haslo", passwordHash, authAt: undefined, now })).toEqual({ ok: true, method: "password" });
    expect(await verifyDeleteReauth({ password: "zle", passwordHash, authAt: now, now })).toEqual({ ok: false, reason: "password_invalid" });
  });

  it("bez hasła: świeża sesja przechodzi, stara wymaga ponownego logowania", async () => {
    expect(await verifyDeleteReauth({ password: undefined, passwordHash, authAt: now - 1000, now })).toEqual({ ok: true, method: "fresh_login" });
    expect(await verifyDeleteReauth({ password: undefined, passwordHash, authAt: now - 3_600_000, now })).toEqual({ ok: false, reason: "reauth_required" });
    expect(await verifyDeleteReauth({ password: undefined, passwordHash, authAt: undefined, now })).toEqual({ ok: false, reason: "reauth_required" });
  });
});

describe("deleteUserAccount (integracja, klucze obce wyłączone)", () => {
  let client: Client;
  let db: Database;
  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
    await db.insert(schema.users).values([
      { id: "gone", email: "gone@example.com", passwordHash: "x" },
      { id: "stay", email: "stay@example.com", passwordHash: "x" },
    ]);
    await db.insert(schema.oauthAccounts).values([
      { userId: "gone", provider: "google", providerAccountId: "g1" },
      { userId: "stay", provider: "google", providerAccountId: "g2" },
    ]);
    await db.insert(schema.subscriptionOrders).values([
      { id: "o1", userId: "gone", planSku: "m1", days: 30, amountGrosze: 1999, status: "paid" },
    ]);
  });
  afterAll(() => client.close());

  it("usuwa konto i dane zależne, zamówienie zostaje odpięte, inne konto bez zmian", async () => {
    await deleteUserAccount(db, "gone");
    const q = async (sql: string) => Number((await client.execute(sql)).rows[0]!.n);
    expect(await q(`SELECT count(*) AS n FROM users WHERE id='gone'`)).toBe(0);
    expect(await q(`SELECT count(*) AS n FROM oauth_accounts WHERE user_id='gone'`)).toBe(0);
    expect(await q(`SELECT count(*) AS n FROM subscription_orders WHERE id='o1' AND user_id IS NULL`)).toBe(1);
    expect(await q(`SELECT count(*) AS n FROM users WHERE id='stay'`)).toBe(1);
    expect(await q(`SELECT count(*) AS n FROM oauth_accounts WHERE user_id='stay'`)).toBe(1);
  });
});
