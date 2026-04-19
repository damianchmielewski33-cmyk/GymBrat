import {
  buildWeeklyNutritionRollup,
  mergeSummaryWithProfileGoals,
  nutritionSettingsFromDbRow,
  weekDateKeysMondayFirst,
  type NutritionSettingsState,
} from "@/lib/nutrition-goals";
import {
  getMealLogAggregatesForDates,
  mergeMealLogsIntoSummary,
  replaceConsumptionWithMealLogs,
} from "@/lib/meal-logs";
import { calendarDateKey } from "@/lib/local-date";
import { getFitatuDayCached } from "@/services/fitatu";
import type { FitatuDaySummary } from "@/types/fitatu";

export type NutritionDashboardLoad = {
  todayKey: string;
  today: FitatuDaySummary;
  week: Awaited<ReturnType<typeof buildWeeklyNutritionRollup>>;
  settings: NutritionSettingsState;
};

export async function loadNutritionDashboard(
  userId: string,
  settingsRow: {
    trainingNutritionGoalsJson: string | null;
    restNutritionGoalsJson: string | null;
    nutritionDayTypesJson: string | null;
  } | undefined,
): Promise<NutritionDashboardLoad> {
  const settings = nutritionSettingsFromDbRow(
    settingsRow ?? {
      trainingNutritionGoalsJson: null,
      restNutritionGoalsJson: null,
      nutritionDayTypesJson: null,
    },
  );
  const todayKey = calendarDateKey(new Date());
  const weekKeys = weekDateKeysMondayFirst(todayKey);
  const dateKeysForMeals = [...new Set([todayKey, ...weekKeys])];
  const mealAggs = await getMealLogAggregatesForDates(userId, dateKeysForMeals);

  const rawToday = await getFitatuDayCached(userId, todayKey);
  let today = mergeSummaryWithProfileGoals(rawToday, settings, todayKey);
  today = mergeMealLogsIntoSummary(today, mealAggs[todayKey]);

  const week = await buildWeeklyNutritionRollup(
    userId,
    todayKey,
    settings,
    async (uid, dateKey) => {
      const raw = await getFitatuDayCached(uid, dateKey);
      let row = mergeSummaryWithProfileGoals(raw, settings, dateKey);
      row = replaceConsumptionWithMealLogs(row, mealAggs[dateKey]);
      return row;
    },
  );
  return { todayKey, today, week, settings };
}
