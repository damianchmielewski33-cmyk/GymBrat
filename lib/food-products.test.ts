import { describe, expect, it } from "vitest";
import {
  DIET_DIARY_SLOTS,
  DIET_DIARY_SLOT_LABELS,
  dietDiarySlotFromHour,
  isDietDiarySlot,
} from "@/lib/diet-diary-slots";
import { findLocalProductByBarcode, searchLocalProducts } from "@/lib/food-products";
import { FOOD_PRODUCTS_LOCAL } from "@/lib/food-products-data";

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
      expect(p.proteinG + p.fatG + p.carbsG + p.calories).toBeGreaterThan(0);
    }
  });

  it("szuka po nazwie i kodzie EAN", () => {
    const jogurt = searchLocalProducts("jogurt");
    expect(jogurt.some((p) => /jogurt/i.test(p.name))).toBe(true);
    const withCode = FOOD_PRODUCTS_LOCAL.find((p) => p.barcode);
    expect(withCode).toBeTruthy();
    expect(findLocalProductByBarcode(withCode!.barcode!)!.id).toBe(withCode!.id);
  });
});
