"use server";

import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { isAiConfigured } from "@/ai/client";
import { generateMealSuggestionsFromModel } from "@/ai/meal-suggestions";
import { staticFallbackMeals, type MealSuggestionItem } from "@/lib/meal-suggestions-schema";
import { loadTodaysNutritionSummary } from "@/lib/nutrition-dashboard";
import { getBriefingTimeContext } from "@/lib/briefing-time-context";
import { computeMacroGaps, type MacroGaps } from "@/lib/meal-suggestions-gaps";
import { getMealSuggestionsTimeRulesPl } from "@/lib/meal-suggestions-time-context";
import { getUserAiFeaturesDisabled } from "@/lib/user-ai-preference";

export type GenerateMealSuggestionsResult =
  | {
      ok: true;
      meals: MealSuggestionItem[];
      source: "ai" | "static" | "user_disabled";
      gaps: MacroGaps;
    }
  | { ok: false; error: string };

export async function generateMealSuggestionsAction(): Promise<GenerateMealSuggestionsResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Brak sesji." };

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

  const gapsJson = JSON.stringify({
    date: gaps.dateKey,
    consumed: {
      kcal: gaps.caloriesConsumed,
      proteinG: gaps.proteinConsumed,
      fatG: gaps.fatConsumed,
      carbsG: gaps.carbsConsumed,
    },
    goals: {
      kcal: gaps.caloriesGoal,
      proteinG: gaps.proteinGoal,
      fatG: gaps.fatGoal,
      carbsG: gaps.carbsGoal,
    },
    remaining: {
      kcal: gaps.caloriesRemaining,
      proteinG: gaps.proteinRemaining,
      fatG: gaps.fatRemaining,
      carbsG: gaps.carbsRemaining,
    },
  });

  const noGoalsHint = gaps.hasAnyMacroGoal
    ? undefined
    : "Uwaga: użytkownik nie ma ustawionych pełnych celów makro w profilu na dziś — zaproponuj 3 zrównoważone posiłki domowe o sensownych makrach.";

  const userAiOff = await getUserAiFeaturesDisabled(userId);
  if (userAiOff) {
    return {
      ok: true,
      meals: staticFallbackMeals(),
      source: "user_disabled",
      gaps,
    };
  }

  if (!isAiConfigured()) {
    return {
      ok: true,
      meals: staticFallbackMeals(),
      source: "static",
      gaps,
    };
  }

  const timeCtx = getBriefingTimeContext();
  const meals = await generateMealSuggestionsFromModel({
    gapsJson,
    noGoalsHint,
    localCalendarLinePl: timeCtx.linePl,
    mealTimeRulesPl: getMealSuggestionsTimeRulesPl(timeCtx.hour),
  });

  return { ok: true, meals, source: "ai", gaps };
}
