import type { DietDiarySlot } from "@/lib/diet-diary-slots";
import { DIET_DIARY_SLOT_LABELS } from "@/lib/diet-diary-slots";
import { diarySlotToCatalog } from "@/lib/diet-slot-map";
import type { CatalogMeal } from "@/lib/meal-catalog-types";
import type { MealTemplate } from "@/lib/meal-templates";
import { MAX_MEAL_TEMPLATES } from "@/lib/meal-templates";
import type { MealSlot } from "@/lib/meal-catalog-types";

/** Mapowanie Posiłek 1…5 → sekcja dziennika (max 5). */
export const MEAL_PLAN_DIARY_SLOTS: DietDiarySlot[] = [
  "sniadanie",
  "drugie_sniadanie",
  "obiad",
  "przekaska",
  "kolacja",
];

export type MealPlanRow = {
  id: string;
  index: number;
  label: string;
  diarySlot: DietDiarySlot;
  catalogSlot: MealSlot;
  proteinG: number;
  carbsG: number;
  fatG: number;
  calories: number;
};

export type RecipeDifficulty = 1 | 2 | 3;
export type RecipeTaste = "all" | "savory" | "sweet" | "fit_fast";
export type RecipeCategory =
  | "all"
  | "mieso"
  | "ryby"
  | "wege"
  | "nabial"
  | "inne";

export type ScaledRecipeProposal = {
  meal: CatalogMeal;
  scale: number;
  scaledMacros: {
    calories: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
  };
  scaledIngredients: string[];
  /** Niższy = lepsze dopasowanie do celu posiłku po przeskalowaniu. */
  score: number;
};

export const RECIPE_CATEGORY_LABELS: Record<
  Exclude<RecipeCategory, "all">,
  string
> = {
  mieso: "Mięso",
  ryby: "Ryby",
  wege: "Wege",
  nabial: "Nabiał",
  inne: "Inne",
};

const SWEET_RE =
  /deser|kisiel|jogurt|owsiank|pudding|ciast|czekolad|truskawk|banan|smoothie|naleśnik|omlet\s+słod|granola|miod|erytryt|proteinowy\s+shake|shake|koktajl|budyń|sernik|lody|baton/i;

const FIT_FAST_RE =
  /wrap|burger|pizza|frytk|nugget|kanapk|tost|hot.?dog|taco|quesadill|fast.?food|zapiekank/i;

const FISH_RE =
  /łosoś|losos|tuńczyk|tunczyk|dorsz|mintaj|krewet|owoc[eó]w\s+morza|ryb|śledź|sledz|makrela|halibut|pstrąg|pstrag|sardyn/i;
const MEAT_RE =
  /kurczak|indyk|wołow|wolow|wieprz|szynk|schab|mielon|karkówka|karkowka|boczek|kiełbas|kielbas|stek|wołowina|udziec|udko|pierś|piers|mięso|mieso/i;
const DAIRY_RE =
  /jogurt|twaróg|twarog|ser\b|skyr|mleko|kefir|maślank|maslank|cottage|mozzarella|feta|ricotta|śmietan|smietan|jajk|jajeczn/i;
const VEG_RE =
  /tofu|tempeh|ciecierzyc|soczewic|fasol|hummus|awokado|warzyw|salat|sałat|quinoa|kasza|owsiank|banan|owoc/i;

const SCALE_MIN = 0.4;
const SCALE_MAX = 2.5;
/** Powyżej tego score przepis jest zbyt daleko od celu nawet po skalowaniu. */
const SCORE_REJECT = 55;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function recipeDifficulty(prepMinutes: number): RecipeDifficulty {
  const mins =
    typeof prepMinutes === "number" && Number.isFinite(prepMinutes)
      ? prepMinutes
      : 20;
  if (mins <= 15) return 1;
  if (mins <= 30) return 2;
  return 3;
}

export function recipeTaste(meal: CatalogMeal): "savory" | "sweet" | "fit_fast" {
  const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];
  const hay = `${meal.title} ${meal.tagline ?? ""} ${ingredients.join(" ")}`;
  if (FIT_FAST_RE.test(hay)) return "fit_fast";
  if (SWEET_RE.test(hay)) return "sweet";
  return "savory";
}

export function recipeCategory(
  meal: CatalogMeal,
): Exclude<RecipeCategory, "all"> {
  const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];
  const hay = `${meal.title} ${meal.tagline ?? ""} ${ingredients.join(" ")}`;
  if (FISH_RE.test(hay)) return "ryby";
  if (MEAT_RE.test(hay)) return "mieso";
  if (DAIRY_RE.test(hay)) return "nabial";
  if (VEG_RE.test(hay)) return "wege";
  return "inne";
}

