"use server";

import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { calendarDateKey } from "@/lib/local-date";
import {
  loadNutritionWeekRange,
  NUTRITION_WEEK_CHUNK,
  NUTRITION_WEEK_HISTORY_PAST_WEEKS,
  type PreviousWeekNutritionSheetWeek,
} from "@/lib/nutrition-dashboard";
import { nutritionSettingsFromDbRow } from "@/lib/nutrition-goals";

/** Z70: doładowanie starszych tygodni (offset = liczba już załadowanych tygodni). */
export async function loadMoreNutritionWeeks(
  offset: number,
): Promise<{ weeks: PreviousWeekNutritionSheetWeek[]; done: boolean }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { weeks: [], done: true };
  const from = Math.floor(Number(offset));
  const max = NUTRITION_WEEK_HISTORY_PAST_WEEKS + 1;
  if (!Number.isFinite(from) || from < 1 || from >= max) {
    return { weeks: [], done: true };
  }
  const to = Math.min(max, from + NUTRITION_WEEK_CHUNK);
  const db = getDb();
  const [row] = await db
    .select({
      trainingNutritionGoalsJson: userSettings.trainingNutritionGoalsJson,
      restNutritionGoalsJson: userSettings.restNutritionGoalsJson,
      nutritionDayTypesJson: userSettings.nutritionDayTypesJson,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  const settings = nutritionSettingsFromDbRow(
    row ?? {
      trainingNutritionGoalsJson: null,
      restNutritionGoalsJson: null,
      nutritionDayTypesJson: null,
    },
  );
  const weeks = await loadNutritionWeekRange(
    userId,
    settings,
    calendarDateKey(new Date()),
    from,
    to,
  );
  return { weeks, done: to >= max };
}
