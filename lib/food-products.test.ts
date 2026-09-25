import { describe, expect, it } from "vitest";
import {
  DIET_DIARY_SLOTS,
  DIET_DIARY_SLOT_LABELS,
  dietDiarySlotFromHour,
  isDietDiarySlot,
} from "@/lib/diet-diary-slots";
import {
  findLocalProductByBarcode,
  mapOpenFoodFactsProduct,
  normalizeFoodQuery,
  searchLocalProducts,
} from "@/lib/food-products";
import { FOOD_PRODUCTS_LOCAL } from "@/lib/food-products-data";
import { defaultPortionForProduct, scaleFoodMacros } from "@/lib/food-portion";
import {
  buildNutritionRows,
  carbohydrateExchanges,
  classifyIngredient,
  formatFoodDisplayName,
  formatNutrientValue,
  gymbratNutritionScore,
  proteinFatExchanges,
  splitIngredients,
} from "@/lib/food-nutrition";

describe("diet-diary-slots", () => {
  it("ma 6 sekcji Fitatu z polskimi etykietami", () => {
    expect(DIET_DIARY_SLOTS).toHaveLength(6);
    expect(DIET_DIARY_SLOT_LABELS.sniadanie).toBe("Śniadanie");
    expect(DIET_DIARY_SLOT_LABELS.drugie_sniadanie).toBe("II Śniadanie");
    expect(DIET_DIARY_SLOT_LABELS.lunch).toBe("Lunch");
    expect(DIET_DIARY_SLOT_LABELS.przekaska).toBe("Przekąska");
    expect(DIET_DIARY_SLOT_LABELS.kolacja).toBe("Kolacja");
    expect(isDietDiarySlot("obiad")).toBe(true);
    expect(isDietDiarySlot("kolacja")).toBe(true);
  });

  it("mapuje godzinę na sekcję", () => {
    expect(dietDiarySlotFromHour(8)).toBe("sniadanie");
    expect(dietDiarySlotFromHour(11)).toBe("drugie_sniadanie");
    expect(dietDiarySlotFromHour(13)).toBe("lunch");
    expect(dietDiarySlotFromHour(16)).toBe("obiad");
    expect(dietDiarySlotFromHour(19)).toBe("przekaska");
    expect(dietDiarySlotFromHour(22)).toBe("kolacja");
  });
});

describe("food-products local db", () => {
  it("ma produkty z makro i unikalnymi id", () => {
    expect(FOOD_PRODUCTS_LOCAL.length).toBeGreaterThanOrEqual(30);
    const ids = new Set(FOOD_PRODUCTS_LOCAL.map((p) => p.id));
    expect(ids.size).toBe(FOOD_PRODUCTS_LOCAL.length);
    for (const p of FOOD_PRODUCTS_LOCAL) {
      expect(p.proteinG + p.fatG + p.carbsG + p.calories).toBeGreaterThanOrEqual(0);
    }
  });

  it("szuka po nazwie i kodzie EAN", () => {
    const jogurt = searchLocalProducts("jogurt");
    expect(jogurt.some((p) => /jogurt/i.test(p.name))).toBe(true);
    const withCode = FOOD_PRODUCTS_LOCAL.find((p) => p.barcode);
    expect(withCode).toBeTruthy();
    expect(findLocalProductByBarcode(withCode!.barcode!)!.id).toBe(withCode!.id);
  });

  it("znajduje kiwi po wpisaniu z klawiatury", () => {
    const hits = searchLocalProducts("kiwi");
    expect(hits.some((p) => /kiwi/i.test(p.name))).toBe(true);
    expect(normalizeFoodQuery("Jabłko")).toBe("jablko");
    expect(searchLocalProducts("jablko").some((p) => /jabł/i.test(p.name))).toBe(true);
  });

  it("banan i kiwi mają szczegóły odżywcze", () => {
    const banan = searchLocalProducts("banan")[0]!;
    expect(banan.details?.sugarsG).toBeGreaterThan(0);
    expect(banan.details?.fiberG).toBeGreaterThan(0);
    const kiwi = searchLocalProducts("kiwi")[0]!;
    expect(kiwi.details?.vitaminCMg).toBeGreaterThan(50);
  });
});

