import { and, eq, inArray, isNull, min } from "drizzle-orm";
import { getDb, type Database } from "@/db";
import { oauthAccounts, users } from "@/db/schema";
import { parseAdminEmails } from "@/lib/admin-config";
import { securityEventInsert } from "@/lib/security-events";

/**
 * Uzupełnienie `users.email_verified_at` dla kont sprzed wdrożenia (ADR 0001 D2), przy starcie procesu.
 * Idempotentne: dotyka wyłącznie wierszy z `email_verified_at IS NULL`.
 * - R-A: konto założone przez Google (powiązanie najwyżej 5 min po `users.created_at`) → data powiązania.
 * - R-B: Google dołączone później → teraz (Google potwierdził kontrolę adresu; DW-5: bez zmiany hasła i sesji).
 * - R-C: rola admin i e-mail w `ADMIN_EMAILS` → teraz (kotwica: konfiguracja właściciela).
 * Konta hasłowe bez Google i konta tylko z Facebookiem zostają niezweryfikowane (LR-24).
 */

export const GOOGLE_SIGNUP_WINDOW_MS = 5 * 60_000;

export type EmailVerificationBackfillResult = {
  googleSignup: number;
  googleLinkedLater: number;
  adminConfig: number;
};

export async function migrateEmailVerification(
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<EmailVerificationBackfillResult> {
  const result: EmailVerificationBackfillResult = {
    googleSignup: 0,
    googleLinkedLater: 0,
    adminConfig: 0,
  };

  const googleRows = await db
    .select({
      id: users.id,
      createdAt: users.createdAt,
      linkedAt: min(oauthAccounts.createdAt),
    })
    .from(users)
    .innerJoin(
      oauthAccounts,
      and(eq(oauthAccounts.userId, users.id), eq(oauthAccounts.provider, "google")),
    )
    .where(isNull(users.emailVerifiedAt))
    .groupBy(users.id, users.createdAt);

  for (const row of googleRows) {
    if (!row.linkedAt) continue;
    const linkedAt = row.linkedAt instanceof Date ? row.linkedAt : new Date(row.linkedAt);
    const unverified = and(eq(users.id, row.id), isNull(users.emailVerifiedAt));
    if (linkedAt.getTime() - row.createdAt.getTime() <= GOOGLE_SIGNUP_WINDOW_MS) {
      await db.update(users).set({ emailVerifiedAt: linkedAt }).where(unverified);
      result.googleSignup += 1;
      continue;
    }
    const [update] = await db.batch([
      db.update(users).set({ emailVerifiedAt: now }).where(unverified).returning({ id: users.id }),
      securityEventInsert(db, {
        type: "backfill_verified",
        userId: row.id,
        reason: "google_linked_later",
        provider: "google",
      }),
    ]);
    if (update.length > 0) result.googleLinkedLater += 1;
  }

  const adminEmails = [...parseAdminEmails()];
  if (adminEmails.length > 0) {
    const updated = await db
      .update(users)
      .set({ emailVerifiedAt: now })
      .where(
        and(
          isNull(users.emailVerifiedAt),
          eq(users.appRole, "admin"),
          inArray(users.email, adminEmails),
        ),
      )
      .returning({ id: users.id });
    result.adminConfig = updated.length;
  }

  return result;
}
