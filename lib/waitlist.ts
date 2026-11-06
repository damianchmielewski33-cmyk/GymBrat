import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db";
import { waitlistSignups } from "@/db/schema";
import { getAuthSecret } from "@/lib/auth-secret";

/**
 * Lista powiadomień o premierze w Google Play (landing, osobna domena).
 * Double opt-in: wpis `pending` → klik w link z e-maila → `confirmed`. Wypis jednym kliknięciem.
 * Okresy retencji i treść zgody to PROJEKT — wymagają zatwierdzenia prawnika.
 */

/** Wersja treści zgody pokazywanej na landingu (zapisywana przy wpisie). Zmień przy każdej zmianie treści. */
export const WAITLIST_CONSENT_VERSION = "2026-11-draft-1";

const DAY_MS = 24 * 60 * 60 * 1000;
export const WAITLIST_CONFIRM_TTL_MS = 48 * 60 * 60 * 1000;

export const waitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email({ message: "Podaj poprawny adres e-mail." })),
  /** Zgoda musi być jawnie `true` (nie domyślna). */
  consent: z.literal(true, { message: "Zaznacz zgodę na jednorazowy e-mail o premierze." }),
  /** Honeypot — pole ukryte przed ludźmi; boty je wypełniają. */
  website: z.string().max(200).optional(),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;

/* ---------------------------------- CORS ---------------------------------- */

type Env = Record<string, string | undefined>;

/** Dozwolone originy landingu: tylko domena z `NEXT_PUBLIC_LANDING_URL` (+ lokalny dev poza produkcją). */
export function allowedWaitlistOrigins(env: Env = process.env): Set<string> {
  const out = new Set<string>();
  const raw = env.NEXT_PUBLIC_LANDING_URL?.trim();
  if (raw) {
    try {
      out.add(new URL(raw).origin);
    } catch {
      /* zła wartość = brak dozwolonego originu */
    }
  }
  if (env.NODE_ENV !== "production") {
    out.add("http://localhost:4321");
    out.add("http://127.0.0.1:4321");
  }
  return out;
}

export function isWaitlistConfigured(env: Env = process.env): boolean {
  const raw = env.NEXT_PUBLIC_LANDING_URL?.trim();
  if (!raw) return false;
  try {
    new URL(raw);
    return true;
  } catch {
    return false;
  }
}

/** Nagłówki CORS tylko dla dozwolonego originu; dla innych — brak (przeglądarka zablokuje odpowiedź). */
export function waitlistCorsHeaders(origin: string | null, env: Env = process.env): Record<string, string> {
  const base: Record<string, string> = { Vary: "Origin" };
  if (origin && allowedWaitlistOrigins(env).has(origin)) {
    base["Access-Control-Allow-Origin"] = origin;
    base["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    base["Access-Control-Allow-Headers"] = "Content-Type";
    base["Access-Control-Max-Age"] = "600";
  }
  return base;
}

/* --------------------------------- tokeny --------------------------------- */

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newConfirmToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Token wypisu = HMAC(email) kluczem AUTH_SECRET: bez stanu w bazie, nie do odgadnięcia. */
export function unsubscribeToken(email: string, secret: string | undefined = getAuthSecret()): string | null {
  if (!secret) return null;
  return createHmac("sha256", secret).update(`waitlist-unsub:${email}`).digest("base64url");
}

export function verifyUnsubscribeToken(email: string, token: string, secret: string | undefined = getAuthSecret()): boolean {
  const expected = unsubscribeToken(email, secret);
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ------------------------------ operacje na DB ----------------------------- */

export type SignupOutcome =
  | { kind: "already-confirmed" }
  | { kind: "send-confirmation"; email: string; token: string };

/** Zapisuje (lub odnawia) wpis `pending` i zwraca token do wysłania mailem. */
export async function registerWaitlistSignup(db: Database, email: string, now = new Date()): Promise<SignupOutcome> {
  const [existing] = await db.select().from(waitlistSignups).where(eq(waitlistSignups.email, email)).limit(1);
  if (existing?.status === "confirmed") return { kind: "already-confirmed" };

  const token = newConfirmToken();
  const values = {
    status: "pending",
    confirmTokenHash: hashToken(token),
    confirmExpiresAt: new Date(now.getTime() + WAITLIST_CONFIRM_TTL_MS),
    consentVersion: WAITLIST_CONSENT_VERSION,
    consentAt: now,
    unsubscribedAt: null,
  };
  if (existing) {
    await db.update(waitlistSignups).set(values).where(eq(waitlistSignups.id, existing.id));
  } else {
    await db.insert(waitlistSignups).values({ email, ...values, createdAt: now });
  }
  return { kind: "send-confirmation", email, token };
}

export async function confirmWaitlistSignup(db: Database, token: string, now = new Date()): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const [row] = await db
    .select()
    .from(waitlistSignups)
    .where(eq(waitlistSignups.confirmTokenHash, hashToken(token)))
    .limit(1);
  if (!row || row.status !== "pending") return false;
  if (!row.confirmExpiresAt || row.confirmExpiresAt.getTime() < now.getTime()) return false;
  await db
    .update(waitlistSignups)
    .set({ status: "confirmed", confirmedAt: now, confirmTokenHash: null, confirmExpiresAt: null })
    .where(eq(waitlistSignups.id, row.id));
  return true;
}

export async function unsubscribeWaitlist(db: Database, email: string, now = new Date()): Promise<void> {
  await db
    .update(waitlistSignups)
    .set({ status: "unsubscribed", unsubscribedAt: now, confirmTokenHash: null, confirmExpiresAt: null })
    .where(eq(waitlistSignups.email, email));
}

/* -------------------------------- retencja -------------------------------- */

export type WaitlistRetentionPolicy = {
  /** Niepotwierdzone wpisy. */
  pendingDays: number;
  /** Wypisani (po wypisie zostaje krótko, żeby nie wysłać ponownie). */
  unsubscribedDays: number;
  /** Potwierdzeni, którzy nie dostali powiadomienia (np. premiera się nie odbyła). */
  confirmedDays: number;
  /** Po wysłaniu e-maila premierowego. */
  notifiedDays: number;
};

export function getWaitlistRetentionPolicy(env: Env = process.env): WaitlistRetentionPolicy {
  const n = (name: string, fallback: number) => {
    const v = Number(env[name]);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
  };
  return {
    pendingDays: 7,
    unsubscribedDays: 30,
    confirmedDays: n("WAITLIST_RETENTION_DAYS", 365),
    notifiedDays: 30,
  };
}

export async function runWaitlistRetention(
  db: Database,
  now: number,
  policy: WaitlistRetentionPolicy = getWaitlistRetentionPolicy(),
): Promise<{ deleted: number }> {
  const cut = (days: number) => new Date(now - days * DAY_MS);
  const rules = [
    and(eq(waitlistSignups.status, "pending"), lt(waitlistSignups.createdAt, cut(policy.pendingDays))),
    and(eq(waitlistSignups.status, "unsubscribed"), lt(waitlistSignups.unsubscribedAt, cut(policy.unsubscribedDays))),
    and(eq(waitlistSignups.status, "confirmed"), lt(waitlistSignups.consentAt, cut(policy.confirmedDays))),
    lt(waitlistSignups.notifiedAt, cut(policy.notifiedDays)),
  ];
  let deleted = 0;
  for (const rule of rules) {
    const res = await db.delete(waitlistSignups).where(rule).returning({ id: waitlistSignups.id });
    deleted += res.length;
  }
  return { deleted };
}
