import { describe, expect, it } from "vitest";
import { emptyDetails } from "@/lib/food-nutrition";
import { computeFoodQuality, computeSaltInfo } from "@/lib/food-quality";
import type { FoodProduct } from "@/lib/food-products-types";

function p(over: Partial<FoodProduct>, d: Partial<NonNullable<FoodProduct["details"]>> = {}): FoodProduct {
  return {
    id: "t", barcode: null, name: "Test", servingLabel: "100 g",
    calories: 100, proteinG: 5, fatG: 2, carbsG: 10, source: "local",
    details: { ...emptyDetails(), ...d },
    ...over,
  };
}

describe("computeFoodQuality", () => {
  it("daje A dla zdrowego produktu", () => {
    const q = computeFoodQuality(p({ calories: 40, proteinG: 4 }, { sugarsG: 1, saturatedFatG: 0.2, saltG: 0.05, fiberG: 6 }));
    expect(q?.grade).toBe("A");
    expect(q!.score).toBeGreaterThan(75);
  });
  it("daje E dla słodyczy/słonej przekąski", () => {
    const q = computeFoodQuality(p({ calories: 540, proteinG: 4 }, { sugarsG: 55, saturatedFatG: 15, saltG: 1.2, fiberG: 1 }));
    expect(q?.grade).toBe("E");
    expect(q!.reasons).toContain("dużo cukrów");
  });
  it("zwraca null bez danych", () => {
    expect(computeFoodQuality(p({}))).toBeNull();
  });
  it("preferuje ocenę z OFF", () => {
    const q = computeFoodQuality(p({ nutriscoreGrade: "D", novaGroup: 4 }, { sugarsG: 1, saturatedFatG: 0.2, saltG: 0.05, fiberG: 6 }));
    expect(q?.grade).toBe("D");
    expect(q?.novaGroup).toBe(4);
  });
});

describe("computeSaltInfo", () => {
  it("liczy sól w porcji i % limitu", () => {
    const s = computeSaltInfo(p({}, { saltG: 1 }), 250);
    expect(s?.portionG).toBe(2.5);
    expect(s?.dailyPct).toBe(50);
    expect(s?.level).toBe("medium");
  });
  it("null bez danych o soli", () => {
    expect(computeSaltInfo(p({}), 100)).toBeNull();
  });
});