export function buildMealPlanRows(
  templates: MealTemplate[],
  dayGoals: {
    proteinGoal: number | null;
    carbsGoal: number | null;
    fatGoal: number | null;
    caloriesGoal: number | null;
  },
): MealPlanRow[] {
  if (templates.length > 0) {
    return templates.slice(0, MAX_MEAL_TEMPLATES).map((t, i) => {
      const diarySlot =
        MEAL_PLAN_DIARY_SLOTS[Math.min(i, MEAL_PLAN_DIARY_SLOTS.length - 1)]!;
      return {
        id: t.id,
        index: i + 1,
        label: t.name.trim() || `Posiłek ${i + 1}`,
        diarySlot,
        catalogSlot: diarySlotToCatalog(diarySlot),
        proteinG: t.proteinG,
        carbsG: t.carbsG,
        fatG: t.fatG,
        calories: t.calories,
      };
    });
  }

  const n = MEAL_PLAN_DIARY_SLOTS.length;
  const p = (dayGoals.proteinGoal ?? 0) / n;
  const c = (dayGoals.carbsGoal ?? 0) / n;
  const f = (dayGoals.fatGoal ?? 0) / n;
  const k = (dayGoals.caloriesGoal ?? 0) / n;

  return MEAL_PLAN_DIARY_SLOTS.map((slot, i) => ({
    id: slot,
    index: i + 1,
    label: DIET_DIARY_SLOT_LABELS[slot],
    diarySlot: slot,
    catalogSlot: diarySlotToCatalog(slot),
    proteinG: Math.round(p),
    carbsG: Math.round(c),
    fatG: Math.round(f),
    calories: Math.round(k),
  }));
}

export function formatMealMacroLine(
  row: Pick<MealPlanRow, "proteinG" | "carbsG" | "fatG">,
): string {
  return `${Math.round(row.proteinG)}B · ${Math.round(row.carbsG)}W · ${Math.round(row.fatG)}T`;
}

/** Przeskaluj liczbę na początku linii składnika (g / ml / kg / l). */
export function scaleIngredientLine(line: string, scale: number): string {
  const raw = String(line ?? "").trim();
  if (!raw || !Number.isFinite(scale) || Math.abs(scale - 1) < 0.02) return raw;
  return raw.replace(
    /^(\d+[.,]?\d*)\s*(g|ml|kg|l)\b/i,
    (_m, num: string, unit: string) => {
      const n = Number(String(num).replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) return `${num} ${unit}`;
      const scaled = round1(n * scale);
      const display =
        Math.abs(scaled - Math.round(scaled)) < 0.05
          ? String(Math.round(scaled))
          : String(scaled).replace(".", ",");
      return `${display} ${unit}`;
    },
  );
}

export function scaleIngredientList(
  ingredients: string[],
  scale: number,
): string[] {
  return (Array.isArray(ingredients) ? ingredients : []).map((line) =>
    scaleIngredientLine(line, scale),
  );
}

/**
 * Współczynnik porcji dopasowujący makro przepisu do celu posiłku
 * (priorytet: białko, potem średnia B/W/T).
 */
export function computeMealScaleFactor(
  meal: CatalogMeal,
  target: Pick<MealPlanRow, "proteinG" | "carbsG" | "fatG" | "calories">,
): number {
  const m = meal.approximateMacros;
  const candidates: number[] = [];
  if (m.proteinG > 0.5 && target.proteinG > 0) {
    candidates.push(target.proteinG / m.proteinG);
  }
  if (m.carbsG > 0.5 && target.carbsG > 0) {
    candidates.push(target.carbsG / m.carbsG);
  }
  if (m.fatG > 0.5 && target.fatG > 0) {
    candidates.push(target.fatG / m.fatG);
  }
  if (candidates.length === 0) {
    if (m.calories > 1 && target.calories > 0) {
      return clamp(target.calories / m.calories, SCALE_MIN, SCALE_MAX);
    }
    return 1;
  }
  const mean = candidates.reduce((a, b) => a + b, 0) / candidates.length;
  const proteinScale =
    m.proteinG > 0.5 && target.proteinG > 0
      ? target.proteinG / m.proteinG
      : mean;
  return clamp(0.65 * proteinScale + 0.35 * mean, SCALE_MIN, SCALE_MAX);
}

export function applyMealScale(
  meal: CatalogMeal,
  scale: number,
): Pick<ScaledRecipeProposal, "scaledMacros" | "scaledIngredients" | "scale"> {
  const m = meal.approximateMacros;
  const s = clamp(scale, SCALE_MIN, SCALE_MAX);
  return {
    scale: round1(s),
    scaledMacros: {
      calories: Math.round(m.calories * s),
      proteinG: round1(m.proteinG * s),
      fatG: round1(m.fatG * s),
      carbsG: round1(m.carbsG * s),
    },
    scaledIngredients: scaleIngredientList(meal.ingredients, s),
  };
}

