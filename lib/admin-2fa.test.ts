import type { Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";
import {
  ADMIN_2FA_LOCK_MS,
  ADMIN_2FA_MAX_ATTEMPTS,
  beginAdmin2faSetup,
  disableAdmin2fa,
  enableAdmin2fa,
  generateRecoveryCodes,
  getAdmin2faStatus,
  hashRecoveryCode,
  nextFailureState,
  regenerateRecoveryCodes,
  verifyAdmin2fa,
} from "@/lib/admin-2fa";
import { totpAt } from "@/lib/totp";

let db: Database;
let client: Client;
const NOW = 1_800_000_000_000;
const STEP = 30_000;

async function enrolled(): Promise<{ secret: string; codes: string[] }> {
  const setup = await beginAdmin2faSetup(db, { userId: "a1", account: "a@x.pl", now: NOW });
  const r = await enableAdmin2fa(db, { userId: "a1", code: totpAt(setup!.secret, NOW), now: NOW });
  if (!r.ok) throw new Error("enable failed");
  return { secret: setup!.secret, codes: r.recoveryCodes };
}

describe("admin-2fa (Z32)", () => {
  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
  });
  afterAll(() => client.close());
  beforeEach(async () => {
    await client.execute(`DELETE FROM admin_two_factor`);
    await client.execute(`DELETE FROM users`);
    await db.insert(schema.users).values({ id: "a1", email: "a@x.pl", passwordHash: "x", appRole: "admin" });
  });

  it("nextFailureState: blokada po 5 błędach na 15 min", () => {
    expect(nextFailureState(0, NOW)).toEqual({ failedAttempts: 1, lockedUntil: null });
    expect(nextFailureState(ADMIN_2FA_MAX_ATTEMPTS - 1, NOW)).toEqual({ failedAttempts: 0, lockedUntil: NOW + ADMIN_2FA_LOCK_MS });
  });

  it("konfiguracja: setup → enable poprawnym kodem; status i kody awaryjne", async () => {
    const setup = await beginAdmin2faSetup(db, { userId: "a1", account: "a@x.pl", now: NOW });
    expect(setup!.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect((await getAdmin2faStatus(db, "a1", NOW)).pendingSetup).toBe(true);
    const bad = await enableAdmin2fa(db, { userId: "a1", code: "000000", now: NOW });
    expect(bad).toMatchObject({ ok: false, reason: "invalid" });
    const ok = await enableAdmin2fa(db, { userId: "a1", code: totpAt(setup!.secret, NOW), now: NOW });
    expect(ok.ok).toBe(true);
    const st = await getAdmin2faStatus(db, "a1", NOW);
    expect(st).toMatchObject({ enrolled: true, pendingSetup: false, recoveryCodesLeft: 10 });
    expect(await beginAdmin2faSetup(db, { userId: "a1", account: "a@x.pl" })).toBeNull();
  });

  it("verify: poprawny kod OK, ten sam krok drugi raz odrzucony (replay)", async () => {
    const { secret } = await enrolled();
    const t = NOW + 2 * STEP;
    expect(await verifyAdmin2fa(db, { userId: "a1", code: totpAt(secret, t), now: t })).toMatchObject({ ok: true, usedRecoveryCode: false });
    expect(await verifyAdmin2fa(db, { userId: "a1", code: totpAt(secret, t), now: t })).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("5 błędnych kodów blokuje konto na 15 min, po czasie znów działa", async () => {
    const { secret } = await enrolled();
    let last;
    for (let i = 0; i < ADMIN_2FA_MAX_ATTEMPTS; i++) {
      last = await verifyAdmin2fa(db, { userId: "a1", code: "000000", now: NOW + 5 * STEP });
    }
    expect(last).toMatchObject({ ok: false, reason: "locked" });
    const t = NOW + 5 * STEP;
    expect(await verifyAdmin2fa(db, { userId: "a1", code: totpAt(secret, t), now: t })).toMatchObject({ ok: false, reason: "locked" });
    const later = t + ADMIN_2FA_LOCK_MS + 1;
    expect(await verifyAdmin2fa(db, { userId: "a1", code: totpAt(secret, later), now: later })).toMatchObject({ ok: true });
  });

  it("kod awaryjny działa raz; hash jest niezależny od wielkości liter i myślnika", async () => {
    const { codes } = await enrolled();
    const code = codes[0]!;
    expect(hashRecoveryCode(code)).toBe(hashRecoveryCode(code.toLowerCase().replace("-", " ")));
    expect(await verifyAdmin2fa(db, { userId: "a1", code, now: NOW })).toMatchObject({ ok: true, usedRecoveryCode: true });
    expect(await verifyAdmin2fa(db, { userId: "a1", code, now: NOW })).toMatchObject({ ok: false, reason: "invalid" });
    expect((await getAdmin2faStatus(db, "a1", NOW)).recoveryCodesLeft).toBe(9);
  });

  it("jawne kody awaryjne nie trafiają do bazy (tylko skróty)", async () => {
    const { codes } = await enrolled();
    const row = (await client.execute(`SELECT recovery_hashes AS h FROM admin_two_factor`)).rows[0]!;
    for (const c of codes) expect(String(row.h)).not.toContain(c);
    expect(generateRecoveryCodes()).toHaveLength(10);
  });

  it("regeneracja unieważnia stare kody; wyłączenie wymaga poprawnego kodu", async () => {
    const { secret, codes } = await enrolled();
    const t = NOW + 3 * STEP;
    const regen = await regenerateRecoveryCodes(db, { userId: "a1", code: totpAt(secret, t), now: t });
    expect(regen.ok).toBe(true);
    expect(await verifyAdmin2fa(db, { userId: "a1", code: codes[1]!, now: t })).toMatchObject({ ok: false });
    expect(await disableAdmin2fa(db, { userId: "a1", code: "000000", now: t })).toMatchObject({ ok: false });
    const t2 = NOW + 4 * STEP;
    expect(await disableAdmin2fa(db, { userId: "a1", code: totpAt(secret, t2), now: t2 })).toEqual({ ok: true });
    expect((await getAdmin2faStatus(db, "a1", t2)).enrolled).toBe(false);
  });
});
