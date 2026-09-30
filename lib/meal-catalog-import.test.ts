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

  it("akceptuje recipes z makro/składnikami/instrukcjami jako stringami (bez id)", () => {
    const { meals, mode } = parseCatalogImportPayload({
      recipes: [
        {
          title: "Kurczak teriyaki z ryżem i warzywami",
          description: "Wysokobiałkowy fit obiad z kurczakiem, ryżem i warzywami.",
          calories: "620 kcal",
          protein: "53 g",
          carbs: "72 g",
          fat: "13 g",
          ingredients:
            "Pierś z kurczaka - 180 g; Ryż basmati - 75 g; Brokuł - 150 g; Marchew - 80 g; Sos sojowy - 15 g; Miód - 10 g; Oliwa z oliwek - 5 g; Czosnek - 5 g",
          instructions:
            "Ugotuj ryż. Kurczaka pokrój w kostkę i podsmaż na oliwie. Dodaj czosnek, marchew i brokuł. Dodaj sos sojowy oraz miód. Smaż przez kilka minut i podawaj z ryżem.",
          imagePrompt:
            "Photorealistic healthy fitness meal, teriyaki chicken breast with basmati rice, broccoli and carrot, clean white ceramic plate, natural daylight, white background, high protein meal, professional food photography, no text, no logos",
        },
        {
          title: "Proteinowe pancakes z jogurtem i owocami",
          description:
            "Proteinowe pancakes owsiane z jogurtem greckim, borówkami i bananem.",
          calories: "510 kcal",
          protein: "39 g",
          carbs: "57 g",
          fat: "14 g",
          ingredients:
            "Płatki owsiane - 50 g; Jajko - 55 g; Białka jaj - 100 g; Jogurt grecki 0% - 150 g; Borówki - 80 g; Banan - 80 g; Masło orzechowe - 10 g",
          instructions:
            "Zmiksuj płatki owsiane. Dodaj jajko i białka jaj. Wymieszaj. Smaż pancakes na nieprzywierającej patelni. Podawaj z jogurtem, borówkami, bananem i masłem orzechowym.",
          imagePrompt:
            "Photorealistic healthy protein pancakes stacked on a white ceramic plate, Greek yogurt, blueberries, banana slices and peanut butter, clean fitness breakfast aesthetic, natural morning light, white background, professional food photography, no text, no logos",
        },
        {
          title: "Czekoladowy proteinowy overnight oats",
          description:
            "Szybkie wysokobiałkowe śniadanie o smaku czekoladowym przygotowywane przez noc.",
          calories: "470 kcal",
          protein: "35 g",
          carbs: "53 g",
          fat: "13 g",
          ingredients:
            "Płatki owsiane - 50 g; Jogurt grecki 0% - 170 g; Mleko 1,5% - 100 g; Odżywka białkowa czekoladowa - 25 g; Kakao - 8 g; Banan - 80 g; Masło orzechowe - 10 g; Nasiona chia - 8 g",
          instructions:
            "Wymieszaj płatki, jogurt, mleko, odżywkę białkową, kakao i chia. Odstaw do lodówki na minimum 4 godziny. Przed podaniem dodaj banana i masło orzechowe.",
          imagePrompt:
            "Photorealistic healthy chocolate protein overnight oats in a transparent glass jar, creamy chocolate oats, Greek yogurt, banana slices, peanut butter and chia seeds, premium fitness breakfast aesthetic, soft natural light, clean white background, professional food photography, no text, no logos",
        },
      ],
    });

    expect(mode).toBe("merge");
    expect(meals).toHaveLength(3);

    const teriyaki = meals[0]!;
    expect(teriyaki.id).toMatch(/^meal_kurczak_teriyaki/);
    expect(teriyaki.slot).toBe("obiad");
    expect(teriyaki.tagline).toContain("obiad");
    expect(teriyaki.approximateMacros).toEqual({
      calories: 620,
      proteinG: 53,
      carbsG: 72,
      fatG: 13,
    });
    expect(teriyaki.ingredients).toContain("Pierś z kurczaka - 180 g");
    expect(teriyaki.ingredients.length).toBe(8);
    expect(teriyaki.steps.length).toBeGreaterThanOrEqual(4);
    expect(teriyaki.steps[0]).toContain("Ugotuj ryż");
    expect(teriyaki.imagePrompt).toContain("teriyaki");

    expect(meals[1]!.slot).toBe("sniadanie");
    expect(meals[1]!.approximateMacros.proteinG).toBe(39);
    expect(meals[2]!.slot).toBe("sniadanie");
    expect(meals[2]!.steps).toHaveLength(3);
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

describe("pakiet startowy", () => {
  it("data/meal-catalog-starter.json przechodzi walidację importu", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "data", "meal-catalog-starter.json");
    expect(fs.existsSync(file)).toBe(true);
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    const { meals } = parseCatalogImportPayload(raw);
    expect(meals.length).toBeGreaterThan(50);
    expect(meals[0]?.id).toBeTruthy();
    expect(meals[0]?.approximateMacros.calories).toBeGreaterThan(0);
  });
});
