/**
 * Tygodniowe spięcie diety (meal-logi vs cele) z treningiem (tonaż / RPE / RIR).
 */

import { emptyNutritionDaySummary } from "@/lib/empty-nutrition-day";
import {
  buildProgressIntensitySummary,
  type SessionIntensity,
} from "@/lib/intensity-analysis";
import { weekDateKeysMondayFirst } from "@/lib/local-date";
import {
  getMealLogAggregatesForDates,
  replaceConsumptionWithMealLogs,
  type MealDayAggregate,
} from "@/lib/meal-logs";
import {
  buildWeeklyNutritionRollup,
  hasAnyProfileGoals,
  mergeSummaryWithProfileGoals,
  type NutritionSettingsState,
} from "@/lib/nutrition-goals";

export type DietWeekStatus =
  | "on_track"
  | "under"
  | "over"
  | "no_data"
  | "no_goal";

export type ProgressDietTrainingWeek = {
  monday: string;
  label: string;
  /** Dni z wpisem w dzienniku (w oknie ocenianym: do today włącznie). */
  daysLogged: number;
  /** Ile dni wzięto do oceny (7 albo mniej w bieżącym tygodniu). */
  daysInWindow: number;
  caloriesConsumed: number;
  caloriesGoal: number;
  proteinConsumed: number;
  proteinGoal: number;
  /** consumed/goal × 100; null gdy brak celu. */
  calorieAdherencePct: number | null;
  proteinAdherencePct: number | null;
  status: DietWeekStatus;
  tonnageKg: number;
  workouts: number;
  avgRpe: number | null;
  avgRir: number | null;
  hardSetPct: number | null;
};

export type ProgressDietTrainingBlock = {
  hasGoals: boolean;
  /** Bieżący tydzień (poniedziałek = today week). */
  current: ProgressDietTrainingWeek | null;
  /** Ostatnie 8 tygodni, od najnowszego. */
  weeks: ProgressDietTrainingWeek[];
};

const ON_TRACK_MIN = 85;
const ON_TRACK_MAX = 110;

function safeRound1(n: number): number {
  return Math.round(n * 10) / 10;
}

function pctOf(consumed: number, goal: number): number | null {
  if (!(goal > 0) || !Number.isFinite(consumed)) return null;
  return Math.round((consumed / goal) * 100);
}

/**
 * Klasyfikacja tygodnia „w diecie” względem celu kcal.
 * Wymaga ≥3 dni z logami (albo wszystkich dni w krótszym oknie).
 */
export function classifyDietWeekStatus(input: {
  daysLogged: number;
  daysInWindow: number;
  calorieAdherencePct: number | null;
}): DietWeekStatus {
  const { daysLogged, daysInWindow, calorieAdherencePct } = input;
  if (calorieAdherencePct == null) return "no_goal";
  if (daysLogged <= 0) return "no_data";
  const minDays = Math.min(3, Math.max(1, daysInWindow));
  if (daysLogged < minDays) return "no_data";
  if (calorieAdherencePct < ON_TRACK_MIN) return "under";
  if (calorieAdherencePct > ON_TRACK_MAX) return "over";
  return "on_track";
}

export function dietWeekStatusLabel(status: DietWeekStatus): string {
  switch (status) {
    case "on_track":
      return "W diecie";
    case "under":
      return "Poniżej celu";
    case "over":
      return "Powyżej celu";
    case "no_goal":
      return "Brak celów";
    case "no_data":
    default:
      return "Mało danych";
  }
}

export type DietTrainingWeekTrainingInput = {
  tonnageKg: number;
  workouts: number;
  intensitySessions: ReadonlyArray<SessionIntensity>;
};

/**
 * Buduje wiersz tygodnia z rollupu żywienia (już przyciętego do okna) + treningu.
 */
export function buildDietTrainingWeekRow(input: {
  monday: string;
  label: string;
  daysLogged: number;
  daysInWindow: number;
  caloriesConsumed: number;
  caloriesGoal: number;
  proteinConsumed: number;
  proteinGoal: number;
  training: DietTrainingWeekTrainingInput;
}): ProgressDietTrainingWeek {
  const calorieAdherencePct = pctOf(input.caloriesConsumed, input.caloriesGoal);
  const proteinAdherencePct = pctOf(input.proteinConsumed, input.proteinGoal);
  const status = classifyDietWeekStatus({
    daysLogged: input.daysLogged,
    daysInWindow: input.daysInWindow,
    calorieAdherencePct,
  });
  const intensity = buildProgressIntensitySummary(input.training.intensitySessions);

  return {
    monday: input.monday,
    label: input.label,
    daysLogged: input.daysLogged,
    daysInWindow: input.daysInWindow,
    caloriesConsumed: Math.round(input.caloriesConsumed),
    caloriesGoal: Math.round(input.caloriesGoal),
    proteinConsumed: safeRound1(input.proteinConsumed),
    proteinGoal: safeRound1(input.proteinGoal),
    calorieAdherencePct,
    proteinAdherencePct,
    status,
    tonnageKg: safeRound1(input.training.tonnageKg),
    workouts: input.training.workouts,
    avgRpe: intensity.avgRpe,
    avgRir: intensity.avgRir,
    hardSetPct: intensity.hardSetPct,
  };
}

