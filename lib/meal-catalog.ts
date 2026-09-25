import type { MealSuggestionItem } from "@/lib/meal-suggestions-schema";
import { MEAL_CATALOG_GENERATED } from "@/lib/meal-catalog-data";
import type { MacroGaps } from "@/lib/meal-suggestions-gaps";
import type { CatalogMeal, MealSlot } from "@/lib/meal-catalog-types";

export type { CatalogMeal, MealSlot } from "@/lib/meal-catalog-types";

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  sniadanie: "Śniadanie",
  drugie_sniadanie: "Drugie śniadanie",
  obiad: "Obiad",
  podwieczorek: "Podwieczorek",
  kolacja: "Kolacja",
};

export const MEAL_SLOTS: MealSlot[] = [
  "sniadanie",
  "drugie_sniadanie",
  "obiad",
  "podwieczorek",
  "kolacja",
];

/** Godzina kalendarza żywienia → domyślny slot. */
export function mealSlotFromHour(hour: number): MealSlot {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 10) return "sniadanie";
  if (h >= 10 && h < 12) return "drugie_sniadanie";
  if (h >= 12 && h < 15) return "obiad";
  if (h >= 15 && h < 18) return "podwieczorek";
  return "kolacja";
}

export const MEAL_CATALOG: CatalogMeal[] = MEAL_CATALOG_GENERATED;

export function getMealsBySlot(slot: MealSlot): CatalogMeal[] {
  return MEAL_CATALOG.filter((m) => m.slot === slot);
}

export function getCatalogMealById(id: string): CatalogMeal | undefined {
  return MEAL_CATALOG.find((m) => m.id === id);
}

function scoreMealForGaps(meal: CatalogMeal, gaps: MacroGaps): number {
  const m = meal.approximateMacros;
  let score = 0;
  const pr = gaps.proteinRemaining;
  const cr = gaps.carbsRemaining;
  const fr = gaps.fatRemaining;
  const kr = gaps.caloriesRemaining;

  if (pr != null && pr > 0) {
    score += Math.max(0, 40 - Math.abs(m.proteinG - Math.min(pr, 45)));
  } else {
    score += Math.min(m.proteinG, 35);
  }
  if (cr != null && cr > 0) {
    score += Math.max(0, 25 - Math.abs(m.carbsG - Math.min(cr, 60)) * 0.4);
  }
  if (fr != null && fr > 0) {
    score += Math.max(0, 15 - Math.abs(m.fatG - Math.min(fr, 25)) * 0.5);
  }
  if (kr != null && kr > 0 && m.calories > kr + 80) {
    score -= 30;
  }
  if (meal.prepMinutes <= 15) score += 5;
  return score;
}

/** Propozycje z katalogu dopasowane do pory i braków makro. */
export function pickCatalogMealsForGaps(
  gaps: MacroGaps,
  opts?: { slot?: MealSlot; hour?: number; limit?: number },
): CatalogMeal[] {
  const limit = opts?.limit ?? 4;
  const slot = opts?.slot ?? mealSlotFromHour(opts?.hour ?? new Date().getHours());
  const pool = getMealsBySlot(slot);
  const ranked = [...pool].sort(
    (a, b) => scoreMealForGaps(b, gaps) - scoreMealForGaps(a, gaps),
  );
  const picked: CatalogMeal[] = [];
  const usedTitles = new Set<string>();
  for (const meal of ranked) {
    if (usedTitles.has(meal.title)) continue;
    usedTitles.add(meal.title);
    picked.push(meal);
    if (picked.length >= limit) break;
  }
  if (picked.length < limit) {
    for (const meal of MEAL_CATALOG) {
      if (usedTitles.has(meal.title)) continue;
      picked.push(meal);
      usedTitles.add(meal.title);
      if (picked.length >= limit) break;
    }
  }
  return picked;
}

export function catalogMealToSuggestion(meal: CatalogMeal): MealSuggestionItem {
  return {
    title: meal.title,
    tagline: meal.tagline,
    ingredients: meal.ingredients,
    steps: meal.steps,
    approximateMacros: meal.approximateMacros,
    imagePromptEn: meal.imagePromptEn,
  };
}
