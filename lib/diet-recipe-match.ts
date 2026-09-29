import type { DietDiarySlot } from "@/lib/diet-diary-slots";
import { DIET_DIARY_SLOT_LABELS, DIET_DIARY_SLOTS } from "@/lib/diet-diary-slots";
import { diarySlotToCatalog } from "@/lib/diet-slot-map";
import type { CatalogMeal } from "@/lib/meal-catalog-types";
import type { MealTemplate } from "@/lib/meal-templates";
import type { MealSlot } from "@/lib/meal-catalog-types";

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

const SWEET_RE =
  /deser|kisiel|jogurt|owsiank|pudding|ciast|czekolad|truskawk|banan|smoothie|naleśnik|omlet\s+słod|granola|miod|erytryt|proteinowy\s+shake|shake|koktajl|budyń|sernik|lody|baton/i;

const FIT_FAST_RE =
  /wrap|burger|pizza|frytk|nugget|kanapk|tost|hot.?dog|taco|quesadill|fast.?food|zapiekank/i;

export function recipeDifficulty(prepMinutes: number): RecipeDifficulty {
  if (prepMinutes <= 15) return 1;
  if (prepMinutes <= 30) return 2;
  return 3;
}

export function recipeTaste(meal: CatalogMeal): "savory" | "sweet" | "fit_fast" {
  const hay = `${meal.title} ${meal.tagline ?? ""} ${meal.ingredients.join(" ")}`;
  if (FIT_FAST_RE.test(hay)) return "fit_fast";
  if (SWEET_RE.test(hay)) return "sweet";
  return "savory";
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
    return templates.slice(0, 8).map((t, i) => {
      const diarySlot = DIET_DIARY_SLOTS[Math.min(i, DIET_DIARY_SLOTS.length - 1)]!;
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

  const n = DIET_DIARY_SLOTS.length;
  const p = (dayGoals.proteinGoal ?? 0) / n;
  const c = (dayGoals.carbsGoal ?? 0) / n;
  const f = (dayGoals.fatGoal ?? 0) / n;
  const k = (dayGoals.caloriesGoal ?? 0) / n;

  return DIET_DIARY_SLOTS.map((slot, i) => ({
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

export function formatMealMacroLine(row: Pick<MealPlanRow, "proteinG" | "carbsG" | "fatG">): string {
  return `${Math.round(row.proteinG)}B · ${Math.round(row.carbsG)}W · ${Math.round(row.fatG)}T`;
}

/** Dopasowanie dania do celu posiłku (niższy score = lepsze). */
export function scoreMealForPlanTarget(
  meal: CatalogMeal,
  target: Pick<MealPlanRow, "proteinG" | "carbsG" | "fatG" | "calories" | "catalogSlot">,
): number {
  const m = meal.approximateMacros;
  const slotBonus = meal.slot === target.catalogSlot ? 0 : 35;
  const dp = Math.abs(m.proteinG - target.proteinG);
  const dc = Math.abs(m.carbsG - target.carbsG);
  const df = Math.abs(m.fatG - target.fatG);
  const dk =
    target.calories > 0 ? Math.abs(m.calories - target.calories) / 12 : 0;
  return slotBonus + dp * 1.2 + dc + df * 1.1 + dk;
}

export function filterCatalogForMealPlan(args: {
  meals: CatalogMeal[];
  row: MealPlanRow;
  query: string;
  difficulty: RecipeDifficulty | "all";
  taste: RecipeTaste;
  limit?: number;
}): CatalogMeal[] {
  const q = args.query.trim().toLowerCase();
  const scored = args.meals
    .map((meal) => {
      if (args.difficulty !== "all" && recipeDifficulty(meal.prepMinutes) !== args.difficulty) {
        return null;
      }
      const taste = recipeTaste(meal);
      if (args.taste !== "all" && taste !== args.taste) return null;
      if (q) {
        const hay =
          `${meal.title} ${meal.tagline ?? ""} ${meal.ingredients.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return null;
      }
      return { meal, score: scoreMealForPlanTarget(meal, args.row) };
    })
    .filter((x): x is { meal: CatalogMeal; score: number } => x != null)
    .sort((a, b) => a.score - b.score);

  const limit = args.limit ?? 80;
  return scored.slice(0, limit).map((x) => x.meal);
}

export function countByDifficulty(meals: CatalogMeal[]): Record<RecipeDifficulty, number> {
  const out: Record<RecipeDifficulty, number> = { 1: 0, 2: 0, 3: 0 };
  for (const m of meals) out[recipeDifficulty(m.prepMinutes)] += 1;
  return out;
}

export function countByTaste(meals: CatalogMeal[]): Record<"all" | "savory" | "sweet" | "fit_fast", number> {
  const out = { all: meals.length, savory: 0, sweet: 0, fit_fast: 0 };
  for (const m of meals) out[recipeTaste(m)] += 1;
  return out;
}

export function ingredientPreview(meal: CatalogMeal, max = 5): string {
  return meal.ingredients
    .slice(0, max)
    .map((line) =>
      line
        .replace(/^\d+[.,]?\d*\s*(?:g|ml|kg|l)\s*/i, "")
        .replace(/^\d+\s*\/\s*\d+\s*/i, "")
        .trim(),
    )
    .filter(Boolean)
    .join(" · ");
}
