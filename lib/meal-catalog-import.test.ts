import { describe, expect, it } from "vitest";
import { parseCatalogImportPayload } from "@/lib/meal-catalog-import";
import { mergeMealCatalogs } from "@/lib/meal-catalog";
import type { CatalogMeal } from "@/lib/meal-catalog-types";
import {
  isPrimaryAdminEmail,
  PRIMARY_ADMIN_EMAIL,
  parseAdminEmails,
} from "@/lib/admin-config";

describe("meal-catalog-import", () => {
  it("normalizuje uproszczony JSON z mealType", () => {
    const { meals, mode } = parseCatalogImportPayload([
      {
        id: "meal_011",
        title: "Jogurt z Granola",
        description: "Szybkie śniadanie.",
        mealType: "breakfast",
        calories: 350,
        protein: 24,
        carbs: 40,
        fat: 10,
        imagePrompt: "greek yogurt bowl granola",
      },
    ]);
    expect(mode).toBe("merge");
    expect(meals).toHaveLength(1);
    expect(meals[0]!.slot).toBe("sniadanie");
    expect(meals[0]!.approximateMacros.proteinG).toBe(24);
    expect(meals[0]!.imagePrompt).toContain("yogurt");
    expect(meals[0]!.ingredients.length).toBeGreaterThanOrEqual(2);
  });

  it("obsługuje mode replace i obiekt meals", () => {
    const { mode, meals } = parseCatalogImportPayload({
      mode: "replace",
      meals: [
        {
          id: "x1",
          title: "Test",
          slot: "obiad",
          prepMinutes: 15,
          ingredients: ["A", "B"],
          steps: ["1", "2"],
          approximateMacros: { calories: 100, proteinG: 10, fatG: 5, carbsG: 8 },
        },
      ],
    });
    expect(mode).toBe("replace");
    expect(meals[0]!.id).toBe("x1");
  });

  it("merge nadpisuje to samo id", () => {
    const seed: CatalogMeal[] = [
      {
        id: "a",
        title: "Seed",
        slot: "obiad",
        prepMinutes: 10,
        ingredients: ["x", "y"],
        steps: ["1", "2"],
        approximateMacros: { calories: 1, proteinG: 1, fatG: 1, carbsG: 1 },
      },
    ];
    const db: CatalogMeal[] = [
      {
        id: "a",
        title: "Z panelu",
        slot: "kolacja",
        prepMinutes: 20,
        ingredients: ["x", "y"],
        steps: ["1", "2"],
        approximateMacros: { calories: 2, proteinG: 2, fatG: 2, carbsG: 2 },
      },
      {
        id: "b",
        title: "Nowy",
        slot: "sniadanie",
        prepMinutes: 5,
        ingredients: ["x", "y"],
        steps: ["1", "2"],
        approximateMacros: { calories: 3, proteinG: 3, fatG: 3, carbsG: 3 },
      },
    ];
    const merged = mergeMealCatalogs(seed, db);
    expect(merged).toHaveLength(2);
    expect(merged.find((m) => m.id === "a")?.title).toBe("Z panelu");
  });
});

describe("primary admin", () => {
  it("zawsze zawiera PRIMARY_ADMIN_EMAIL", () => {
    expect(isPrimaryAdminEmail(PRIMARY_ADMIN_EMAIL)).toBe(true);
    expect(isPrimaryAdminEmail("DAMIANCHMIELEWSKI33@GMAIL.COM")).toBe(true);
    expect(parseAdminEmails().has(PRIMARY_ADMIN_EMAIL)).toBe(true);
  });
});
