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

/** Czy wolno wywołać model (dostawca skonfigurowany i użytkownik nie wyłączył AI). */
export async function userAllowsAiModel(userId: string): Promise<boolean> {
  if (!isAiConfigured()) return false;
  return !(await getUserAiFeaturesDisabled(userId));
}
