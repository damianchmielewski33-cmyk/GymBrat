import { describe, expect, it } from "vitest";
import {
  MEAL_CATALOG,
  MEAL_SLOTS,
  MEAL_SLOT_LABELS,
  getMealsBySlot,
  mealSlotFromHour,
  pickCatalogMealsForGaps,
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
  it("seed w kodzie jest pusty — przepisy tylko z panelu / bazy", () => {
    expect(MEAL_CATALOG_GENERATED_COUNT).toBe(0);
    expect(MEAL_CATALOG).toHaveLength(0);
    for (const slot of MEAL_SLOTS) {
      expect(getMealsBySlot(slot)).toHaveLength(0);
      expect(MEAL_SLOT_LABELS[slot].length).toBeGreaterThan(3);
    }
  });

  it("mapuje godzinę na slot i przy pustym katalogu nie dobiera posiłków", () => {
    expect(mealSlotFromHour(8)).toBe("sniadanie");
    expect(mealSlotFromHour(13)).toBe("obiad");
    expect(mealSlotFromHour(20)).toBe("kolacja");
    const picked = pickCatalogMealsForGaps(emptyGaps, { slot: "obiad", limit: 4 });
    expect(picked).toHaveLength(0);
  });
});
