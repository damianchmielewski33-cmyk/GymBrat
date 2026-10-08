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
    expect(meals[0]!.imageUrl).toBeUndefined();
    expect(meals[0]!.imagePromptEn).toBeTruthy();
    expect(meals[0]!.ingredients.length).toBeGreaterThanOrEqual(2);
  });

  it("akceptuje meal_071: mealType snack, prepTime, instructions", () => {
    const { meals } = parseCatalogImportPayload({
      id: "meal_071",
      title: "Kisiel Proteinowy Deluxe",
      description: "Wysokobiałkowy deser idealny podczas redukcji.",
      mealType: "snack",
      calories: 310,
      protein: 34,
      carbs: 29,
      fat: 3,
      prepTime: 10,
      servings: 1,
      imagePrompt: "protein berry jelly dessert healthy fitness snack",
      ingredients: [
        "1 opakowanie kisielu truskawkowego bez cukru (30 g)",
        "400 ml wody",
        "30 g odżywki białkowej waniliowej",
        "100 g truskawek",
        "10 g erytrytolu",
      ],
      instructions: [
        "Wlej 300 ml wody do małego garnka i zagotuj przez około 3 minuty.",
        "Pozostałe 100 ml zimnej wody przelej do kubka.",
        "Wsyp 30 g kisielu i 10 g erytrytolu do kubka z zimną wodą.",
        "Mieszaj 30 sekund aż proszek całkowicie się rozpuści.",
        "Zmniejsz ogień pod garnkiem.",
        "Powoli wlej zawartość kubka do gotującej się wody cały czas mieszając.",
        "Mieszaj około 1 minutę do uzyskania gęstej konsystencji.",
        "Zdejmij garnek z ognia i odczekaj 5 minut, aż kisiel lekko ostygnie.",
        "Dodaj 30 g odżywki białkowej i mieszaj energicznie przez około 30 sekund.",
        "Pokrój 100 g truskawek na plasterki.",
        "Przełóż kisiel do miseczki.",
        "Na wierzchu ułóż pokrojone truskawki.",
        "Spożyj od razu lub schładzaj w lodówce przez 30 minut.",
      ],
    });
    expect(meals).toHaveLength(1);
    const m = meals[0]!;
    expect(m.id).toBe("meal_071");
    expect(m.slot).toBe("podwieczorek");
    expect(m.prepMinutes).toBe(10);
    expect(m.tagline).toContain("redukcji");
    expect(m.approximateMacros).toEqual({
      calories: 310,
      proteinG: 34,
      carbsG: 29,
      fatG: 3,
    });
    expect(m.ingredients).toHaveLength(5);
    expect(m.steps).toHaveLength(13);
    expect(m.steps[0]).toContain("300 ml");
    expect(m.imagePrompt).toContain("jelly");
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
    const base: CatalogMeal[] = [
      {
        id: "a",
        title: "Stary",
        slot: "obiad",
        prepMinutes: 10,
        ingredients: ["x", "y"],
        steps: ["1", "2"],
        approximateMacros: { calories: 1, proteinG: 1, fatG: 1, carbsG: 1 },
      },
    ];
    const overlay: CatalogMeal[] = [
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
    const merged = mergeMealCatalogs(base, overlay);
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
