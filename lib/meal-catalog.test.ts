import { describe, expect, it } from "vitest";
import {
  MEAL_CATALOG,
  MEAL_SLOTS,
  MEAL_SLOT_LABELS,
  getMealsBySlot,
  mealSlotFromHour,
  pickCatalogMealsForGaps,
  catalogMealToSuggestion,
} from "@/lib/meal-catalog";
import { MEAL_CATALOG_GENERATED_COUNT } from "@/lib/meal-catalog-data";
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
  it("ma unikalne posiłki we wszystkich slotach (bez klonów kombinatorów)", () => {
    expect(MEAL_CATALOG_GENERATED_COUNT).toBeGreaterThanOrEqual(70);
    expect(MEAL_CATALOG.length).toBe(MEAL_CATALOG_GENERATED_COUNT);
    const ids = new Set(MEAL_CATALOG.map((m) => m.id));
    expect(ids.size).toBe(MEAL_CATALOG.length);
    const titles = new Set(MEAL_CATALOG.map((m) => m.title.toLowerCase()));
    expect(titles.size).toBe(MEAL_CATALOG.length);
    for (const slot of MEAL_SLOTS) {
      expect(getMealsBySlot(slot).length).toBeGreaterThanOrEqual(10);
      expect(MEAL_SLOT_LABELS[slot].length).toBeGreaterThan(3);
    }
    // Brak typowych klonów „jajecznica z dodatkiem: …”
    const cloneish = MEAL_CATALOG.filter((m) =>
      /jajecznica z .* z dodatkiem:/i.test(m.title),
    );
    expect(cloneish.length).toBe(0);
  });

  it("każdy posiłek ma makro, składniki, przepis i prompt grafiki", () => {
    const sample = MEAL_CATALOG[0]!;
    expect(sample.ingredients.length).toBeGreaterThanOrEqual(2);
    expect(sample.steps.length).toBeGreaterThanOrEqual(2);
    expect(sample.approximateMacros.calories).toBeGreaterThan(0);
    expect((sample.imagePromptEn ?? "").length).toBeGreaterThan(5);
    expect(catalogMealToSuggestion(sample).title).toBe(sample.title);
  });

  it("mapuje godzinę na slot i dobiera posiłki do braków makro", () => {
    expect(mealSlotFromHour(8)).toBe("sniadanie");
    expect(mealSlotFromHour(13)).toBe("obiad");
    expect(mealSlotFromHour(20)).toBe("kolacja");
    const picked = pickCatalogMealsForGaps(emptyGaps, { slot: "obiad", limit: 4 });
    expect(picked).toHaveLength(4);
    expect(picked.every((m) => m.slot === "obiad")).toBe(true);
  });
});
