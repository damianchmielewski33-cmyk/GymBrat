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

const MacroValueSchema = z.union([z.number().nonnegative(), z.string().min(1).max(40)]);

const StringListOrTextSchema = z.union([
  z.array(z.string().min(1)).min(1).max(40),
  z.string().min(1).max(4000),
]);

/** Uproszczony format importu (JSON z panelu / zewnętrzne meal_XXX / recipes). */
const CatalogMealLooseSchema = z.object({
  id: z.string().min(1).max(80).optional(),
  title: z.string().min(1).max(160),
  description: z.string().max(400).optional(),
  tagline: z.string().max(240).optional(),
  mealType: MealTypeAliasSchema.optional(),
  slot: MealSlotSchema.optional(),
  prepMinutes: z.number().int().positive().max(240).optional(),
  /** Alias zewnętrzny — jak `prepMinutes`. */
  prepTime: z.number().int().positive().max(240).optional(),
  servings: z.number().positive().max(50).optional(),
  calories: MacroValueSchema.optional(),
  protein: MacroValueSchema.optional(),
  carbs: MacroValueSchema.optional(),
  fat: MacroValueSchema.optional(),
  approximateMacros: MacrosSchema.optional(),
  ingredients: StringListOrTextSchema.optional(),
  steps: StringListOrTextSchema.optional(),
  /** Alias zewnętrzny — jak `steps` (tablica albo jeden ciąg zdań). */
  instructions: StringListOrTextSchema.optional(),
  imagePrompt: z.string().max(800).optional(),
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

/** Wyciąga liczbę z wartości typu `620`, `"620"`, `"620 kcal"`, `"53 g"`. */
export function parseMacroNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value !== "string") return null;
  const match = value.trim().replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Składniki: tablica albo jeden ciąg rozdzielony `;` / nową linią. */
export function normalizeIngredientList(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const list = value
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter((x) => x.length > 0)
      .slice(0, 40);
    return list.length >= 2 ? list : null;
  }
  if (typeof value !== "string") return null;
  const list = value
    .split(/[;\n]+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .slice(0, 40);
  return list.length >= 2 ? list : null;
}

/**
 * Kroki: tablica albo proza rozdzielona na zdania (`. ` / nowe linie / numeracja).
 */
export function normalizeStepList(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const list = value
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter((x) => x.length > 0)
      .slice(0, 40);
    return list.length >= 2 ? list : list.length === 1 ? list : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const byLines = trimmed
    .split(/\n+/)
    .map((line) => line.replace(/^\d+[.)]\s*/, "").trim())
    .filter((x) => x.length > 0);

  const candidates =
    byLines.length >= 2
      ? byLines
      : trimmed
          .split(/(?<=[.!?])\s+/)
          .map((x) => x.trim())
          .filter((x) => x.length > 0);

  const list = candidates.slice(0, 40);
  return list.length >= 1 ? list : null;
}

const PL_CHARS: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
};

export function slugifyMealId(title: string): string {
  const ascii = title
    .toLowerCase()
    .split("")
    .map((ch) => PL_CHARS[ch] ?? ch)
    .join("")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 56);
  return ascii ? `meal_${ascii}` : `meal_${Date.now().toString(36)}`;
}

/** Slot z tytułu / opisu / promptu zdjęcia, gdy brak mealType. */
export function inferSlotFromText(
  title: string,
  description?: string,
  imagePrompt?: string,
): MealSlot {
  const hay = `${title} ${description ?? ""} ${imagePrompt ?? ""}`.toLowerCase();

  if (/drugie\s*sniadan|drugie\s*śniadan|second\s*breakfast/.test(hay)) {
    return "drugie_sniadanie";
  }
  if (
    /sniadan|śniadan|breakfast|pancake|naleśnik|owsiank|overnight\s*oats|granola|jajecznic|omlet|tost/.test(
      hay,
    )
  ) {
    return "sniadanie";
  }
  if (/kolacj|dinner|supper|wieczorny|wieczorna/.test(hay)) {
    return "kolacja";
  }
  if (
    /podwieczorek|snack|deser|kisiel|shake|koktajl|baton|pudding|budyń/.test(hay)
  ) {
    return "podwieczorek";
  }
  if (/obiad|lunch|teriyaki|łosoś|losos|bowl|kurczak|indyk|fasolk/.test(hay)) {
    return "obiad";
  }
  return "obiad";
}

