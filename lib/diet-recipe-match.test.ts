import { describe, expect, it } from "vitest";
import {
  buildMealPlanRows,
  filterCatalogForMealPlan,
  recipeDifficulty,
  recipeTaste,
} from "@/lib/diet-recipe-match";
import type { CatalogMeal } from "@/lib/meal-catalog-types";

function meal(partial: Partial<CatalogMeal> & Pick<CatalogMeal, "id" | "title">): CatalogMeal {
  return {
    slot: "podwieczorek",
    prepMinutes: 10,
    ingredients: ["a", "b"],
    steps: ["1", "2"],
    approximateMacros: { calories: 310, proteinG: 34, carbsG: 29, fatG: 3 },
    ...partial,
  };
}

describe("diet-recipe-match", () => {
  it("buduje wiersze ze slotów gdy brak szablonów", () => {
    const rows = buildMealPlanRows([], {
      proteinGoal: 200,
      carbsGoal: 260,
      fatGoal: 50,
      caloriesGoal: 2290,
    });
    expect(rows).toHaveLength(6);
    expect(rows[0]!.label).toBe("Śniadanie");
    expect(rows.reduce((s, r) => s + r.proteinG, 0)).toBeGreaterThan(150);
  });

  it("mapuje kisiel jako słodki i łatwy", () => {
    const m = meal({
      id: "meal_071",
      title: "Kisiel Proteinowy Deluxe",
      prepMinutes: 10,
      ingredients: ["kisiel", "białko", "truskawki"],
    });
    expect(recipeTaste(m)).toBe("sweet");
    expect(recipeDifficulty(m.prepMinutes)).toBe(1);
  });

  it("filtruje po celu makro i smaku", () => {
    const rows = buildMealPlanRows(
      [
        {
          id: "t1",
          name: "Posiłek 1",
          calories: 310,
          proteinG: 34,
          carbsG: 29,
          fatG: 3,
        },
      ],
      { proteinGoal: null, carbsGoal: null, fatGoal: null, caloriesGoal: null },
    );
    const list = filterCatalogForMealPlan({
      meals: [
        meal({ id: "a", title: "Kisiel", ingredients: ["kisiel", "truskawki"] }),
        meal({
          id: "b",
          title: "Kurczak z ryżem",
          slot: "obiad",
          prepMinutes: 40,
          approximateMacros: { calories: 500, proteinG: 40, carbsG: 50, fatG: 12 },
          ingredients: ["kurczak", "ryż"],
        }),
      ],
      row: rows[0]!,
      query: "",
      difficulty: "all",
      taste: "sweet",
    });
    expect(list.map((m) => m.id)).toEqual(["a"]);
  });
});
