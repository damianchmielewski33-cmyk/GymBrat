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
import { emptyNutritionDaySummary } from "@/lib/empty-nutrition-day";
import {
  addCalendarDays,
  calendarDateKey,
  formatPlCalendarRange,
} from "@/lib/local-date";
import { buildWeekNutritionRows } from "@/lib/week-nutrition-rows";
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
/** Bieżący + tyle pełnych tygodni wstecz (ok. rok historii na ekranie makro). */
export const NUTRITION_WEEK_HISTORY_PAST_WEEKS = 52;

export type TodaysNutritionSettingsRow = {
  trainingNutritionGoalsJson: string | null;
  restNutritionGoalsJson: string | null;
  nutritionDayTypesJson: string | null;
};

function weekSheetFromRollup(
  week: NutritionWeekRollup,
): PreviousWeekNutritionSheetWeek {
  return {
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
  };
}

function applyProfileGoalsAndManualConsumption(
  settings: NutritionSettingsState,
  dateKey: string,
  mealAgg: MealDayAggregate | undefined,
): FitatuDaySummary {
  const raw = emptyNutritionDaySummary(dateKey);
  const row = mergeSummaryWithProfileGoals(raw, settings, dateKey);
  return replaceConsumptionWithMealLogs(row, mealAgg);
}

/** Podsumowanie „dziś”: spożycie z wpisów posiłków, cele z profilu. */
export async function loadTodaysNutritionSummary(
  userId: string,
  settingsRow: TodaysNutritionSettingsRow | undefined,
): Promise<FitatuDaySummary> {
  return loadNutritionSummaryForDate(
    userId,
    calendarDateKey(new Date()),
    settingsRow,
  );
}

/** Podsumowanie dowolnego dnia: spożycie z meal_logs, cele wg typu dnia w profilu. */
export async function loadNutritionSummaryForDate(
  userId: string,
  dateKey: string,
  settingsRow: TodaysNutritionSettingsRow | undefined,
): Promise<FitatuDaySummary> {
  const settings = nutritionSettingsFromDbRow(
    settingsRow ?? {
      trainingNutritionGoalsJson: null,
      restNutritionGoalsJson: null,
      nutritionDayTypesJson: null,
    },
  );
  const mealAggs = await getMealLogAggregatesForDates(userId, [dateKey]);
  return applyProfileGoalsAndManualConsumption(
    settings,
    dateKey,
    mealAggs[dateKey],
  );
}

export function resolveNutritionDayKind(
  settingsRow: TodaysNutritionSettingsRow | undefined,
  dateKey: string,
): "training" | "rest" {
  const settings = nutritionSettingsFromDbRow(
    settingsRow ?? {
      trainingNutritionGoalsJson: null,
      restNutritionGoalsJson: null,
      nutritionDayTypesJson: null,
    },
  );
  return settings.dayTypes[dateKey] ?? "rest";
}

/** Czy użytkownik ręcznie oznaczył typ dnia (nie „domyślnie”). */
export function hasExplicitNutritionDayKind(
  settingsRow: TodaysNutritionSettingsRow | undefined,
  dateKey: string,
): boolean {
  const settings = nutritionSettingsFromDbRow(
    settingsRow ?? {
      trainingNutritionGoalsJson: null,
      restNutritionGoalsJson: null,
      nutritionDayTypesJson: null,
    },
  );
  return (
    settings.dayTypes[dateKey] === "training" ||
    settings.dayTypes[dateKey] === "rest"
  );
}

/**
 * Tygodnie od bieżącego wstecz (pn→nd), najnowszy pierwszy.
 * `pastWeeks` = ile pełnych tygodni przed bieżącym (domyślnie ~rok).
 */
export async function loadNutritionWeekHistory(
  userId: string,
  settings: NutritionSettingsState,
  todayKey: string,
  pastWeeks: number = NUTRITION_WEEK_HISTORY_PAST_WEEKS,
): Promise<PreviousWeekNutritionSheetWeek[]> {
  const thisMonday = weekDateKeysMondayFirst(todayKey)[0]!;
  const anchors: string[] = [];
  const allDateKeys: string[] = [];
  for (let w = 0; w <= pastWeeks; w++) {
    const monday = addCalendarDays(thisMonday, -7 * w);
    anchors.push(monday);
    allDateKeys.push(...weekDateKeysMondayFirst(monday));
  }
  const uniqueKeys = [...new Set(allDateKeys)];
  const mealAggs = await getMealLogAggregatesForDates(userId, uniqueKeys);

  const loadDay = async (_uid: string, dateKey: string) =>
    applyProfileGoalsAndManualConsumption(
      settings,
      dateKey,
      mealAggs[dateKey],
    );

  const weeksData = await Promise.all(
    anchors.map((mondayKey) =>
      buildWeeklyNutritionRollup(userId, mondayKey, settings, loadDay),
    ),
  );

  return weeksData.map(weekSheetFromRollup);
}

/**
 * Tygodnie przed bieżącym (tylko pełne tygodnie kalendarzowe), do rozwinięcia w arkuszu.
 */
export async function loadPreviousWeeksForSheet(
  userId: string,
  settings: NutritionSettingsState,
  todayKey: string,
  count: number = PREVIOUS_WEEKS_IN_SHEET,
): Promise<PreviousWeekNutritionSheetWeek[]> {
  const history = await loadNutritionWeekHistory(
    userId,
    settings,
    todayKey,
    count,
  );
  return history.slice(1);
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

  const today = applyProfileGoalsAndManualConsumption(
    settings,
    todayKey,
    mealAggs[todayKey],
  );

  const week = await buildWeeklyNutritionRollup(
    userId,
    todayKey,
    settings,
    async (_uid, dateKey) =>
      applyProfileGoalsAndManualConsumption(
        settings,
        dateKey,
        mealAggs[dateKey],
      ),
  );
  return { todayKey, today, week, settings };
}
