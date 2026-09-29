import { z } from "zod";
import type { CatalogMeal, MealSlot } from "@/lib/meal-catalog-types";

const MEAL_SLOTS: MealSlot[] = [
  "sniadanie",
  "drugie_sniadanie",
  "obiad",
  "podwieczorek",
  "kolacja",
];

const MealSlotSchema = z.enum([
  "sniadanie",
  "drugie_sniadanie",
  "obiad",
  "podwieczorek",
  "kolacja",
]);

const MacrosSchema = z.object({
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
});

/** Pełny format katalogu GymBrat. */
const CatalogMealStrictSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  tagline: z.string().max(240).optional(),
  slot: MealSlotSchema,
  prepMinutes: z.number().int().positive().max(240),
  ingredients: z.array(z.string().min(1)).min(2).max(40),
  steps: z.array(z.string().min(1)).min(2).max(40),
  approximateMacros: MacrosSchema,
  imagePrompt: z.string().max(500).optional(),
  imagePromptEn: z.string().max(400).optional(),
  imageUrl: z.string().url().max(800).optional(),
});

const MealTypeAliasSchema = z.enum([
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "sniadanie",
  "drugie_sniadanie",
  "obiad",
  "podwieczorek",
  "kolacja",
]);

/** Uproszczony format importu (JSON z panelu / zewnętrzne meal_XXX). */
const CatalogMealLooseSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  description: z.string().max(400).optional(),
  tagline: z.string().max(240).optional(),
  mealType: MealTypeAliasSchema.optional(),
  slot: MealSlotSchema.optional(),
  prepMinutes: z.number().int().positive().max(240).optional(),
  /** Alias zewnętrzny — jak `prepMinutes`. */
  prepTime: z.number().int().positive().max(240).optional(),
  servings: z.number().positive().max(50).optional(),
  calories: z.number().nonnegative().optional(),
  protein: z.number().nonnegative().optional(),
  carbs: z.number().nonnegative().optional(),
  fat: z.number().nonnegative().optional(),
  approximateMacros: MacrosSchema.optional(),
  ingredients: z.array(z.string().min(1)).min(2).max(40).optional(),
  steps: z.array(z.string().min(1)).min(2).max(40).optional(),
  /** Alias zewnętrzny — jak `steps`. */
  instructions: z.array(z.string().min(1)).min(2).max(40).optional(),
  imagePrompt: z.string().max(500).optional(),
  imagePromptEn: z.string().max(400).optional(),
  imageUrl: z.string().url().max(800).optional(),
});

function mapMealTypeToSlot(
  mealType: z.infer<typeof MealTypeAliasSchema> | undefined,
): MealSlot {
  switch (mealType) {
    case "breakfast":
    case "sniadanie":
      return "sniadanie";
    case "drugie_sniadanie":
      return "drugie_sniadanie";
    case "lunch":
    case "obiad":
      return "obiad";
    case "snack":
    case "podwieczorek":
      return "podwieczorek";
    case "dinner":
    case "kolacja":
      return "kolacja";
    default:
      return "obiad";
  }
}

function normalizeOne(raw: unknown): CatalogMeal {
  const strict = CatalogMealStrictSchema.safeParse(raw);
  if (strict.success) {
    return {
      ...strict.data,
      ...(strict.data.imagePrompt ? { imagePrompt: strict.data.imagePrompt } : {}),
      ...(strict.data.imageUrl ? { imageUrl: strict.data.imageUrl } : {}),
    };
  }

  const loose = CatalogMealLooseSchema.safeParse(raw);
  if (!loose.success) {
    throw new Error(
      `Niepoprawny przepis: ${loose.error.issues[0]?.message ?? "błąd walidacji"}`,
    );
  }

  const m = loose.data;
  const macros =
    m.approximateMacros ??
    (m.calories != null && m.protein != null && m.carbs != null && m.fat != null
      ? {
          calories: m.calories,
          proteinG: m.protein,
          carbsG: m.carbs,
          fatG: m.fat,
        }
      : null);

  if (!macros) {
    throw new Error(
      `Przepis „${m.title}” wymaga approximateMacros albo calories/protein/carbs/fat.`,
    );
  }

  const ingredients =
    m.ingredients && m.ingredients.length >= 2
      ? m.ingredients
      : ["Składniki według nazwy dania", "Przyprawy do smaku"];

  const steps =
    m.steps && m.steps.length >= 2
      ? m.steps
      : m.instructions && m.instructions.length >= 2
        ? m.instructions
        : ["Przygotuj składniki.", "Przygotuj danie i podawaj."];

  return {
    id: m.id.trim(),
    title: m.title.trim(),
    tagline: (m.tagline ?? m.description)?.trim() || undefined,
    slot: m.slot ?? mapMealTypeToSlot(m.mealType),
    prepMinutes: m.prepMinutes ?? m.prepTime ?? 20,
    ingredients,
    steps,
    approximateMacros: macros,
    ...(m.imagePrompt?.trim() ? { imagePrompt: m.imagePrompt.trim() } : {}),
    ...(m.imagePromptEn?.trim() ? { imagePromptEn: m.imagePromptEn.trim() } : {}),
    ...(m.imageUrl?.trim() ? { imageUrl: m.imageUrl.trim() } : {}),
  };
}

export type CatalogImportMode = "merge" | "replace";

export function parseCatalogImportPayload(input: unknown): {
  meals: CatalogMeal[];
  mode: CatalogImportMode;
} {
  let mode: CatalogImportMode = "merge";
  let list: unknown[] = [];

  if (Array.isArray(input)) {
    list = input;
  } else if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (obj.mode === "replace" || obj.mode === "merge") mode = obj.mode;
    if (Array.isArray(obj.meals)) list = obj.meals;
    else if (Array.isArray(obj.recipes)) list = obj.recipes;
    else if (typeof obj.id === "string" && typeof obj.title === "string") {
      // Pojedynczy przepis (np. meal_071) bez opakowania w tablicę.
      list = [obj];
    } else {
      throw new Error('Oczekiwano tablicy albo obiektu z polem "meals" / "recipes".');
    }
  } else {
    throw new Error("Niepoprawny JSON przepisów.");
  }

  if (list.length === 0) throw new Error("Brak przepisów w pliku JSON.");
  if (list.length > 500) throw new Error("Maksymalnie 500 przepisów w jednym imporcie.");

  const meals = list.map((item, i) => {
    try {
      return normalizeOne(item);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "błąd";
      throw new Error(`Pozycja ${i + 1}: ${msg}`);
    }
  });

  const ids = new Set<string>();
  for (const meal of meals) {
    if (ids.has(meal.id)) throw new Error(`Zduplikowane id w imporcie: ${meal.id}`);
    ids.add(meal.id);
    if (!MEAL_SLOTS.includes(meal.slot)) {
      throw new Error(`Nieprawidłowy slot dla ${meal.id}`);
    }
  }

  return { meals, mode };
}

export { CatalogMealStrictSchema };
