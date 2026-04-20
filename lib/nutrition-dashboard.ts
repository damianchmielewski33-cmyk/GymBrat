import {
  buildWeeklyNutritionRollup,
  mergeSummaryWithProfileGoals,
  nutritionSettingsFromDbRow,
  weekDateKeysMondayFirst,
  type NutritionSettingsState,
  type NutritionWeekRollup,
} from "@/lib/nutrition-goals";
import {
  getMealLogAggregatesForDates,
  replaceConsumptionWithMealLogs,
  type MealDayAggregate,
} from "@/lib/meal-logs";
import {
  addCalendarDays,
  calendarDateKey,
  formatPlCalendarRange,
} from "@/lib/local-date";
import { buildWeekNutritionRows } from "@/lib/week-nutrition-rows";
import { getFitatuDayCached } from "@/services/fitatu";
import type { FitatuDaySummary } from "@/types/fitatu";

export type NutritionDashboardLoad = {
  todayKey: string;
  today: FitatuDaySummary;
  week: Awaited<ReturnType<typeof buildWeeklyNutritionRollup>>;
  settings: NutritionSettingsState;
};

/** Blok jednego archiwalnego tygodnia w arkuszu „Ten tydzień”. */
export type PreviousWeekNutritionSheetWeek = {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  rollup: Pick<
    NutritionWeekRollup,
    | "sumProteinGoal"
    | "sumProteinConsumed"
    | "sumFatGoal"
    | "sumFatConsumed"
    | "sumCarbsGoal"
    | "sumCarbsConsumed"
    | "sumCaloriesGoal"
    | "sumCaloriesConsumed"
  >;
  dayRows: ReturnType<typeof buildWeekNutritionRows>;
};

const PREVIOUS_WEEKS_IN_SHEET = 8;

export type TodaysNutritionSettingsRow = {
  trainingNutritionGoalsJson: string | null;
  restNutritionGoalsJson: string | null;
  nutritionDayTypesJson: string | null;
};

function applyProfileGoalsAndManualConsumption(
  raw: FitatuDaySummary,
  settings: NutritionSettingsState,
  dateKey: string,
  mealAgg: MealDayAggregate | undefined,
): FitatuDaySummary {
  let row = mergeSummaryWithProfileGoals(raw, settings, dateKey);
  return replaceConsumptionWithMealLogs(row, mealAgg);
}

/** Podsumowanie „dziś” jak na stronie Start: spożycie tylko z ręcznych wpisów, cele z profilu / Fitatu. */
export async function loadTodaysNutritionSummary(
  userId: string,
  settingsRow: TodaysNutritionSettingsRow | undefined,
): Promise<FitatuDaySummary> {
  const settings = nutritionSettingsFromDbRow(
    settingsRow ?? {
      trainingNutritionGoalsJson: null,
      restNutritionGoalsJson: null,
      nutritionDayTypesJson: null,
    },
  );
  const todayKey = calendarDateKey(new Date());
  const mealAggs = await getMealLogAggregatesForDates(userId, [todayKey]);
  const rawToday = await getFitatuDayCached(userId, todayKey);
  return applyProfileGoalsAndManualConsumption(
    rawToday,
    settings,
    todayKey,
    mealAggs[todayKey],
  );
}

/**
 * Tygodnie przed bieżącym (tylko pełne tygodnie kalendarzowe), do rozwinięcia w arkuszu.
 */
export async function loadPreviousWeeksForSheet(
  userId: string,
  settings: NutritionSettingsState,
  todayKey: string,
): Promise<PreviousWeekNutritionSheetWeek[]> {
  const thisMonday = weekDateKeysMondayFirst(todayKey)[0]!;
  const anchors: string[] = [];
  const allDateKeys: string[] = [];
  for (let w = 1; w <= PREVIOUS_WEEKS_IN_SHEET; w++) {
    const monday = addCalendarDays(thisMonday, -7 * w);
    anchors.push(monday);
    allDateKeys.push(...weekDateKeysMondayFirst(monday));
  }
  const uniqueKeys = [...new Set(allDateKeys)];
  const mealAggs = await getMealLogAggregatesForDates(userId, uniqueKeys);

  const loadDay = async (uid: string, dateKey: string) => {
    const raw = await getFitatuDayCached(uid, dateKey);
    return applyProfileGoalsAndManualConsumption(
      raw,
      settings,
      dateKey,
      mealAggs[dateKey],
    );
  };

  const weeksData = await Promise.all(
    anchors.map((mondayKey) =>
      buildWeeklyNutritionRollup(userId, mondayKey, settings, loadDay),
    ),
  );

  return weeksData.map((week) => ({
    weekLabel: formatPlCalendarRange(week.weekStart, week.weekEnd),
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
    rollup: {
      sumProteinGoal: week.sumProteinGoal,
      sumProteinConsumed: week.sumProteinConsumed,
      sumFatGoal: week.sumFatGoal,
      sumFatConsumed: week.sumFatConsumed,
      sumCarbsGoal: week.sumCarbsGoal,
      sumCarbsConsumed: week.sumCarbsConsumed,
      sumCaloriesGoal: week.sumCaloriesGoal,
      sumCaloriesConsumed: week.sumCaloriesConsumed,
    },
    dayRows: buildWeekNutritionRows(week.days),
  }));
}

export async function loadNutritionDashboard(
  userId: string,
  settingsRow: TodaysNutritionSettingsRow | undefined,
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
  const today = applyProfileGoalsAndManualConsumption(
    rawToday,
    settings,
    todayKey,
    mealAggs[todayKey],
  );

  const week = await buildWeeklyNutritionRollup(
    userId,
    todayKey,
    settings,
    async (uid, dateKey) => {
      const raw = await getFitatuDayCached(uid, dateKey);
      return applyProfileGoalsAndManualConsumption(
        raw,
        settings,
        dateKey,
        mealAggs[dateKey],
      );
    },
  );
  return { todayKey, today, week, settings };
}
