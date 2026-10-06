import { describe, expect, it } from "vitest";
import { englishFoodQueryVariants } from "@/lib/food-query-i18n";
import { mapUsdaFoodToProduct } from "@/lib/food-products-usda";

describe("food-query-i18n", () => {
  it("tłumaczy truskawki → strawberry", () => {
    expect(englishFoodQueryVariants("truskawki")).toContain("strawberry");
    expect(englishFoodQueryVariants("pierś kurczak").length).toBeGreaterThan(0);
  });
});

describe("mapUsdaFoodToProduct", () => {
  it("mapuje makro USDA na 100 g", () => {
    const p = mapUsdaFoodToProduct({
      fdcId: 167762,
      description: "Strawberries, raw",
      foodNutrients: [
        { nutrientId: 1008, nutrientName: "Energy", unitName: "KCAL", value: 32 },
        { nutrientId: 1003, nutrientName: "Protein", value: 0.67 },
        { nutrientId: 1004, nutrientName: "Total lipid (fat)", value: 0.3 },
        { nutrientId: 1005, nutrientName: "Carbohydrate, by difference", value: 7.68 },
      ],
    });
    expect(p).toBeTruthy();
    expect(p!.source).toBe("usda");
    expect(p!.calories).toBe(32);
    expect(p!.proteinG).toBe(0.7);
    expect(p!.basisAmount).toBe(100);
  });
});
