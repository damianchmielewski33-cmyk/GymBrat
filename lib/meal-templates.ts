import { z } from "zod";
import { kcalFromMacros } from "@/lib/kcal-from-macros";

/** Stała liczba posiłków dziennie — bez zmiany ilości w UI. */
export const MEAL_TEMPLATE_COUNT = 5;
/** @deprecated użyj MEAL_TEMPLATE_COUNT */
export const MAX_MEAL_TEMPLATES = MEAL_TEMPLATE_COUNT;

const templateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().max(120),
  calories: z.number().finite().min(0),
  proteinG: z.number().finite().min(0),
  fatG: z.number().finite().min(0),
  carbsG: z.number().finite().min(0),
});

export type MealTemplate = z.infer<typeof templateSchema>;

export type MealDayType = "training" | "rest";

/** ADR 0006 §4 — dwa zestawy posiłków (jak cele dnia). */
export type MealTemplatesByDayType = {
  training: MealTemplate[];
  rest: MealTemplate[];
};

export function defaultMealTemplateName(index: number): string {
  return `Posiłek ${index}`;
}

function stableMealId(index: number, dayType?: MealDayType): string {
  if (dayType) return `meal_slot_${dayType}_${index}`;
  return `meal_slot_${index}`;
}

export function emptyMealTemplate(
  index: number,
  dayType?: MealDayType,
): MealTemplate {
  return {
    id: stableMealId(index, dayType),
    name: defaultMealTemplateName(index),
    calories: 0,
    proteinG: 0,
    fatG: 0,
    carbsG: 0,
  };
}

/**
 * Zawsze dokładnie 5 posiłków ze stałymi nazwami Posiłek 1…5.
 * Makro (i id gdy możliwe) bierze z zapisu użytkownika.
 */
export function normalizeMealTemplates(
  templates: MealTemplate[],
  dayType?: MealDayType,
): MealTemplate[] {
  const out: MealTemplate[] = [];
  for (let i = 1; i <= MEAL_TEMPLATE_COUNT; i++) {
    const existing = templates[i - 1];
    if (existing) {
      out.push({
        ...existing,
        id: existing.id?.trim() || stableMealId(i, dayType),
        name: defaultMealTemplateName(i),
      });
    } else {
      out.push(emptyMealTemplate(i, dayType));
    }
  }
  return out;
}

function parseTemplateArray(items: unknown[]): MealTemplate[] {
  const out: MealTemplate[] = [];
  for (const item of items) {
    const p = templateSchema.safeParse(item);
    if (p.success) out.push(p.data);
  }
  if (out.length === 0) return [];
  return normalizeMealTemplates(out);
}

/**
 * Legacy: płaska tablica 5 posiłków (sprzed redesignu).
 * Nowy zapis: `{ training, rest }`.
 * Dla starych konsumentów zwraca zestaw treningowy (albo legacy skopiowany).
 */
export function parseMealTemplatesJson(
  raw: string | null | undefined,
): MealTemplate[] {
  const byDay = mealTemplatesForProfile(raw);
  const hasMacro = (t: MealTemplate[]) =>
    t.some(
      (x) =>
        x.proteinG > 0 || x.carbsG > 0 || x.fatG > 0 || x.calories > 0,
    );
  if (hasMacro(byDay.training)) return byDay.training;
  if (hasMacro(byDay.rest)) return byDay.rest;
  return [];
}

/** Profil / zapis: zawsze oba zestawy po 5 slotów. */
export function mealTemplatesForProfile(
  raw: string | null | undefined,
): MealTemplatesByDayType {
  if (!raw?.trim()) {
    return {
      training: normalizeMealTemplates([], "training"),
      rest: normalizeMealTemplates([], "rest"),
    };
  }
  try {
    const j = JSON.parse(raw) as unknown;
    if (Array.isArray(j)) {
      const legacy = parseTemplateArray(j);
      const slots =
        legacy.length > 0
          ? legacy
          : normalizeMealTemplates([], "training");
      return {
        training: normalizeMealTemplates(slots, "training"),
        rest: normalizeMealTemplates(
          slots.map((t, i) => ({
            ...t,
            id: stableMealId(i + 1, "rest"),
          })),
          "rest",
        ),
      };
    }
    if (j && typeof j === "object") {
      const obj = j as { training?: unknown; rest?: unknown };
      const training = Array.isArray(obj.training)
        ? parseTemplateArray(obj.training)
        : [];
      const rest = Array.isArray(obj.rest) ? parseTemplateArray(obj.rest) : [];
      return {
        training: normalizeMealTemplates(
          training.length ? training : [],
          "training",
        ),
        rest: normalizeMealTemplates(rest.length ? rest : [], "rest"),
      };
    }
  } catch {
    /* fall through */
  }
  return {
    training: normalizeMealTemplates([], "training"),
    rest: normalizeMealTemplates([], "rest"),
  };
}

/** Wybór zestawu dla daty — ten sam resolver co cele dnia (`dayTypes[key] ?? "rest"`). */
export function mealTemplatesForDay(
  raw: string | null | undefined,
  dayType: MealDayType,
): MealTemplate[] {
  const byDay = mealTemplatesForProfile(raw);
  return dayType === "training" ? byDay.training : byDay.rest;
}

export function serializeMealTemplates(
  templates: MealTemplate[],
): string | null {
  return serializeMealTemplatesByDayType({
    training: templates,
    rest: templates,
  });
}

export function serializeMealTemplatesByDayType(
  byDay: MealTemplatesByDayType,
): string | null {
  const training = normalizeMealTemplates(byDay.training, "training").map(
    (t) => ({
      ...t,
      calories: kcalFromMacros(t.proteinG, t.fatG, t.carbsG),
    }),
  );
  const rest = normalizeMealTemplates(byDay.rest, "rest").map((t) => ({
    ...t,
    calories: kcalFromMacros(t.proteinG, t.fatG, t.carbsG),
  }));
  const hasAnyMacro = [...training, ...rest].some(
    (t) => t.proteinG > 0 || t.carbsG > 0 || t.fatG > 0 || t.calories > 0,
  );
  if (!hasAnyMacro) return null;
  return JSON.stringify({ training, rest });
}

export function mealTemplatesDaySum(templates: MealTemplate[]): {
  proteinG: number;
  carbsG: number;
  fatG: number;
  calories: number;
} {
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  for (const t of templates) {
    proteinG += t.proteinG;
    carbsG += t.carbsG;
    fatG += t.fatG;
  }
  return {
    proteinG,
    carbsG,
    fatG,
    calories: kcalFromMacros(proteinG, fatG, carbsG),
  };
}
