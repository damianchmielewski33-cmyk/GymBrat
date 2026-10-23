import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";

/**
 * Stan konta potrzebny do unieważniania sesji JWT (ADR 0001 D5).
 * Odczyt po kluczu głównym z cache w procesie (TTL 60 s) — używany w `auth.ts` (`jwt`) i `proxy.ts`.
 */
export type AccountAuthState = {
  exists: boolean;
  email: string;
  appRole: string;
  emailVerified: boolean;
  sessionVersion: number;
};

export const ACCOUNT_AUTH_STATE_TTL_MS = 60_000;

/** Górna granica wpisów — przy przekroczeniu usuwane są wygasłe. */
const MAX_ENTRIES = 5_000;

const MISSING: AccountAuthState = {
  exists: false,
  email: "",
  appRole: "zawodnik",
  emailVerified: false,
  sessionVersion: 0,
};

type CacheEntry = { state: AccountAuthState; expiresAt: number };

const globalForState = globalThis as unknown as {
  gymbratAccountAuthState?: Map<string, CacheEntry>;
};

function cache(): Map<string, CacheEntry> {
  globalForState.gymbratAccountAuthState ??= new Map();
  return globalForState.gymbratAccountAuthState;
}

export async function getAccountAuthState(userId: string): Promise<AccountAuthState> {
  const now = Date.now();
  const hit = cache().get(userId);
  if (hit && hit.expiresAt > now) return hit.state;

  const [row] = await getDb()
    .select({
      email: users.email,
      appRole: users.appRole,
      emailVerifiedAt: users.emailVerifiedAt,
      sessionVersion: users.sessionVersion,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const state: AccountAuthState = row
    ? {
        exists: true,
        email: row.email,
        appRole: row.appRole,
        emailVerified: row.emailVerifiedAt != null,
        sessionVersion: row.sessionVersion,
      }
    : MISSING;
  const entries = cache();
  if (entries.size >= MAX_ENTRIES) {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) entries.delete(key);
    }
  }
  entries.set(userId, { state, expiresAt: now + ACCOUNT_AUTH_STATE_TTL_MS });
  return state;
}

/** Natychmiastowe unieważnienie wpisu na tej instancji (po przejęciu konta, backfillu). */
export function invalidateAccountAuthState(userId: string): void {
  cache().delete(userId);
}

/** Token jest unieważniony, gdy konto nie istnieje albo wersja sesji się różni (stary token bez `sv` = 0). */
export function isTokenRevoked(
  token: { id?: unknown; sv?: unknown },
  state: AccountAuthState,
): boolean {
  if (typeof token.id !== "string" || !token.id) return true;
  if (!state.exists) return true;
  const sv = typeof token.sv === "number" && Number.isFinite(token.sv) ? token.sv : 0;
  return sv !== state.sessionVersion;
}
