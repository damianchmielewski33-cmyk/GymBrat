import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";

/** Zapis aktywności najwyżej raz na tyle ms na konto i proces (retencja nieaktywnych kont, Z28). */
export const ACTIVITY_TOUCH_INTERVAL_MS = 12 * 60 * 60_000;

const globalForTouch = globalThis as unknown as { gymbratActivityTouch?: Map<string, number> };
const lastTouch = () => (globalForTouch.gymbratActivityTouch ??= new Map());

/**
 * Oznacza konto jako aktywne i kasuje ostrzeżenia o nieaktywności (powrót użytkownika
 * wstrzymuje procedurę usuwania). Błąd zapisu nie może wpływać na żądanie.
 */
export function touchUserActivity(userId: string, now: number = Date.now()): void {
  const map = lastTouch();
  const prev = map.get(userId);
  if (prev != null && now - prev < ACTIVITY_TOUCH_INTERVAL_MS) return;
  if (map.size > 5_000) map.clear();
  map.set(userId, now);
  void (async () => {
    try {
      await getDb()
        .update(users)
        .set({ lastActiveAt: new Date(now), inactivityWarnedAt: null, photosWarnedAt: null })
        .where(eq(users.id, userId));
    } catch {
      map.delete(userId);
    }
  })();
}
