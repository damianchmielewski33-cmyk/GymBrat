import { describe, expect, it } from "vitest";
import {
  defaultMealTemplateName,
  MEAL_TEMPLATE_COUNT,
  mealTemplatesForProfile,
  normalizeMealTemplates,
  parseMealTemplatesJson,
  serializeMealTemplates,
} from "@/lib/meal-templates";

describe("meal-templates", () => {
  it("normalize zawsze daje 5 posiłków ze stałymi nazwami", () => {
    const n = normalizeMealTemplates([
      {
        id: "a",
        name: "Śniadanie",
        calories: 300,
        proteinG: 40,
        fatG: 10,
        carbsG: 20,
      },
    ]);
    expect(n).toHaveLength(MEAL_TEMPLATE_COUNT);
    expect(n.map((t) => t.name)).toEqual([
      "Posiłek 1",
      "Posiłek 2",
      "Posiłek 3",
      "Posiłek 4",
      "Posiłek 5",
    ]);
    expect(n[0]!.proteinG).toBe(40);
    expect(n[1]!.proteinG).toBe(0);
  });

  it("pusty JSON → [] dla diety; profil dostaje 5 slotów", () => {
    expect(parseMealTemplatesJson(null)).toEqual([]);
    expect(mealTemplatesForProfile(null)).toHaveLength(5);
    expect(mealTemplatesForProfile(null)[0]!.name).toBe(
      defaultMealTemplateName(1),
    );
  });

  it("serialize zapisuje 5 slotów gdy jest makro", () => {
    const json = serializeMealTemplates([
      {
        id: "x",
        name: "Whatever",
        calories: 200,
        proteinG: 30,
        fatG: 5,
        carbsG: 10,
      },
    ]);
    expect(json).toBeTruthy();
    const parsed = parseMealTemplatesJson(json);
    expect(parsed).toHaveLength(5);
    expect(parsed[0]!.name).toBe("Posiłek 1");
    expect(parsed[0]!.proteinG).toBe(30);
  });
});