function daySummaryFromMealAgg(
  settings: NutritionSettingsState,
  dateKey: string,
  mealAgg: MealDayAggregate | undefined,
) {
  const raw = emptyNutritionDaySummary(dateKey);
  const withGoals = mergeSummaryWithProfileGoals(raw, settings, dateKey);
  return replaceConsumptionWithMealLogs(withGoals, mealAgg);
}

/**
 * Sumuje tylko dni ≤ today (bieżący tydzień nie karze za przyszłe cele).
 */
export function sumNutritionWindow(input: {
  days: ReadonlyArray<{
    date: string;
    caloriesConsumed: number;
    caloriesGoal?: number;
    macros: { protein: number; fat: number; carbs: number };
    macroGoals?: { protein: number; fat: number; carbs: number };
  }>;
  today: string;
  mealAggs: Record<string, MealDayAggregate | undefined>;
}): {
  daysLogged: number;
  daysInWindow: number;
  caloriesConsumed: number;
  caloriesGoal: number;
  proteinConsumed: number;
  proteinGoal: number;
} {
  let daysLogged = 0;
  let daysInWindow = 0;
  let caloriesConsumed = 0;
  let caloriesGoal = 0;
  let proteinConsumed = 0;
  let proteinGoal = 0;

  for (const d of input.days) {
    if (d.date > input.today) continue;
    daysInWindow += 1;
    const agg = input.mealAggs[d.date];
    if (agg && agg.entryCount > 0) daysLogged += 1;
    caloriesConsumed += d.caloriesConsumed;
    proteinConsumed += d.macros.protein;
    if (d.caloriesGoal != null && Number.isFinite(d.caloriesGoal)) {
      caloriesGoal += d.caloriesGoal;
    }
    if (d.macroGoals) proteinGoal += d.macroGoals.protein;
  }

  return {
    daysLogged,
    daysInWindow,
    caloriesConsumed,
    caloriesGoal,
    proteinConsumed,
    proteinGoal,
  };
}

export async function loadProgressDietTrainingBlock(input: {
  userId: string;
  settings: NutritionSettingsState;
  today: string;
  /** Poniedziałki od najstarszego do bieżącego (jak last8). */
  mondaysOldestFirst: string[];
  weekLabel: (monday: string) => string;
  trainingByMonday: Map<string, DietTrainingWeekTrainingInput>;
}): Promise<ProgressDietTrainingBlock> {
  const { userId, settings, today, mondaysOldestFirst, weekLabel, trainingByMonday } =
    input;

  const allDates = mondaysOldestFirst.flatMap((m) => weekDateKeysMondayFirst(m));
  const mealAggs = await getMealLogAggregatesForDates(userId, [
    ...new Set(allDates),
  ]);

  const loadDay = async (_uid: string, dateKey: string) =>
    daySummaryFromMealAgg(settings, dateKey, mealAggs[dateKey]);

  const weeksNewestFirst: ProgressDietTrainingWeek[] = [];

  for (const monday of [...mondaysOldestFirst].reverse()) {
    const rollup = await buildWeeklyNutritionRollup(
      userId,
      monday,
      settings,
      loadDay,
    );
    const window = sumNutritionWindow({
      days: rollup.days,
      today,
      mealAggs,
    });
    const training = trainingByMonday.get(monday) ?? {
      tonnageKg: 0,
      workouts: 0,
      intensitySessions: [],
    };
    weeksNewestFirst.push(
      buildDietTrainingWeekRow({
        monday,
        label: weekLabel(monday),
        ...window,
        training,
      }),
    );
  }

  const currentMonday = weekDateKeysMondayFirst(today)[0]!;
  const current =
    weeksNewestFirst.find((w) => w.monday === currentMonday) ?? null;

  return {
    hasGoals: hasAnyProfileGoals(settings),
    current,
    weeks: weeksNewestFirst,
  };
}

/** Pomocnicze: pusty blok gdy brak usera / early return. */
export function emptyProgressDietTrainingBlock(): ProgressDietTrainingBlock {
  return { hasGoals: false, current: null, weeks: [] };
}
