import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";

/**
 * Kolumny DB `ai_*` zostają dla kompatybilności schematu, ale GymBrat
 * nie ma wbudowanego modelu LLM — zawsze „wyłączone”.
 */

/** Preferencja użytkownika (legacy). */
export async function getUserAiFeaturesDisabled(userId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ v: userSettings.aiFeaturesDisabled })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return (row?.v ?? 0) === 1;
}

/** Uprawnienie admina (legacy) — bez LLM i tak nieaktywne. */
export async function getUserAiEntitled(_userId: string): Promise<boolean> {
  return false;
}

/** Czy wolno wywołać model LLM — zawsze nie (usunięty serwer/agent). */
export async function userAllowsAiModel(_userId: string): Promise<boolean> {
  return false;
}
