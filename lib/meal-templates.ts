import { z } from "zod";

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

export function defaultMealTemplateName(index: number): string {
  return `Posiłek ${index}`;
}

function stableMealId(index: number): string {
  return `meal_slot_${index}`;
}

export function emptyMealTemplate(index: number): MealTemplate {
  return {
    id: stableMealId(index),
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
): MealTemplate[] {
  const out: MealTemplate[] = [];
  for (let i = 1; i <= MEAL_TEMPLATE_COUNT; i++) {
    const existing = templates[i - 1];
    if (existing) {
      out.push({
        ...existing,
        id: existing.id?.trim() || stableMealId(i),
        name: defaultMealTemplateName(i),
      });
    } else {
      out.push(emptyMealTemplate(i));
    }
  }
  return out;
}

export function parseMealTemplatesJson(raw: string | null | undefined): MealTemplate[] {
  if (!raw?.trim()) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return [];
    const out: MealTemplate[] = [];
    for (const item of j) {
      const p = templateSchema.safeParse(item);
      if (p.success) out.push(p.data);
    }
    if (out.length === 0) return [];
    return normalizeMealTemplates(out);
  } catch {
    return [];
  }
}

/** Profil: zawsze 5 slotów (także gdy brak zapisu). */
export function mealTemplatesForProfile(
  raw: string | null | undefined,
): MealTemplate[] {
  return normalizeMealTemplates(parseMealTemplatesJson(raw));
}

export function serializeMealTemplates(templates: MealTemplate[]): string | null {
  const normalized = normalizeMealTemplates(templates);
  const hasAnyMacro = normalized.some(
    (t) => t.proteinG > 0 || t.carbsG > 0 || t.fatG > 0 || t.calories > 0,
  );
  if (!hasAnyMacro) return null;
  return JSON.stringify(normalized);
}
