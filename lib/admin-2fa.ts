import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "@/db";
import { adminTwoFactor } from "@/db/schema";
import { decryptSensitiveField, encryptSensitiveField } from "@/lib/app-field-crypto";
import { generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";

/** DK-22: 5 błędnych prób → blokada 15 min. */
export const ADMIN_2FA_MAX_ATTEMPTS = 5;
export const ADMIN_2FA_LOCK_MS = 15 * 60_000;
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type Row = typeof adminTwoFactor.$inferSelect;

export type Admin2faStatus = {
  enrolled: boolean;
  pendingSetup: boolean;
  lockedUntil: number | null;
  recoveryCodesLeft: number;
};

export type Admin2faFailure =
  | { ok: false; reason: "not_enrolled" }
  | { ok: false; reason: "locked"; lockedUntil: number }
  | { ok: false; reason: "invalid"; attemptsLeft: number };

export type Admin2faVerifyResult = { ok: true; usedRecoveryCode: boolean } | Admin2faFailure;

/** Czysta funkcja: stan po błędnej próbie (testowalna bez bazy). */
export function nextFailureState(
  failedAttempts: number,
  now: number,
): { failedAttempts: number; lockedUntil: number | null } {
  const n = failedAttempts + 1;
  return n >= ADMIN_2FA_MAX_ATTEMPTS
    ? { failedAttempts: 0, lockedUntil: now + ADMIN_2FA_LOCK_MS }
    : { failedAttempts: n, lockedUntil: null };
}

export function hashRecoveryCode(code: string): string {
  const norm = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return createHash("sha256").update(norm, "utf8").digest("hex");
}

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const bytes = randomBytes(10);
    const chars = Array.from(bytes, (b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join("");
    return `${chars.slice(0, 5)}-${chars.slice(5)}`;
  });
}

