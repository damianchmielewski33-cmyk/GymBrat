import type { FitatuDaySummary } from "@/types/fitatu";

/** Pusty dzień żywienia — spożycie uzupełniają wyłącznie lokalne meal_logs. */
export function emptyNutritionDaySummary(date: string): FitatuDaySummary {
  return {
    date,
    caloriesConsumed: 0,
    macros: { protein: 0, fat: 0, carbs: 0 },
    meals: [],
    source: "unavailable",
  };
}
