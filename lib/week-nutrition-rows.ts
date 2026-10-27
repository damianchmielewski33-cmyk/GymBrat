import type { FitatuDaySummary } from "@/types/fitatu";
import type { NutritionDayType } from "@/lib/nutrition-goals";
import {
  rollupWeekThroughIndex,
  weekDayIndexThroughToday as weekDayIndexThroughTodayImpl,
  weekRollupPickFromMacros,
} from "@/lib/nutrition-week-stats";

/** Jedna linia tygodnia do podglądu szczegółów (popup). */
export type WeekDayNutritionRow = {
  dateKey: string;
  headline: string;
  caloriesConsumed: number;
  caloriesGoal: number | null;
  proteinConsumed: number;
  proteinGoal: number | null;
  fatConsumed: number;
  fatGoal: number | null;
  carbsConsumed: number;
  carbsGoal: number | null;
  /** Liczba wpisów meal_logs; 0 = brak posiłków (AU-4). */
  entryCount: number;
  /** Typ dnia z profilu; brak klucza w dayTypes = rest. */
  dayType: NutritionDayType;
};

function formatPlDayHeadline(dateKey: string): string {
  const [y, mo, da] = dateKey.split("-").map(Number);
  const dt = new Date(y, mo - 1, da, 12, 0, 0, 0);
  const wd = new Intl.DateTimeFormat("pl-PL", { weekday: "long" }).format(dt);
  const dm = new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
  }).format(dt);
  const dayName = wd.charAt(0).toUpperCase() + wd.slice(1);
  return `${dayName}, ${dm}`;
}

export function buildWeekNutritionRows(
  days: FitatuDaySummary[],
  dayTypes: Record<string, NutritionDayType> = {},
): WeekDayNutritionRow[] {
  return days.map((d) => {
    const mg = d.macroGoals;
    const cg = d.caloriesGoal;
    return {
      dateKey: d.date,
      headline: formatPlDayHeadline(d.date),
      caloriesConsumed: d.caloriesConsumed,
      caloriesGoal:
        cg != null && Number.isFinite(cg) && cg > 0 ? cg : null,
      proteinConsumed: d.macros.protein,
      proteinGoal: mg != null && mg.protein > 0 ? mg.protein : null,
      fatConsumed: d.macros.fat,
      fatGoal: mg != null && mg.fat > 0 ? mg.fat : null,
      carbsConsumed: d.macros.carbs,
      carbsGoal: mg != null && mg.carbs > 0 ? mg.carbs : null,
      entryCount:
        typeof d.entryCount === "number" && Number.isFinite(d.entryCount)
          ? Math.max(0, Math.floor(d.entryCount))
          : d.caloriesConsumed > 0 ||
              d.macros.protein > 0 ||
              d.macros.fat > 0 ||
              d.macros.carbs > 0
            ? 1
            : 0,
      dayType: dayTypes[d.date] ?? "rest",
    };
  });
}

/**
 * Sumy makro od poniedziałku do indeksu dnia (0 = pn … 6 = nd).
 * Spożycie i cele tylko z dni mających cel — bez zawyżania % przez dni bez celu.
 */
export function rollupDayRowsThroughIndex(
  rows: WeekDayNutritionRow[],
  throughIndexInclusive: number,
): {
  sumProteinGoal: number;
  sumProteinConsumed: number;
  sumFatGoal: number;
  sumFatConsumed: number;
  sumCarbsGoal: number;
  sumCarbsConsumed: number;
  sumCaloriesGoal: number;
  sumCaloriesConsumed: number;
} {
  return weekRollupPickFromMacros(
    rollupWeekThroughIndex(rows, throughIndexInclusive),
  );
}

/** Indeks dnia w tygodniu pn→nd dla `todayKey`, albo ostatni dzień gdy poza zakresem. */
export function weekDayIndexThroughToday(
  dayRows: WeekDayNutritionRow[],
  todayKey: string,
): number {
  return weekDayIndexThroughTodayImpl(dayRows, todayKey);
}