function uniqueMealId(base: string, used: Set<string>): string {
  let id = base.slice(0, 80);
  if (!used.has(id)) return id;
  let n = 2;
  while (n < 10_000) {
    const suffix = `_${n}`;
    id = `${base.slice(0, 80 - suffix.length)}${suffix}`;
    if (!used.has(id)) return id;
    n += 1;
  }
  return `${base.slice(0, 60)}_${Date.now().toString(36)}`;
}

function normalizeOne(raw: unknown, usedIds: Set<string>): CatalogMeal {
  const strict = CatalogMealStrictSchema.safeParse(raw);
  if (strict.success) {
    const id = strict.data.id.trim();
    if (usedIds.has(id)) throw new Error(`Zduplikowane id w imporcie: ${id}`);
    usedIds.add(id);
    return {
      ...strict.data,
      id,
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
  const calories = parseMacroNumber(m.calories);
  const protein = parseMacroNumber(m.protein);
  const carbs = parseMacroNumber(m.carbs);
  const fat = parseMacroNumber(m.fat);

  const macros =
    m.approximateMacros ??
    (calories != null && protein != null && carbs != null && fat != null
      ? {
          calories,
          proteinG: protein,
          carbsG: carbs,
          fatG: fat,
        }
      : null);

  if (!macros) {
    throw new Error(
      `Przepis „${m.title}” wymaga approximateMacros albo calories/protein/carbs/fat.`,
    );
  }

  const ingredients =
    normalizeIngredientList(m.ingredients) ?? [
      "Składniki według nazwy dania",
      "Przyprawy do smaku",
    ];

  const fromSteps = normalizeStepList(m.steps);
  const fromInstructions = normalizeStepList(m.instructions);
  let steps =
    fromSteps && fromSteps.length >= 2
      ? fromSteps
      : fromInstructions && fromInstructions.length >= 2
        ? fromInstructions
        : fromSteps?.length === 1
          ? [...fromSteps, "Podawaj od razu."]
          : fromInstructions?.length === 1
            ? [...fromInstructions, "Podawaj od razu."]
            : ["Przygotuj składniki.", "Przygotuj danie i podawaj."];

  if (steps.length < 2) {
    steps = [...steps, "Podawaj od razu."];
  }

  const providedId = m.id?.trim();
  if (providedId && usedIds.has(providedId)) {
    throw new Error(`Zduplikowane id w imporcie: ${providedId}`);
  }
  const id = providedId
    ? providedId.slice(0, 80)
    : uniqueMealId(slugifyMealId(m.title), usedIds);
  usedIds.add(id);

  const slot =
    m.slot ??
    (m.mealType
      ? mapMealTypeToSlot(m.mealType)
      : inferSlotFromText(m.title, m.description, m.imagePrompt));

  return {
    id,
    title: m.title.trim(),
    tagline: (m.tagline ?? m.description)?.trim() || undefined,
    slot,
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
    else if (typeof obj.title === "string") {
      // Pojedynczy przepis (z id lub bez) bez opakowania w tablicę.
      list = [obj];
    } else {
      throw new Error('Oczekiwano tablicy albo obiektu z polem "meals" / "recipes".');
    }
  } else {
    throw new Error("Niepoprawny JSON przepisów.");
  }

  if (list.length === 0) throw new Error("Brak przepisów w pliku JSON.");
  if (list.length > 500) throw new Error("Maksymalnie 500 przepisów w jednym imporcie.");

  const usedIds = new Set<string>();
  const meals = list.map((item, i) => {
    try {
      return normalizeOne(item, usedIds);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "błąd";
      throw new Error(`Pozycja ${i + 1}: ${msg}`);
    }
  });

  for (const meal of meals) {
    if (!MEAL_SLOTS.includes(meal.slot)) {
      throw new Error(`Nieprawidłowy slot dla ${meal.id}`);
    }
  }

  return { meals, mode };
}

export { CatalogMealStrictSchema };