function parseHashes(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function getRow(db: Database, userId: string): Promise<Row | null> {
  const [row] = await db.select().from(adminTwoFactor).where(eq(adminTwoFactor.userId, userId)).limit(1);
  return row ?? null;
}

export async function getAdmin2faStatus(db: Database, userId: string, now = Date.now()): Promise<Admin2faStatus> {
  const row = await getRow(db, userId);
  return {
    enrolled: Boolean(row?.enabledAt),
    pendingSetup: Boolean(row && !row.enabledAt),
    lockedUntil: row?.lockedUntil && row.lockedUntil.getTime() > now ? row.lockedUntil.getTime() : null,
    recoveryCodesLeft: row ? parseHashes(row.recoveryHashes).length : 0,
  };
}

/** Rozpoczyna konfigurację: nowy sekret (nadpisuje niepotwierdzony). Gdy 2FA jest już włączone → null. */
export async function beginAdmin2faSetup(
  db: Database,
  args: { userId: string; account: string; issuer?: string; now?: number },
): Promise<{ secret: string; uri: string } | null> {
  const existing = await getRow(db, args.userId);
  if (existing?.enabledAt) return null;
  const secret = generateTotpSecret();
  const values = {
    secretEnc: encryptSensitiveField(secret),
    enabledAt: null,
    recoveryHashes: "[]",
    failedAttempts: 0,
    lockedUntil: null,
    lastStep: 0,
  };
  if (existing) {
    await db.update(adminTwoFactor).set(values).where(eq(adminTwoFactor.userId, args.userId));
  } else {
    await db.insert(adminTwoFactor).values({ userId: args.userId, ...values, createdAt: new Date(args.now ?? Date.now()) });
  }
  return { secret, uri: otpauthUri({ secret, account: args.account, issuer: args.issuer ?? "GymBrat" }) };
}

async function registerFailure(db: Database, row: Row, now: number): Promise<Admin2faFailure> {
  const next = nextFailureState(row.failedAttempts, now);
  await db
    .update(adminTwoFactor)
    .set({ failedAttempts: next.failedAttempts, lockedUntil: next.lockedUntil ? new Date(next.lockedUntil) : null })
    .where(eq(adminTwoFactor.userId, row.userId));
  if (next.lockedUntil) return { ok: false, reason: "locked", lockedUntil: next.lockedUntil };
  return { ok: false, reason: "invalid", attemptsLeft: ADMIN_2FA_MAX_ATTEMPTS - next.failedAttempts };
}

function lockedFailure(row: Row, now: number): Admin2faFailure | null {
  if (row.lockedUntil && row.lockedUntil.getTime() > now) {
    return { ok: false, reason: "locked", lockedUntil: row.lockedUntil.getTime() };
  }
  return null;
}

/** Potwierdza konfigurację pierwszym poprawnym kodem; zwraca kody awaryjne (jedyny raz w postaci jawnej). */
export async function enableAdmin2fa(
  db: Database,
  args: { userId: string; code: string; now?: number },
): Promise<{ ok: true; recoveryCodes: string[] } | Admin2faFailure> {
  const now = args.now ?? Date.now();
  const row = await getRow(db, args.userId);
  if (!row || row.enabledAt) return { ok: false, reason: "not_enrolled" };
  const locked = lockedFailure(row, now);
  if (locked) return locked;
  const res = verifyTotp(decryptSensitiveField(row.secretEnc), args.code, now);
  if (!res.ok) return registerFailure(db, row, now);
  const codes = generateRecoveryCodes();
  await db
    .update(adminTwoFactor)
    .set({
      enabledAt: new Date(now),
      lastStep: res.step,
      failedAttempts: 0,
      lockedUntil: null,
      recoveryHashes: JSON.stringify(codes.map(hashRecoveryCode)),
    })
    .where(eq(adminTwoFactor.userId, args.userId));
  return { ok: true, recoveryCodes: codes };
}

/** Weryfikacja przy wejściu do panelu: kod TOTP albo jednorazowy kod awaryjny. */
export async function verifyAdmin2fa(
  db: Database,
  args: { userId: string; code: string; now?: number },
): Promise<Admin2faVerifyResult> {
  const now = args.now ?? Date.now();
  const row = await getRow(db, args.userId);
  if (!row?.enabledAt) return { ok: false, reason: "not_enrolled" };
  const locked = lockedFailure(row, now);
  if (locked) return locked;

  const totp = verifyTotp(decryptSensitiveField(row.secretEnc), args.code, now, { lastStep: row.lastStep });
  if (totp.ok) {
    await db
      .update(adminTwoFactor)
      .set({ lastStep: totp.step, failedAttempts: 0, lockedUntil: null })
      .where(eq(adminTwoFactor.userId, args.userId));
    return { ok: true, usedRecoveryCode: false };
  }

  const hashes = parseHashes(row.recoveryHashes);
  const h = hashRecoveryCode(args.code);
  if (/[A-Za-z]/.test(args.code) && hashes.includes(h)) {
    await db
      .update(adminTwoFactor)
      .set({ recoveryHashes: JSON.stringify(hashes.filter((x) => x !== h)), failedAttempts: 0, lockedUntil: null })
      .where(eq(adminTwoFactor.userId, args.userId));
    return { ok: true, usedRecoveryCode: true };
  }
  return registerFailure(db, row, now);
}

/** Wyłączenie wymaga poprawnego kodu (TOTP lub awaryjnego). */
export async function disableAdmin2fa(
  db: Database,
  args: { userId: string; code: string; now?: number },
): Promise<{ ok: true } | Admin2faFailure> {
  const res = await verifyAdmin2fa(db, args);
  if (!res.ok) return res;
  await db.delete(adminTwoFactor).where(eq(adminTwoFactor.userId, args.userId));
  return { ok: true };
}

/** Nowe kody awaryjne (stare przestają działać); wymaga poprawnego kodu TOTP. */
export async function regenerateRecoveryCodes(
  db: Database,
  args: { userId: string; code: string; now?: number },
): Promise<{ ok: true; recoveryCodes: string[] } | Admin2faFailure> {
  const res = await verifyAdmin2fa(db, args);
  if (!res.ok) return res;
  const codes = generateRecoveryCodes();
  await db
    .update(adminTwoFactor)
    .set({ recoveryHashes: JSON.stringify(codes.map(hashRecoveryCode)) })
    .where(eq(adminTwoFactor.userId, args.userId));
  return { ok: true, recoveryCodes: codes };
}