export function scoreScaledMacros(
  scaled: ScaledRecipeProposal["scaledMacros"],
  target: Pick<MealPlanRow, "proteinG" | "carbsG" | "fatG" | "calories">,
): number {
  const dp = Math.abs(scaled.proteinG - target.proteinG);
  const dc = Math.abs(scaled.carbsG - target.carbsG);
  const df = Math.abs(scaled.fatG - target.fatG);
  const dk =
    target.calories > 0
      ? Math.abs(scaled.calories - target.calories) / 14
      : 0;
  return dp * 1.5 + dc * 1.05 + df * 1.2 + dk;
}

/** Przepis przeskalowany do celu posiłku z profilu. */
export function scaleMealToPlanTarget(
  meal: CatalogMeal,
  target: Pick<
    MealPlanRow,
    "proteinG" | "carbsG" | "fatG" | "calories" | "catalogSlot"
  >,
): ScaledRecipeProposal {
  const scale = computeMealScaleFactor(meal, target);
  const applied = applyMealScale(meal, scale);
  const slotBonus = meal.slot === target.catalogSlot ? 0 : 8;
  return {
    meal,
    ...applied,
    score: scoreScaledMacros(applied.scaledMacros, target) + slotBonus,
  };
}

/** @deprecated użyj scoreScaledMacros / scaleMealToPlanTarget */
export function scoreMealForPlanTarget(
  meal: CatalogMeal,
  target: Pick<
    MealPlanRow,
    "proteinG" | "carbsG" | "fatG" | "calories" | "catalogSlot"
  >,
): number {
  return scaleMealToPlanTarget(meal, target).score;
}

export function filterCatalogForMealPlan(args: {
  meals: CatalogMeal[];
  row: MealPlanRow;
  query: string;
  difficulty: RecipeDifficulty | "all";
  taste: RecipeTaste;
  category?: RecipeCategory;
  limit?: number;
}): ScaledRecipeProposal[] {
  const q = args.query.trim().toLowerCase();
  const category = args.category ?? "all";
  const list = Array.isArray(args.meals) ? args.meals : [];
  const scored = list
    .map((meal) => {
      try {
        if (!meal?.title || !meal.approximateMacros) return null;
        if (
          args.difficulty !== "all" &&
          recipeDifficulty(meal.prepMinutes) !== args.difficulty
        ) {
          return null;
        }
        const taste = recipeTaste(meal);
        if (args.taste !== "all" && taste !== args.taste) return null;
        if (category !== "all" && recipeCategory(meal) !== category) return null;
        if (q) {
          const ingredients = Array.isArray(meal.ingredients)
            ? meal.ingredients
            : [];
          const hay =
            `${meal.title} ${meal.tagline ?? ""} ${ingredients.join(" ")}`.toLowerCase();
          if (!hay.includes(q)) return null;
        }
        const proposal = scaleMealToPlanTarget(meal, args.row);
        if (proposal.score > SCORE_REJECT) return null;
        return proposal;
      } catch {
        return null;
      }
    })
    .filter((x): x is ScaledRecipeProposal => x != null)
    .sort((a, b) => a.score - b.score);

  const limit = args.limit ?? 80;
  return scored.slice(0, limit);
}

export function countByDifficulty(
  proposals: ScaledRecipeProposal[],
): Record<RecipeDifficulty, number> {
  const out: Record<RecipeDifficulty, number> = { 1: 0, 2: 0, 3: 0 };
  for (const p of proposals) out[recipeDifficulty(p.meal.prepMinutes)] += 1;
  return out;
}

export function countByTaste(
  proposals: ScaledRecipeProposal[],
): Record<"all" | "savory" | "sweet" | "fit_fast", number> {
  const out = {
    all: proposals.length,
    savory: 0,
    sweet: 0,
    fit_fast: 0,
  };
  for (const p of proposals) out[recipeTaste(p.meal)] += 1;
  return out;
}

export function countByCategory(
  meals: CatalogMeal[],
): Record<RecipeCategory, number> {
  const out: Record<RecipeCategory, number> = {
    all: meals.length,
    mieso: 0,
    ryby: 0,
    wege: 0,
    nabial: 0,
    inne: 0,
  };
  for (const m of meals) out[recipeCategory(m)] += 1;
  return out;
}

export function ingredientPreview(meal: CatalogMeal, max = 5): string {
  const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];
  return ingredients
    .slice(0, max)
    .map((line) =>
      String(line ?? "")
        .replace(/^\d+[.,]?\d*\s*(?:g|ml|kg|l)\s*/i, "")
        .replace(/^\d+\s*\/\s*\d+\s*/i, "")
        .trim(),
    )
    .filter(Boolean)
    .join(" · ");
}

/** CatalogMeal z makro i składnikami już przeskalowanymi pod cel posiłku. */
export function proposalAsCatalogMeal(
  proposal: ScaledRecipeProposal,
): CatalogMeal {
  return {
    ...proposal.meal,
    ingredients: proposal.scaledIngredients,
    approximateMacros: proposal.scaledMacros,
  };
}
