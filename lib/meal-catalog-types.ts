import type { MealSuggestionItem } from "@/lib/meal-suggestions-schema";

/** Pory posiłków w planie żywieniowym GymBrat. */
export type MealSlot =
  | "sniadanie"
  | "drugie_sniadanie"
  | "obiad"
  | "podwieczorek"
  | "kolacja";

export type CatalogMeal = MealSuggestionItem & {
  id: string;
  slot: MealSlot;
  prepMinutes: number;
};
