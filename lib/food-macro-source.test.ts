import { describe, expect, it } from "vitest";
import {
  getFoodMacroSourceHint,
  getFoodMacroSourceKind,
  getFoodMacroSourceLabel,
} from "@/lib/food-macro-source";
import type { FoodProduct } from "@/lib/food-products-types";

function product(partial: Partial<FoodProduct> & Pick<FoodProduct, "id" | "source">): FoodProduct {
  return {
    name: "Test",
    barcode: null,
    servingLabel: "100 g",
    calories: 100,
    proteinG: 10,
    fatG: 5,
    carbsG: 8,
    ...partial,
  };
}

describe("food-macro-source", () => {
  it("flags retail PL products as estimate", () => {
    const p = product({ id: "retail-kfc-longer", source: "local" });
    expect(getFoodMacroSourceKind(p)).toBe("retail_estimate");
    expect(getFoodMacroSourceLabel(p)).toMatch(/Szacunek/i);
    expect(getFoodMacroSourceHint(p)).toMatch(/etykiet/i);
  });

  it("keeps Open Food Facts distinct", () => {
    const p = product({ id: "off-1", source: "openfoodfacts" });
    expect(getFoodMacroSourceKind(p)).toBe("openfoodfacts");
    expect(getFoodMacroSourceHint(p)).toBeNull();
  });

  it("oznacza USDA", () => {
    const p = product({ id: "usda-167762", source: "usda" });
    expect(getFoodMacroSourceKind(p)).toBe("usda");
    expect(getFoodMacroSourceLabel(p)).toMatch(/USDA/i);
  });
});