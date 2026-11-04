import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { addCalendarDays, calendarDateKey, weekDateKeysMondayFirst } from "@/lib/local-date";
import { getMealLogAggregatesForDates } from "@/lib/meal-logs";
import { nutritionSettingsFromDbRow, resolveProfileDayGoals } from "@/lib/nutrition-goals";
import { type MacroDaySnapshot } from "@/lib/extra-cardio-from-macros";
import type { HomeStartMacroPoint, HomeStartTodayMacros, HomeStartWeekMacros } from "@/lib/home-start-types";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function remainingOrNull(goal: number | null | undefined, consumed: number): number | null {
  if (goal == null || !Number.isFinite(goal)) return null;
  return round1(goal - consumed);
}

export async function getMacroSeriesAndToday(
  userId: string,
): Promise<{
  series: HomeStartMacroPoint[];
  today: HomeStartTodayMacros;
  week: HomeStartWeekMacros;
  /** Dni pon–dziś z celami i spożyciem — do długu cardio. */
  elapsedWeekDays: Array<{ dateKey: string; day: MacroDaySnapshot }>;
}> {
  const todayKey = calendarDateKey();
  const weekKeys = weekDateKeysMondayFirst(todayKey);
  const days = 14;
  const keySet = new Set<string>(weekKeys);
  for (let i = days - 1; i >= 0; i--) {
    keySet.add(addCalendarDays(todayKey, -i));
  }
  const keys = [...keySet].sort();

  const db = getDb();
  const [settingsRow, aggregates] = await Promise.all([
    db
      .select({
        trainingNutritionGoalsJson: userSettings.trainingNutritionGoalsJson,
        restNutritionGoalsJson: userSettings.restNutritionGoalsJson,
        nutritionDayTypesJson: userSettings.nutritionDayTypesJson,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getMealLogAggregatesForDates(userId, keys),
  ]);

  const settings = nutritionSettingsFromDbRow({
    trainingNutritionGoalsJson: settingsRow?.trainingNutritionGoalsJson ?? null,
    restNutritionGoalsJson: settingsRow?.restNutritionGoalsJson ?? null,
    nutritionDayTypesJson: settingsRow?.nutritionDayTypesJson ?? null,
  });

  const series = keys
    .filter((date) => {
      // series: ostatnie 14 dni kalendarzowych
      const oldest = addCalendarDays(todayKey, -(days - 1));
      return date >= oldest && date <= todayKey;
    })
    .map((date) => {
      const agg = aggregates[date];
      const protein = round1(agg?.protein ?? 0);
      const carbs = round1(agg?.carbs ?? 0);
      const fat = round1(agg?.fat ?? 0);
      const consumed = Math.round(agg?.calories ?? 0);
      const goals = resolveProfileDayGoals(settings, date);
      const remainingKcal =
        goals != null ? Math.round(goals.caloriesGoal - consumed) : null;
      return { date, protein, carbs, fat, remainingKcal };
    });

  const todayAgg = aggregates[todayKey];
  const proteinConsumed = round1(todayAgg?.protein ?? 0);
  const carbsConsumed = round1(todayAgg?.carbs ?? 0);
  const fatConsumed = round1(todayAgg?.fat ?? 0);
  const caloriesConsumed = Math.round(todayAgg?.calories ?? 0);
  const todayGoals = resolveProfileDayGoals(settings, todayKey);
  const proteinGoal = todayGoals?.macroGoals.protein ?? null;
  const carbsGoal = todayGoals?.macroGoals.carbs ?? null;
  const fatGoal = todayGoals?.macroGoals.fat ?? null;
  const caloriesGoal =
    todayGoals != null ? Math.round(todayGoals.caloriesGoal) : null;

  // Makro tydzień = pon→dziś (nie pełne pn–nd z przyszłymi celami).
  let weekProtein = 0;
  let weekCarbs = 0;
  let weekFat = 0;
  let weekCalories = 0;
  let weekProteinGoal = 0;
  let weekCarbsGoal = 0;
  let weekFatGoal = 0;
  let weekCaloriesGoal = 0;
  let weekGoalDays = 0;
  for (const date of weekKeys) {
    if (date > todayKey) break;
    const agg = aggregates[date];
    weekProtein += agg?.protein ?? 0;
    weekCarbs += agg?.carbs ?? 0;
    weekFat += agg?.fat ?? 0;
    weekCalories += agg?.calories ?? 0;
    const goals = resolveProfileDayGoals(settings, date);
    if (goals?.macroGoals) {
      weekProteinGoal += goals.macroGoals.protein;
      weekCarbsGoal += goals.macroGoals.carbs;
      weekFatGoal += goals.macroGoals.fat;
      weekCaloriesGoal += goals.caloriesGoal;
      weekGoalDays += 1;
    }
  }
  const hasWeekGoals = weekGoalDays > 0;
  const wProtein = round1(weekProtein);
  const wCarbs = round1(weekCarbs);
  const wFat = round1(weekFat);
  const wCalories = Math.round(weekCalories);
  const wProteinGoal = hasWeekGoals ? round1(weekProteinGoal) : null;
  const wCarbsGoal = hasWeekGoals ? round1(weekCarbsGoal) : null;
  const wFatGoal = hasWeekGoals ? round1(weekFatGoal) : null;
  const wCaloriesGoal = hasWeekGoals ? Math.round(weekCaloriesGoal) : null;

  const elapsedWeekDays: Array<{ dateKey: string; day: MacroDaySnapshot }> = [];
  for (const date of weekKeys) {
    if (date > todayKey) break;
    const agg = aggregates[date];
    const goals = resolveProfileDayGoals(settings, date);
    elapsedWeekDays.push({
      dateKey: date,
      day: {
        caloriesConsumed: Math.round(agg?.calories ?? 0),
        caloriesGoal:
          goals != null ? Math.round(goals.caloriesGoal) : null,
        proteinConsumed: round1(agg?.protein ?? 0),
        carbsConsumed: round1(agg?.carbs ?? 0),
        fatConsumed: round1(agg?.fat ?? 0),
        proteinGoal: goals?.macroGoals.protein ?? null,
        carbsGoal: goals?.macroGoals.carbs ?? null,
        fatGoal: goals?.macroGoals.fat ?? null,
      },
    });
  }

  return {
    series,
    today: {
      caloriesConsumed,
      caloriesGoal,
      proteinConsumed,
      carbsConsumed,
      fatConsumed,
      proteinGoal,
      carbsGoal,
      fatGoal,
      proteinRemaining: remainingOrNull(proteinGoal, proteinConsumed),
      carbsRemaining: remainingOrNull(carbsGoal, carbsConsumed),
      fatRemaining: remainingOrNull(fatGoal, fatConsumed),
    },
    week: {
      caloriesConsumed: wCalories,
      caloriesGoal: wCaloriesGoal,
      proteinConsumed: wProtein,
      carbsConsumed: wCarbs,
      fatConsumed: wFat,
      proteinGoal: wProteinGoal,
      carbsGoal: wCarbsGoal,
      fatGoal: wFatGoal,
      proteinRemaining: remainingOrNull(wProteinGoal, wProtein),
      carbsRemaining: remainingOrNull(wCarbsGoal, wCarbs),
      fatRemaining: remainingOrNull(wFatGoal, wFat),
    },
    elapsedWeekDays,
  };
}
