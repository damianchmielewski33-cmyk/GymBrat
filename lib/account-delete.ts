import "server-only";

import { compare } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { subscriptionOrders, users } from "@/db/schema";
import { buildUserDataPurgeStatements } from "@/lib/account-purge";

/** Logowanie OAuth/hasłem nie starsze niż tyle liczy się jako „świeże” (DK-15). */
export const REAUTH_WINDOW_MS = 5 * 60_000;

export function isFreshLogin(authAt: number | undefined, now: number = Date.now()): boolean {
  return typeof authAt === "number" && authAt <= now + 5_000 && now - authAt <= REAUTH_WINDOW_MS;
}

export type DeleteReauthResult =
  | { ok: true; method: "password" | "fresh_login" }
  | { ok: false; reason: "password_invalid" | "reauth_required" };

/**
 * Z14: usunięcie konta wymaga ponownego uwierzytelnienia — hasła albo świeżego logowania
 * (w ciągu REAUTH_WINDOW_MS). Podane hasło ma pierwszeństwo: błędne hasło nie „przechodzi”
 * na ścieżkę świeżego logowania.
 */
export async function verifyDeleteReauth(args: {
  password: string | undefined;
  passwordHash: string | null | undefined;
  authAt: number | undefined;
  now?: number;
}): Promise<DeleteReauthResult> {
  if (args.password) {
    if (!args.passwordHash) return { ok: false, reason: "password_invalid" };
    const valid = await compare(args.password, args.passwordHash);
    return valid ? { ok: true, method: "password" } : { ok: false, reason: "password_invalid" };
  }
  if (isFreshLogin(args.authAt, args.now)) return { ok: true, method: "fresh_login" };
  return { ok: false, reason: "reauth_required" };
}

/**
 * Trwałe usunięcie konta w jednej transakcji: dane zależne (zdrowie, zdjęcia, push, powiązania OAuth, …)
 * jawnie z metadanych schematu, zamówienia odpinane od konta (dokumentacja sprzedaży zostaje, Z7),
 * na końcu wiersz `users`. Sesje JWT przestają działać, bo konto nie istnieje (`getAccountAuthState`).
 */
export async function deleteUserAccount(db: Database, userId: string): Promise<void> {
  const purge = buildUserDataPurgeStatements(db, userId);
  const [first, ...rest] = [
    ...purge,
    db.run(sql`UPDATE ${subscriptionOrders} SET user_id = NULL WHERE user_id = ${userId}`),
    db.delete(users).where(eq(users.id, userId)),
  ];
  await db.batch([first!, ...rest]);
}
