import { describe, expect, it } from "vitest";
import {
  defaultMealTemplateName,
  MEAL_TEMPLATE_COUNT,
  mealTemplatesForDay,
  mealTemplatesForProfile,
  normalizeMealTemplates,
  parseMealTemplatesJson,
  serializeMealTemplates,
  serializeMealTemplatesByDayType,
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

  it("pusty JSON → [] dla diety; profil dostaje 5 slotów w obu zestawach", () => {
    expect(parseMealTemplatesJson(null)).toEqual([]);
    const byDay = mealTemplatesForProfile(null);
    expect(byDay.training).toHaveLength(5);
    expect(byDay.rest).toHaveLength(5);
    expect(byDay.training[0]!.name).toBe(defaultMealTemplateName(1));
  });

  it("legacy tablica → kopiowana do training i rest", () => {
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
    const byDay = mealTemplatesForProfile(json);
    expect(byDay.training[0]!.proteinG).toBe(30);
    expect(byDay.rest[0]!.proteinG).toBe(30);
    expect(mealTemplatesForDay(json, "training")[0]!.proteinG).toBe(30);
  });

  it("nowy kształt { training, rest } parsowany niezależnie", () => {
    const json = serializeMealTemplatesByDayType({
      training: [
        {
          id: "t1",
          name: "Posiłek 1",
          calories: 400,
          proteinG: 40,
          fatG: 10,
          carbsG: 30,
        },
      ],
      rest: [
        {
          id: "r1",
          name: "Posiłek 1",
          calories: 200,
          proteinG: 20,
          fatG: 5,
          carbsG: 15,
        },
      ],
    });
    const byDay = mealTemplatesForProfile(json);
    expect(byDay.training[0]!.proteinG).toBe(40);
    expect(byDay.rest[0]!.proteinG).toBe(20);
  });
});
