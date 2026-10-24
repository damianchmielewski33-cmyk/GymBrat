import "server-only";

import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { hash } from "bcryptjs";
import { and, eq, getTableColumns, isNull, ne, sql, type SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { getDb, type Database } from "@/db";
import {
  adminAuditLog,
  oauthAccounts,
  subscriptionOrders,
  userSettings,
  users,
} from "@/db/schema";
import { buildUserDataPurgeStatements } from "@/lib/account-purge";
import { invalidateAccountAuthState } from "@/lib/account-auth-state";
import { getAuthSecret } from "@/lib/auth-secret";
import { securityEventRow } from "@/lib/security-events";

/**
 * Przejęcie konta z niezweryfikowanym e-mailem przez właściciela adresu w Google
 * (ADR 0001 D4, wariant A; LR-23). Stan oczekujący jest tylko w podpisanym tokenie.
 */

export const TAKEOVER_TOKEN_TTL_MS = 10 * 60_000;

/** Ładunek tokenu: konto, identyfikator konta Google, wygaśnięcie (bez imienia i e-maila w URL-u). */
export type TakeoverTokenPayload = { uid: string; pid: string; exp: number };

const payloadSchema = z.object({
  uid: z.string().min(1).max(64),
  pid: z.string().min(1).max(255),
  exp: z.number().int().positive(),
});

function requireSecret(): string {
  const secret = getAuthSecret();
  if (!secret) throw new Error("AUTH_SECRET");
  return secret;
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(`takeover:${body}`).digest("base64url");
}

export function signTakeoverToken(
  input: { uid: string; pid: string },
  now = Date.now(),
): string {
  const body = Buffer.from(
    JSON.stringify({ uid: input.uid, pid: input.pid, exp: now + TAKEOVER_TOKEN_TTL_MS }),
  ).toString("base64url");
  return `${body}.${sign(body, requireSecret())}`;
}

/** Podpis i wygaśnięcie; `null` dla każdego niepoprawnego tokenu. */
export function verifyTakeoverToken(
  token: string,
  now = Date.now(),
): TakeoverTokenPayload | null {
  const secret = getAuthSecret();
  if (!secret) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const parsed = payloadSchema.safeParse(
      JSON.parse(Buffer.from(body, "base64url").toString("utf8")),
    );
    if (!parsed.success || parsed.data.exp <= now) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/** Konto nadal kwalifikuje się do przejęcia: istnieje, e-mail niezweryfikowany, nie admin. */
function eligibleForTakeover(userId: string): SQL {
  return and(eq(users.id, userId), isNull(users.emailVerifiedAt), ne(users.appRole, "admin"))!;
}

export async function isTakeoverPending(payload: TakeoverTokenPayload): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eligibleForTakeover(payload.uid))
    .limit(1);
  return Boolean(row);
}

/**
 * `INSERT ... SELECT <wartości> WHERE <warunek>` dla tabeli Drizzle: nazwy kolumn i
 * kodowanie wartości (np. `timestamp_ms`) pochodzą z definicji kolumn, więc zmiana
 * schematu jest wykrywana przez `tsc`.
 */
function insertIf<T extends SQLiteTable>(
  db: Database,
  table: T,
  values: T["$inferInsert"],
  condition: SQL,
) {
  const columns = getTableColumns(table);
  const entries = Object.entries(values as Record<string, unknown>).filter(
    ([, v]) => v !== undefined,
  );
  const cols = sql.join(
    entries.map(([key]) => sql.identifier(columns[key]!.name)),
    sql`, `,
  );
  const vals = sql.join(
    entries.map(([key, v]) => sql`${sql.param(v, columns[key])}`),
    sql`, `,
  );
  return db.run(
    sql`INSERT INTO ${table} (${cols}) SELECT ${vals} WHERE ${condition} ON CONFLICT DO NOTHING`,
  );
}

/**
 * Instrukcje przejęcia w kolejności wykonania (jeden `db.batch`, jedna transakcja):
 * 1. reset konta (tylko gdy nadal kwalifikuje się do przejęcia) z `email_verified_at = now`,
 * 2. anulowanie oczekujących zamówień (opłacenie po przejęciu nie przyznaje pakietu
 * nowemu właścicielowi), 3. purge danych, 4. domyślne ustawienia, 5. powiązanie Google,
 * 6. zdarzenie w dzienniku. Kroki 2-6 mają warunek „konto przejęte w tym batchu” (`email_verified_at = now`),
 * więc drugie (równoległe lub ponowne) wywołanie niczego nie zmienia.
 */
export function buildTakeoverStatements(
  db: Database,
  input: { userId: string; providerAccountId: string; passwordHash: string; now: Date },
) {
  const nowMs = input.now.getTime();
  const takenOverNow = sql`EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${input.userId} AND ${users.emailVerifiedAt} = ${nowMs})`;
  const reset = db
    .update(users)
    .set({
      passwordHash: input.passwordHash,
      emailVerifiedAt: input.now,
      sessionVersion: sql`${users.sessionVersion} + 1`,
      appRole: "zawodnik",
      name: null,
      firstName: null,
      lastName: null,
      weightKg: null,
      heightCm: null,
      age: null,
      sex: null,
      activityLevel: null,
      adminNote: null,
      packageEndsAt: null,
      packagePlanSku: null,
    })
    .where(eligibleForTakeover(input.userId));

  const cancelPendingOrders = db
    .update(subscriptionOrders)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(subscriptionOrders.userId, input.userId),
        eq(subscriptionOrders.status, "pending"),
        takenOverNow,
      ),
    );

  return [
    reset,
    cancelPendingOrders,
    ...buildUserDataPurgeStatements(db, input.userId, { guard: takenOverNow }),
    insertIf(db, userSettings, { userId: input.userId, updatedAt: input.now }, takenOverNow),
    insertIf(
      db,
      oauthAccounts,
      {
        id: randomUUID(),
        userId: input.userId,
        provider: "google",
        providerAccountId: input.providerAccountId,
        createdAt: input.now,
      },
      takenOverNow,
    ),
    insertIf(
      db,
      adminAuditLog,
      {
        ...securityEventRow({
          type: "account_takeover",
          userId: input.userId,
          reason: "email_unverified",
          provider: "google",
        }),
        id: randomUUID(),
        createdAt: input.now,
      },
      takenOverNow,
    ),
  ] as const;
}

/** `true`, gdy konto zostało przejęte; `false`, gdy już nie kwalifikowało się (token zużyty). */
export async function takeOverUnverifiedAccount(input: {
  userId: string;
  providerAccountId: string;
}): Promise<boolean> {
  const db = getDb();
  const passwordHash = await hash(randomBytes(32).toString("hex"), 12);
  const [first, ...rest] = buildTakeoverStatements(db, { ...input, passwordHash, now: new Date() });
  const [reset] = await db.batch([first, ...rest]);
  invalidateAccountAuthState(input.userId);
  return reset.rowsAffected > 0;
}
