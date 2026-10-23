import "server-only";

import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { hash } from "bcryptjs";
import { and, eq, isNull, ne, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Database } from "@/db";
import { users } from "@/db/schema";
import { buildUserDataPurgeStatements } from "@/lib/account-purge";
import { invalidateAccountAuthState } from "@/lib/account-auth-state";
import { adminAuditValues } from "@/lib/admin-audit";
import { getAuthSecret } from "@/lib/auth-secret";
import { securityEventMeta } from "@/lib/security-events";

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

function insertIf(
  db: Database,
  table: string,
  values: Record<string, string | number | null>,
  condition: SQL,
) {
  const cols = sql.join(
    Object.keys(values).map((c) => sql.identifier(c)),
    sql`, `,
  );
  const vals = sql.join(
    Object.values(values).map((v) => sql`${v}`),
    sql`, `,
  );
  return db.run(
    sql`INSERT INTO ${sql.identifier(table)} (${cols}) SELECT ${vals} WHERE ${condition} ON CONFLICT DO NOTHING`,
  );
}

/**
 * Instrukcje przejęcia w kolejności wykonania (jeden `db.batch`, jedna transakcja):
 * 1. reset konta (tylko gdy nadal kwalifikuje się do przejęcia) z `email_verified_at = now`,
 * 2. purge danych, 3. domyślne ustawienia, 4. powiązanie Google, 5. zdarzenie w dzienniku.
 * Kroki 2-5 mają warunek „konto przejęte w tym batchu” (`email_verified_at = now`),
 * więc drugie (równoległe lub ponowne) wywołanie niczego nie zmienia.
 */
export function buildTakeoverStatements(
  db: Database,
  input: { userId: string; providerAccountId: string; passwordHash: string; now: Date },
) {
  const nowMs = input.now.getTime();
  const takenOverNow = sql`EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${input.userId} AND ${users.emailVerifiedAt} = ${nowMs})`;
  const event = adminAuditValues({
    actorUserId: input.userId,
    action: "security.account_takeover",
    targetUserId: input.userId,
    meta: securityEventMeta({
      type: "account_takeover",
      userId: input.userId,
      reason: "email_unverified",
      provider: "google",
    }),
  });

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

  return [
    reset,
    ...buildUserDataPurgeStatements(db, input.userId, { guard: takenOverNow }),
    insertIf(db, "user_settings", { user_id: input.userId, updated_at: nowMs }, takenOverNow),
    insertIf(
      db,
      "oauth_accounts",
      {
        id: randomUUID(),
        user_id: input.userId,
        provider: "google",
        provider_account_id: input.providerAccountId,
        created_at: nowMs,
      },
      takenOverNow,
    ),
    insertIf(
      db,
      "admin_audit_log",
      {
        id: randomUUID(),
        actor_user_id: event.actorUserId,
        action: event.action,
        target_user_id: event.targetUserId ?? null,
        meta_json: event.metaJson ?? null,
        deployment_env: event.deploymentEnv ?? null,
        created_at: nowMs,
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
