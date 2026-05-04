import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { isAiConfigured } from "@/ai/client";

/** Preferencja użytkownika: 1 = wyłączone wszystkie funkcje AI (niezależnie od konfiguracji dostawcy). */
export async function getUserAiFeaturesDisabled(userId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ v: userSettings.aiFeaturesDisabled })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return (row?.v ?? 0) === 1;
}

/** Uprawnienie nadawane przez admina: 0 = użytkownik nie ma dostępu do modułów AI w UI i API. */
export async function getUserAiEntitled(userId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ v: userSettings.aiEntitled })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  // Brak wiersza traktujemy jak "ma dostęp", żeby nie wycinać istniejących kont po wdrożeniu.
  return (row?.v ?? 1) === 1;
}

/** Czy wolno wywołać model (dostawca skonfigurowany i użytkownik nie wyłączył AI). */
export async function userAllowsAiModel(userId: string): Promise<boolean> {
  if (!isAiConfigured()) return false;
  const [entitled, off] = await Promise.all([
    getUserAiEntitled(userId),
    getUserAiFeaturesDisabled(userId),
  ]);
  return entitled && !off;
}
