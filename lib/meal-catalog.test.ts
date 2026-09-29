import { describe, expect, it } from "vitest";
import {
  MEAL_CATALOG,
  MEAL_SLOTS,
  MEAL_SLOT_LABELS,
  getCatalogMealById,
  getMealsBySlot,
  mealSlotFromHour,
  pickCatalogMealsForGaps,
} from "@/lib/meal-catalog";
import { MEAL_CATALOG_GENERATED_COUNT } from "@/lib/meal-catalog-data";
import { getRecipeImage } from "@/lib/recipe-image";
import type { MacroGaps } from "@/lib/meal-suggestions-gaps";

const emptyGaps: MacroGaps = {
  dateKey: "2026-09-25",
  caloriesConsumed: 0,
  caloriesGoal: 2200,
  proteinConsumed: 0,
  proteinGoal: 160,
  fatConsumed: 0,
  fatGoal: 70,
  carbsConsumed: 0,
  carbsGoal: 220,
  caloriesRemaining: 2200,
  proteinRemaining: 160,
  fatRemaining: 70,
  carbsRemaining: 220,
  hasAnyMacroGoal: true,
  hasCalorieGoal: true,
};

describe("meal-catalog", () => {
  it("katalog ma 10 przepisów z imagePrompt (bez obrazów w bazie)", () => {
    expect(MEAL_CATALOG_GENERATED_COUNT).toBe(10);
    expect(MEAL_CATALOG).toHaveLength(10);
    for (const meal of MEAL_CATALOG) {
      expect(meal.id).toMatch(/^meal_\d{3}$/);
      expect(meal.imagePrompt?.length).toBeGreaterThan(10);
      expect(meal.approximateMacros.calories).toBeGreaterThan(0);
      expect(MEAL_SLOTS).toContain(meal.slot);
      expect(MEAL_SLOT_LABELS[meal.slot].length).toBeGreaterThan(3);
    }
    expect(getCatalogMealById("meal_003")?.title).toContain("Kurczak");
  });

  it("mapuje godzinę na slot i dobiera posiłki z katalogu", () => {
    expect(mealSlotFromHour(8)).toBe("sniadanie");
    expect(mealSlotFromHour(13)).toBe("obiad");
    expect(mealSlotFromHour(20)).toBe("kolacja");
    expect(getMealsBySlot("sniadanie").length).toBe(2);
    expect(getMealsBySlot("obiad").length).toBe(3);
    const picked = pickCatalogMealsForGaps(emptyGaps, { slot: "obiad", limit: 4 });
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.length).toBeLessThanOrEqual(4);
  });

  it("getRecipeImage używa imagePrompt z przepisu", () => {
    const meal = getCatalogMealById("meal_001");
    expect(meal).toBeTruthy();
    const url = getRecipeImage(meal!);
    expect(url.startsWith("https://image.pollinations.ai/prompt/")).toBe(true);
    expect(url).toContain(encodeURIComponent("healthy oatmeal with blueberries"));
  });
});