describe("food-portion", () => {
  it("skaluje makro z 100 g na 200 g", () => {
    const kiwi = searchLocalProducts("kiwi")[0]!;
    const m = scaleFoodMacros(kiwi, 200, "g");
    expect(m.calories).toBe(Math.round(kiwi.calories * 2));
    expect(m.proteinG).toBeCloseTo(kiwi.proteinG * 2, 5);
  });

  it("skaluje sztuki przez gramsPerPiece", () => {
    const kiwi = searchLocalProducts("kiwi")[0]!;
    expect(kiwi.gramsPerPiece).toBeTruthy();
    const one = scaleFoodMacros(kiwi, 1, "pcs");
    expect(one.effectiveGrams).toBe(kiwi.gramsPerPiece);
    expect(one.calories).toBe(
      Math.round(kiwi.calories * (kiwi.gramsPerPiece! / 100)),
    );
  });

  it("domyślna porcja OFF to 100 g", () => {
    const mapped = mapOpenFoodFactsProduct(
      {
        product_name: "Test",
        nutriments: {
          "energy-kcal_100g": 100,
          proteins_100g: 10,
          fat_100g: 5,
          carbohydrates_100g: 8,
        },
      },
      "5900000000000",
    )!;
    expect(mapped.servingLabel).toBe("100 g");
    expect(defaultPortionForProduct(mapped)).toEqual({ amount: 100, unit: "g" });
  });
});

describe("food-nutrition", () => {
  it("liczy WW i WBT", () => {
    expect(carbohydrateExchanges(21.8)).toBe(2.2);
    expect(proteinFatExchanges(17, 18)).toBe(2.3);
  });

  it("klasyfikuje składniki i dzieli tekst", () => {
    expect(classifyIngredient("Mleko pasteryzowane")).toBe("healthy");
    expect(classifyIngredient("Sól")).toBe("harmful");
    expect(classifyIngredient("Kwas cytrynowy")).toBe("safe");
    expect(splitIngredients("Mleko, woda, sól")).toEqual(["Mleko", "woda", "sól"]);
  });

  it("składa pełną nazwę marka + produkt", () => {
    expect(
      formatFoodDisplayName({
        productNamePl: "Twaróg chudy",
        brands: "Piątnica",
      }),
    ).toBe("Piątnica Twaróg chudy");
    expect(
      formatFoodDisplayName({
        productName: "Piątnica Twaróg chudy",
        brands: "Piątnica",
      }),
    ).toBe("Piątnica Twaróg chudy");
  });

  it("mapuje OFF na szczegóły, pełną nazwę i score", () => {
    const mapped = mapOpenFoodFactsProduct(
      {
        product_name_pl: "Twaróg chudy",
        brands: "Piątnica, Inna",
        ingredients_text_pl: "Mleko pasteryzowane, sól, kwas cytrynowy",
        nutriments: {
          "energy-kcal_100g": 98,
          proteins_100g: 18,
          fat_100g: 0.5,
          carbohydrates_100g: 3.5,
          "saturated-fat_100g": 0.3,
          sugars_100g: 3.5,
          salt_100g: 0.1,
          calcium_100g: 120,
        },
      },
      "5900000000099",
    )!;
    expect(mapped.name).toBe("Piątnica Twaróg chudy");
    expect(mapped.brand).toBe("Piątnica");
    expect(mapped.details?.saltG).toBe(0.1);
    const score = gymbratNutritionScore(mapped);
    expect(score.score).toBeGreaterThanOrEqual(4);
    expect(score.reasons.length).toBeGreaterThan(0);
    expect(formatNutrientValue(null, "g")).toBe("b.d.");
  });

  it("karze chipsy niską oceną, a nie prawie 5/5", () => {
    const chips = mapOpenFoodFactsProduct(
      {
        product_name: "Chipsy paprykowe",
        brands: "Lays",
        ingredients_text_pl: "Ziemniaki, olej palmowy, sól, aromaty, E621",
        nutriments: {
          "energy-kcal_100g": 536,
          proteins_100g: 5.5,
          fat_100g: 33,
          carbohydrates_100g: 52,
          "saturated-fat_100g": 3.5,
          sugars_100g: 1.2,
          salt_100g: 1.4,
          fiber_100g: 4,
        },
      },
      "5900000000111",
    )!;
    expect(chips.name).toBe("Lays Chipsy paprykowe");
    const score = gymbratNutritionScore(chips);
    expect(score.score).toBeLessThanOrEqual(2.5);
    expect(score.label === "Słaby" || score.label === "Unikaj").toBe(true);
  });
});
