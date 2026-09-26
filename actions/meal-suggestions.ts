"use server";

import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { staticFallbackMeals, type MealSuggestionItem } from "@/lib/meal-suggestions-schema";
import {
  catalogMealToSuggestion,
  pickCatalogMealsForGaps,
} from "@/lib/meal-catalog";
import { loadTodaysNutritionSummary } from "@/lib/nutrition-dashboard";
import { getBriefingTimeContext } from "@/lib/briefing-time-context";
import { computeMacroGaps, type MacroGaps } from "@/lib/meal-suggestions-gaps";
import { UserMessages } from "@/lib/user-facing-errors";

function catalogSuggestions(gaps: MacroGaps, hour: number): MealSuggestionItem[] {
  const picked = pickCatalogMealsForGaps(gaps, { hour, limit: 4 });
  if (picked.length > 0) return picked.map(catalogMealToSuggestion);
  return staticFallbackMeals();
}

export type GenerateMealSuggestionsResult =
  | {
      ok: true;
      meals: MealSuggestionItem[];
      /** Dobór z lokalnego katalogu przepisów GymBrat. */
      source: "catalog";
      gaps: MacroGaps;
    }
  | { ok: false; error: string };

/** Propozycje dnia wyłącznie z lokalnej bazy posiłków GymBrat. */
export async function generateMealSuggestionsAction(): Promise<GenerateMealSuggestionsResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: UserMessages.mealSuggestionsNoSession };

  const userId = session.user.id;
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

  const summary = await loadTodaysNutritionSummary(userId, row);
  const gaps = computeMacroGaps(summary);
  const timeCtx = getBriefingTimeContext();

  return {
    ok: true,
    meals: catalogSuggestions(gaps, timeCtx.hour),
    source: "catalog",
    gaps,
  };
}
