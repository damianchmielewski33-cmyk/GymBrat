import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";

/** Jak często jwt/session sprawdzają, czy konto nadal jest w bazie. */
export const SESSION_USER_CHECK_INTERVAL_MS = 60_000;

export function shouldRecheckSessionUser(
  lastCheckAt: unknown,
  now = Date.now(),
  intervalMs = SESSION_USER_CHECK_INTERVAL_MS,
): boolean {
  if (typeof lastCheckAt !== "number" || !Number.isFinite(lastCheckAt)) return true;
  return now - lastCheckAt >= intervalMs;
}

/**
 * `true` — konto jest; `false` — potwierdzony brak (wyloguj);
 * `null` — błąd DB / niedostępność (nie wylogowuj „na ślepo”).
 */
export async function userStillExists(userId: string): Promise<boolean | null> {
  if (!userId.trim()) return false;
  try {
    const db = getDb();
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return Boolean(row);
  } catch {
    return null;
  }
}
