"use server";

import { auth } from "@/auth";
import { guardAction } from "@/lib/action-guard";
import { parseDateKey } from "@/lib/local-date";
import { listMealLogsForDay, type MealLogDto } from "@/lib/meal-logs";

/** Pełny dziennik żywienia jednego dnia (tylko własne wpisy zalogowanego użytkownika). */
export async function loadNutritionDayLog(
  dateKey: string,
): Promise<{ ok: true; entries: MealLogDto[] } | { ok: false }> {
  await guardAction("nutrition-day-log.loadNutritionDayLog");
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false };
  if (typeof dateKey !== "string" || !parseDateKey(dateKey)) return { ok: false };
  const entries = await listMealLogsForDay(userId, dateKey);
  return { ok: true, entries };
}
