import type { FitatuDaySummary, FitatuMacroGrams } from "@/types/fitatu";
import { kcalFromMacros } from "@/lib/kcal-from-macros";
import { weekDateKeysMondayFirst } from "@/lib/local-date";
import { buildWeekNutritionRows } from "@/lib/week-nutrition-rows";
import { rollupMacroWindow } from "@/lib/nutrition-week-stats";

export { weekDateKeysMondayFirst };

/** Cele makroskładników zapisane w profilu (JSON w user_settings). */
export type NutritionGoalsPayload = {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
};

export type NutritionDayType = "training" | "rest";

export type NutritionSettingsState = {
  training: NutritionGoalsPayload | null;
  rest: NutritionGoalsPayload | null;
  /** Brak klucza = dzień nietreningowy (rest). */
  dayTypes: Record<string, NutritionDayType>;
};

function parseGoals(raw: string | null): NutritionGoalsPayload | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const proteinG = Number(o.proteinG);
    const fatG = Number(o.fatG);
    const carbsG = Number(o.carbsG);
    if (
      !Number.isFinite(proteinG) ||
      proteinG < 0 ||
      !Number.isFinite(fatG) ||
      fatG < 0 ||
      !Number.isFinite(carbsG) ||
      carbsG < 0
    ) {
      return null;
    }
    const kcal = kcalFromMacros(proteinG, fatG, carbsG);
    if (kcal <= 0) return null;
    return { calories: kcal, proteinG, fatG, carbsG };
  } catch {
    return null;
  }
}

function parseDayTypes(raw: string | null): Record<string, NutritionDayType> {
  if (!raw?.trim()) return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, NutritionDayType> = {};
    for (const [k, v] of Object.entries(o)) {
      if (v === "training" || v === "rest") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function nutritionSettingsFromDbRow(row: {
  trainingNutritionGoalsJson: string | null;
  restNutritionGoalsJson: string | null;
  nutritionDayTypesJson: string | null;
}): NutritionSettingsState {
  return {
    training: parseGoals(row.trainingNutritionGoalsJson),
    rest: parseGoals(row.restNutritionGoalsJson),
    dayTypes: parseDayTypes(row.nutritionDayTypesJson),
  };
}

/** Użytkownik skonfigurował przynajmniej jeden komplet celów (trening lub odpoczynek). */
export function hasAnyProfileGoals(settings: NutritionSettingsState): boolean {
  return settings.training != null || settings.rest != null;
}

function payloadToMacroGoals(p: NutritionGoalsPayload): FitatuMacroGrams {
  return {
    protein: p.proteinG,
    fat: p.fatG,
    carbs: p.carbsG,
  };
}

/**
 * Zwraca cele z profilu dla danego dnia, jeśli dla danego typu dnia (trening/rest)
 * istnieje poprawny zestaw — w przeciwnym razie null (wtedy UI może użyć celów z Fitatu).
 */
export function resolveProfileDayGoals(
  settings: NutritionSettingsState,
  dateKey: string,
): { caloriesGoal: number; macroGoals: FitatuMacroGrams } | null {
  const kind = settings.dayTypes[dateKey] ?? "rest";
  const primary = kind === "training" ? settings.training : settings.rest;
  if (primary) {
    return {
      caloriesGoal: primary.calories,
      macroGoals: payloadToMacroGoals(primary),
    };
  }
  /** Brak celów dla danego typu dnia — użyj drugiego zestawu zamiast celów z Fitatu/mock. */
  const fallback = kind === "training" ? settings.rest : settings.training;
  if (!fallback) return null;
  return {
    caloriesGoal: fallback.calories,
    macroGoals: payloadToMacroGoals(fallback),
  };
}

/** Nadpisuje cele dzienne wartościami z profilu, gdy są dostępne dla typu dnia. */
export function mergeSummaryWithProfileGoals(
  summary: FitatuDaySummary,
  settings: NutritionSettingsState,
  dateKey: string,
): FitatuDaySummary {
  const resolved = resolveProfileDayGoals(settings, dateKey);
  if (!resolved) return summary;
  return {
    ...summary,
    caloriesGoal: resolved.caloriesGoal,
    macroGoals: resolved.macroGoals,
  };
}

export type NutritionWeekRollup = {
  weekStart: string;
  weekEnd: string;
  anchorDate: string;
  /** Zmergowane podsumowania per dzień (cele z profilu jeśli ustawione). */
  days: FitatuDaySummary[];
  sumCaloriesGoal: number;
  sumCaloriesConsumed: number;
  sumProteinGoal: number;
  sumProteinConsumed: number;
  sumCarbsGoal: number;
  sumCarbsConsumed: number;
  sumFatGoal: number;
  sumFatConsumed: number;
};

/**
 * Agreguje tydzień: dla każdego dnia wywołuje `loadDay(userId, date)` (powinno być cache’owane),
 * scala cele i spożycie.
 */
export async function buildWeeklyNutritionRollup(
  userId: string,
  anchorDateKey: string,
  settings: NutritionSettingsState,
  loadDay: (userId: string, dateKey: string) => Promise<FitatuDaySummary>,
): Promise<NutritionWeekRollup> {
  const keys = weekDateKeysMondayFirst(anchorDateKey);
  const days: FitatuDaySummary[] = [];
  for (const dateKey of keys) {
    const raw = await loadDay(userId, dateKey);
    days.push(mergeSummaryWithProfileGoals(raw, settings, dateKey));
  }

  // ADR 0005: wspólna funkcja rollupMacroWindow — cel całego tygodnia
  // (includeFutureDays), dziś zawsze z celem; dni bez wpisów wykluczone.
  const rows = buildWeekNutritionRows(days, settings.dayTypes);
  const todayKey = anchorDateKey;
  const cal = rollupMacroWindow(rows, todayKey, "calories", {
    includeFutureDays: true,
    includeInProgressGoal: "always",
  });
  const pro = rollupMacroWindow(rows, todayKey, "protein", {
    includeFutureDays: true,
    includeInProgressGoal: "always",
  });
  const carb = rollupMacroWindow(rows, todayKey, "carbs", {
    includeFutureDays: true,
    includeInProgressGoal: "always",
  });
  const fat = rollupMacroWindow(rows, todayKey, "fat", {
    includeFutureDays: true,
    includeInProgressGoal: "always",
  });

  return {
    weekStart: keys[0]!,
    weekEnd: keys[6]!,
    anchorDate: anchorDateKey,
    days,
    sumCaloriesGoal: cal.goal ?? 0,
    sumCaloriesConsumed: cal.consumed,
    sumProteinGoal: pro.goal ?? 0,
    sumProteinConsumed: pro.consumed,
    sumCarbsGoal: carb.goal ?? 0,
    sumCarbsConsumed: carb.consumed,
    sumFatGoal: fat.goal ?? 0,
    sumFatConsumed: fat.consumed,
  };
}
