import { describe, expect, it } from "vitest";
import {
  buildMealPlanRows,
  computeMealScaleFactor,
  filterCatalogForMealPlan,
  recipeDifficulty,
  recipeTaste,
  scaleIngredientLine,
  scaleMealToPlanTarget,
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
  it("buduje 5 wierszy ze slotów gdy brak szablonów", () => {
    const rows = buildMealPlanRows([], {
      proteinGoal: 200,
      carbsGoal: 260,
      fatGoal: 50,
      caloriesGoal: 2290,
    });
    expect(rows).toHaveLength(5);
    expect(rows[0]!.label).toBe("Śniadanie");
    expect(rows.reduce((s, r) => s + r.proteinG, 0)).toBeGreaterThan(150);
  });

  it("używa szablonów z profilu (max 5)", () => {
    const rows = buildMealPlanRows(
      [
        {
          id: "t1",
          name: "Posiłek 1",
          calories: 330,
          proteinG: 40,
          carbsG: 20,
          fatG: 10,
        },
        {
          id: "t2",
          name: "Posiłek 2",
          calories: 400,
          proteinG: 35,
          carbsG: 40,
          fatG: 12,
        },
      ],
      { proteinGoal: null, carbsGoal: null, fatGoal: null, caloriesGoal: null },
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]!.proteinG).toBe(40);
    expect(rows[0]!.carbsG).toBe(20);
    expect(rows[0]!.fatG).toBe(10);
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

  it("skaluje gramaturę składnika", () => {
    expect(scaleIngredientLine("200 g kurczak", 0.5)).toBe("100 g kurczak");
    expect(scaleIngredientLine("1,5 kg ryż", 2)).toMatch(/3\s*kg/i);
  });

  it("skaluje przepis do celu makro posiłku", () => {
    const m = meal({
      id: "a",
      title: "Kurczak",
      approximateMacros: { calories: 330, proteinG: 40, carbsG: 20, fatG: 10 },
      ingredients: ["200 g kurczak", "50 g ryż"],
    });
    const proposal = scaleMealToPlanTarget(m, {
      proteinG: 20,
      carbsG: 10,
      fatG: 5,
      calories: 165,
      catalogSlot: "podwieczorek",
    });
    expect(proposal.scale).toBeCloseTo(0.5, 1);
    expect(proposal.scaledMacros.proteinG).toBeCloseTo(20, 0);
    expect(proposal.scaledIngredients[0]).toMatch(/^100\s*g/i);
  });

  it("filtruje i zwraca przeskalowane propozycje bliskie celowi", () => {
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
          approximateMacros: { calories: 900, proteinG: 90, carbsG: 80, fatG: 30 },
          ingredients: ["kurczak", "ryż"],
        }),
      ],
      row: rows[0]!,
      query: "",
      difficulty: "all",
      taste: "sweet",
    });
    expect(list.map((p) => p.meal.id)).toEqual(["a"]);
    expect(list[0]!.scaledMacros.proteinG).toBeGreaterThan(0);
  });

  it("preferuje skalę pod białko przy mieszanym celu", () => {
    const m = meal({
      id: "x",
      title: "Mix",
      approximateMacros: { calories: 400, proteinG: 20, carbsG: 40, fatG: 10 },
    });
    const scale = computeMealScaleFactor(m, {
      proteinG: 40,
      carbsG: 20,
      fatG: 10,
      calories: 330,
    });
    expect(scale).toBeGreaterThan(1.2);
    expect(scale).toBeLessThanOrEqual(2.5);
  });
});
