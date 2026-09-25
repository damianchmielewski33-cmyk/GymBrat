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

describe("diet-diary-slots", () => {
  it("ma 5 sekcji Fitatu z polskimi etykietami", () => {
    expect(DIET_DIARY_SLOTS).toHaveLength(5);
    expect(DIET_DIARY_SLOT_LABELS.sniadanie).toBe("Śniadanie");
    expect(DIET_DIARY_SLOT_LABELS.lunch).toBe("Lunch");
    expect(DIET_DIARY_SLOT_LABELS.przekaska).toBe("Przekąska");
    expect(isDietDiarySlot("obiad")).toBe(true);
    expect(isDietDiarySlot("kolacja")).toBe(false);
  });

  it("mapuje godzinę na sekcję", () => {
    expect(dietDiarySlotFromHour(8)).toBe("sniadanie");
    expect(dietDiarySlotFromHour(11)).toBe("drugie_sniadanie");
    expect(dietDiarySlotFromHour(13)).toBe("lunch");
    expect(dietDiarySlotFromHour(16)).toBe("obiad");
    expect(dietDiarySlotFromHour(21)).toBe("przekaska");
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
